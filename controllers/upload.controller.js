const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const extract = require('extract-zip');
const Unrar = require('node-unrar-js');
const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const productService = require('../services/product.service');
const { retry, generateUUID, addQSToURL } = require('../utils/helpers');
const { getOriginUrl } = require('../middlewares/auth.middleware');
const { 
  classifyProduct, 
  classifyBOM, 
  classifyManufacturingProcess 
} = require('../utils/chatGPTUtils');

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * Bulk upload products from Excel/CSV
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(formatResponse(false, null, "No file uploaded"));
    }

    const Product = await productService.getProductModel(req);
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    let products = [];

    if (fileExtension === 'csv') {
      // Parse CSV file
      const csvContent = req.file.buffer.toString('utf8');
      const Papa = require('papaparse');
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: header => header.trim()
      });
      
      if (parseResult.errors && parseResult.errors.length > 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
          false,
          null,
          "CSV parsing error",
          { errors: parseResult.errors }
        ));
      }
      
      products = parseResult.data;
    } else {
      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      products = XLSX.utils.sheet_to_json(sheet);
    }

    if (!products || products.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "No products found in the uploaded file"
      ));
    }

    // Normalize field names to lowercase to handle case-insensitivity
    const normalizedProducts = products.map(product => {
      const normalizedProduct = {};
      
      // Map of expected field names (lowercase) to schema field names
      const fieldMap = {
        'code': 'code',
        'name': 'name',
        'description': 'description',
        'weight': 'weight',
        'country of origin': 'countryOfOrigin',
        'countryoforigin': 'countryOfOrigin',
        'supplier name': 'supplierName',
        'suppliername': 'supplierName',
        'category': 'category',
        'subcategory': 'subCategory',
        'price': 'price'
      };
      
      // Process each field in the product
      Object.keys(product).forEach(key => {
        // Find the corresponding field in our schema
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
        const schemaField = fieldMap[normalizedKey] || normalizedKey;
        
        // If the field exists in our schema, add it to the normalized product
        normalizedProduct[schemaField] = product[key];
      });
      
      // Add creation date and modified date
      normalizedProduct.createdDate = new Date();
      normalizedProduct.modifiedDate = new Date();
      
      return normalizedProduct;
    });

    // Validate required fields
    const validationErrors = {};
    const requiredFields = ['code', 'name', 'description'];
    
    normalizedProducts.forEach((product, index) => {
      requiredFields.forEach(field => {
        if (!product[field]) {
          validationErrors[`Row ${index + 2}, ${field}`] = 'is required';
        }
      });
    });

    if (Object.keys(validationErrors).length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Validation failed",
        { validationErrors }
      ));
    }

    // Insert products into MongoDB
    const savedProducts = await Product.insertMany(normalizedProducts);

    // Process each product in the background
    savedProducts.forEach(async (product) => {
      try {
        // Wait for classification result
        const classifyResult = await retry(
          classifyProduct,
          [product.code, product.name, product.description, req],
          1
        );
        const classifyBOMResult = await retry(
          classifyBOM,
          [product.code, product.name, product.description, product.weight, null, req],
          1
        );
        const classifyManufacturingProcessResult = await retry(
          classifyManufacturingProcess,
          [product.code, product.name, product.description, classifyBOMResult, req],
          1
        );

        // Calculate emissions separately
        const co2EmissionRawMaterials = productService.calculateRawMaterialEmissions(
          classifyBOMResult,
          product.countryOfOrigin
        );
        const co2EmissionFromProcesses = productService.calculateProcessEmissions(
          classifyManufacturingProcessResult
        );

        const co2Emission = co2EmissionRawMaterials + co2EmissionFromProcesses;

        // Ensure result exists before updating
        if (classifyResult?.category && classifyResult?.subcategory) {
          await Product.updateOne(
            { _id: product._id },
            {
              $set: {
                category: classifyResult.category,
                subCategory: classifyResult.subcategory,
                materials: classifyBOMResult,
                productManufacturingProcess: classifyManufacturingProcessResult,
                co2Emission: co2Emission,
                co2EmissionRawMaterials: co2EmissionRawMaterials,
                co2EmissionFromProcesses: co2EmissionFromProcesses,
                modifiedDate: Date.now(),
              },
            }
          );

          logger.info(
            `✅ Product ${product.code} updated with category: ${classifyResult.category}, subcategory: ${classifyResult.subcategory}`
          );
        } else {
          logger.warn(
            `⚠️ Product ${product.code} classification failed, skipping update.`
          );
        }
      } catch (error) {
        logger.error(
          `❌ Failed to classify and update product ${product.code}:`,
          error.message
        );
      }
    });

    // Send response immediately while classification happens in the background
    res
      .status(HTTP_STATUS.CREATED)
      .json(formatResponse(true, savedProducts));
  } catch (error) {
    logger.error("Product upload error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to upload products: ${error.message}`
    ));
  }
};

/**
 * Upload image to external API
 * @param {string} url - Upload URL
 * @param {string} filePath - Path to file
 */
async function uploadImageToExternalAPI(url, filePath) {
  const formData = new FormData();

  // Create a read stream instead of reading the entire file into memory
  formData.append("file", fs.createReadStream(filePath));

  try {
    const response = await axios.post(url, formData, {
      headers: {
        //Authorization: apiKey,
        ...formData.getHeaders(),
      },
      // Add timeout and max content length configs
      timeout: 30000,
      maxContentLength: Infinity,
    });

    logger.info(
      `Uploaded ${path.basename(filePath)} for product:`,
      response.data
    );
    return response.data;
  } catch (error) {
    // More detailed error logging
    logger.error(`Error uploading ${filePath}:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
    });

    // Re-throw the error or return an error object
    throw error;
  }
}

/**
 * Extract ZIP file
 * @param {string} filePath - Path to ZIP file
 * @param {string} outputPath - Path to extract to
 */
const extractZipFile = async (filePath, outputPath) => {
  await extract(filePath, { dir: outputPath });
};

/**
 * Extract RAR file
 * @param {string} filePath - Path to RAR file
 * @param {string} outputPath - Path to extract to
 */
const extractRarFile = async (filePath, outputPath) => {
  const data = fs.readFileSync(filePath);
  const extractor = Unrar.createExtractorFromData(data);
  const extracted = extractor.extract();
  if (extracted[0].state === "SUCCESS") {
    extracted[1].files.forEach((file) => {
      const filePath = path.join(outputPath, file.fileHeader.name);
      fs.outputFileSync(filePath, file.extract()[1]);
    });
  }
};

/**
 * Bulk upload product images
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const bulkImageUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json(formatResponse(
      false,
      null,
      "No file uploaded"
    ));
  }
  
  const account = req.account; // From validateAccount middleware
  const tempDir = path.join(__dirname, "../temp", account);
  const uploadedFilePath = path.join(tempDir, req.file.originalname);

  try {
    const Product = await productService.getProductModel(req);

    // Ensure temp directory exists
    fs.ensureDirSync(tempDir);

    // Save uploaded file
    fs.writeFileSync(uploadedFilePath, req.file.buffer);

    // Create extraction directory
    const extractionDir = path.join(
      tempDir,
      path.parse(req.file.originalname).name
    );
    fs.ensureDirSync(extractionDir);

    // Extract based on file type
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (fileExt === ".zip") {
      await extractZipFile(uploadedFilePath, tempDir);
    } else if (fileExt === ".rar") {
      await extractRarFile(uploadedFilePath, extractionDir);
    } else {
      throw new Error("Unsupported file type. Only ZIP and RAR are allowed.");
    }

    // Process extracted folders
    const productFolders = fs.readdirSync(extractionDir);
    for (const productCode of productFolders) {
      let imageUploadedPaths = [];

      const productPath = path.join(extractionDir, productCode);
      if (fs.statSync(productPath).isDirectory()) {
        logger.info(`Processing images for product: ${productCode}`);

        const images = fs
          .readdirSync(productPath)
          .filter((file) => /\.(jpg|jpeg|png|gif)$/i.test(file));
        
        for (const image of images) {
          const imagePath = path.join(productPath, image);
          if (fs.statSync(imagePath).isFile()) {
            let name = `file-${generateUUID()}${path.extname(imagePath)}`;
            let hostURL = getOriginUrl(req) || "http://127.0.0.1:5000";
            let baseUrl = `${hostURL}/uploadcontent/notes/uploads/images/`;
            let url = addQSToURL(baseUrl, { filename: name });

            await uploadImageToExternalAPI(url, imagePath);
            let downloadUrl = hostURL + "/content/notes/uploads/images/" + name;
            imageUploadedPaths.push(downloadUrl);

            await Product.updateOne(
              { code: productCode },
              { $push: { images: downloadUrl } }
            );

            logger.info(`Uploaded: ${downloadUrl}`);
          }
        }
      }
    }

    res.json(formatResponse(
      true,
      null,
      "Files uploaded and processed successfully"
    ));
  } catch (error) {
    logger.error("Error:", error);
    res.status(500).json(formatResponse(
      false,
      null,
      error.message
    ));
  } finally {
    // Cleanup temporary files (uncomment when in production)
    //fs.removeSync(extractionDir);
    //fs.unlinkSync(uploadedFilePath);
  }
};

module.exports = {
  upload,  // Export multer middleware for routes
  bulkUploadProducts,
  bulkImageUpload
};