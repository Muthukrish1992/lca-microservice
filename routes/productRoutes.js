const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");

const extract = require("extract-zip");
const Unrar = require("node-unrar-js");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

const productSchema = require("../models/product_schema");
const router = express.Router();

const {
  classifyProduct,
  classifyBOM,
  classifyManufacturingProcess,
} = require("../utils/chatGPTUtils");
const { ObjectId } = require("mongodb");

const {
  HTTP_STATUS,
  getModel,
  validateAccount,
  getAccount,
  getOriginUrl,
  getAuthorizationKey,
} = require("../utils/utils");
const emissionData = require("../data/materials_database.json");
const processing_database = require("../data/processing_database.json");

const getProductModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, productSchema, "Product");
};

const calculateRawMaterialEmissions = (materials, countryOfOrigin) => {
  // Create Maps for faster lookup
  const emissionMap = new Map(
    emissionData.map((data) => [
      `${data.countryOfOrigin}-${data.materialClass}-${data.specificMaterial}`,
      data.EmissionFactor,
    ])
  );

  return materials.reduce((total, material) => {
    const key = `${countryOfOrigin}-${material.materialClass}-${material.specificMaterial}`;
    const emissionFactor = emissionMap.get(key) || 10; // Default value if not found
    material.emissionFactor = emissionFactor * material.weight;
    return total + material.emissionFactor;
  }, 0);
};

const calculateProcessEmissions = (productManufacturingProcess) => {
  const processingMap = new Map(
    processing_database.map((data) => [
      `${data.Category}-${data.SubType}`,
      data.Value,
    ])
  );

  return productManufacturingProcess.reduce((total, materialProcess) => {
    const processTotal = materialProcess.manufacturingProcesses.reduce(
      (sum, processGroup) => {
        const groupTotal = processGroup.processes.reduce(
          (innerSum, processName) => {
            const key = `${processGroup.category}-${processName}`;
            materialProcess.emissionFactor =
              (processingMap.get(key) || 10) * materialProcess.weight;
            return innerSum + materialProcess.emissionFactor;
          },
          0
        );
        return sum + groupTotal;
      },
      0
    );
    return total + processTotal;
  }, 0);
};

const createProduct = async (req, res) => {
  try {
    const Product = await getProductModel(req);

    const {
      code,
      name,
      description,
      weight,
      countryOfOrigin,
      category,
      subCategory,
      supplierName,
      materials = [],
      images = [],
      productManufacturingProcess = [],
    } = req.body;

    // Calculate emissions separately
    const co2EmissionRawMaterials = calculateRawMaterialEmissions(
      materials,
      countryOfOrigin
    );
    const co2EmissionFromProcesses = calculateProcessEmissions(
      productManufacturingProcess
    );

    const co2Emission = co2EmissionRawMaterials + co2EmissionFromProcesses;

    // Create new product instance
    const newProduct = new Product({
      code,
      name,
      description,
      weight,
      countryOfOrigin,
      category,
      subCategory,
      supplierName,
      materials,
      images,
      modifiedDate: new Date(),
      createdDate: new Date(),
      co2Emission,
      co2EmissionRawMaterials,
      co2EmissionFromProcesses,
      productManufacturingProcess,
    });

    const savedProduct = await newProduct.save();
    res.status(201).json({ success: true, data: savedProduct });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      message: `Failed to create product: ${error.message}`,
    });
  }
};

const getAllProducts = async (req, res) => {
  try {
    console.log("Get all products");
    let test = getOriginUrl(req);
    console.log("Host: ", test);
    const account = getAccount(req);
    console.log("Account: ", account);
    const authorizationKey = getAuthorizationKey(req);
    console.log("Authorization Key: ", authorizationKey);
    const Product = await getProductModel(req);
    let products = await Product.find().lean();
    products.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    products = products.map((product) => ({
      ...product,
      co2Emission: product.co2Emission
        ? parseFloat(product.co2Emission.toFixed(2))
        : product.co2Emission,
      co2EmissionRawMaterials: product.co2EmissionRawMaterials
        ? parseFloat(product.co2EmissionRawMaterials.toFixed(2))
        : product.co2EmissionRawMaterials,
      co2EmissionFromProcesses: product.co2EmissionFromProcesses
        ? parseFloat(product.co2EmissionFromProcesses.toFixed(2))
        : product.co2EmissionFromProcesses,
    }));

    const plan = await getAccountPlan(req);

    res.status(HTTP_STATUS.OK).json({ success: true, data: {products : products , plan : plan} });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `Failed to fetch products: ${error.message}`,
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const Product = await getProductModel(req);
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Product not found" });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, data: product });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `Failed to fetch product: ${error.message}`,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const Product = await getProductModel(req);
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, modifiedDate: new Date() },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Product not found" });
    }

    res.status(HTTP_STATUS.OK).json({ success: true, data: updatedProduct });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `Failed to update product: ${error.message}`,
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const Product = await getProductModel(req);
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ success: false, message: "Product not found" });
    }

    res
      .status(HTTP_STATUS.OK)
      .json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `Failed to delete product: ${error.message}`,
    });
  }
};

const deleteAllProducts = async (req, res) => {
  try {
    const Product = await getProductModel(req);
    const result = await Product.deleteMany({});

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "All products have been deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `Failed to delete products: ${error.message}`,
    });
  }
};

const deleteProductByID = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "Product _id is required",
      });
    }

    const Product = await getProductModel(req);
    const result = await Product.deleteOne({ _id });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `No product found with code: ${_id}`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Product with code ${_id} deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to delete product: ${error.message}`,
    });
  }
};

// Add this route in your express router
// router.delete("/products/:code", deleteProductByCode);

const retry = async (fn, args, retries = 1, delay = 1000) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(...args);
    } catch (error) {
      console.warn(`⚠️ Attempt ${attempt + 1} failed: ${error.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
      } else {
        throw error; // Throw error if all retries fail
      }
    }
  }
};

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const bulkUploadProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ success: false, message: "No file uploaded" });
    }

    const Product = await getProductModel(req);
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const products = XLSX.utils.sheet_to_json(sheet);

    // Insert products into MongoDB
    const savedProducts = await Product.insertMany(products);

    // Process each product in the background
    savedProducts.forEach(async (product) => {
      try {
        // Wait for classification result
        const classifyResult = await retry(
          classifyProduct,
          [product.code, product.name, product.description],
          1
        );
        const classifyBOMResult = await retry(
          classifyBOM,
          [product.code, product.name, product.description, product.weight],
          1
        );
        const classifyManufacturingProcessResult = await retry(
          classifyManufacturingProcess,
          [product.code, product.name, product.description, classifyBOMResult],
          1
        );

        // Calculate emissions separately
        const co2EmissionRawMaterials = calculateRawMaterialEmissions(
          classifyBOMResult,
          product.countryOfOrigin
        );
        const co2EmissionFromProcesses = calculateProcessEmissions(
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

          console.log(
            `✅ Product ${product.code} updated with category: ${classifyResult.category}, subcategory: ${classifyResult.subcategory}`
          );
        } else {
          console.warn(
            `⚠️ Product ${product.code} classification failed, skipping update.`
          );
        }
      } catch (error) {
        console.error(
          `❌ Failed to classify and update product ${product.code}:`,
          error.message
        );
      }
    });

    // Send response immediately while classification happens in the background
    res
      .status(HTTP_STATUS.CREATED)
      .json({ success: true, data: savedProducts });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: `Failed to upload products: ${error.message}`,
    });
  }
};

router.get("/test-insert", async (req, res) => {
  const Product = await getProductModel(req);
  const newProduct = new Product({
    code: "TEST123",
    name: "Test Product",
    description: "This is a test product",
    category: "test",
  });

  const savedProduct = await newProduct.save();
  console.log("Test route");
});

router.get("/test", async (req, res) => {
  const Product = await getProductModel(req);
  const result = await Product.updateOne(
    { _id: new ObjectId("67ab24c4d170d1d26c6eff52") },
    { $set: { category: "test111", subCategory: "test222" } }
  );

  console.log("Test route");
});

// Utility function to extract ZIP files
const extractZipFile = async (filePath, outputPath) => {
  await extract(filePath, { dir: outputPath });
};

// Utility function to extract RAR files
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

function generateUUID() {
  var d = new Date().getTime();
  var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    function (c) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c == "x" ? r : (r & 0x7) | 0x8).toString(16);
    }
  );
  return uuid;
}

function addQSToURL(url, qs) {
  let result = url.includes("?") ? url : url + "?";
  let qsArray = Object.entries(qs).map(([key, value]) => `${key}=${value}`);
  return result + qsArray.join("&");
}

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

    console.log(
      `Uploaded ${path.basename(filePath)} for product :`,
      response.data
    );
    return response.data;
  } catch (error) {
    // More detailed error logging
    console.error(`Error uploading ${filePath}:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
    });

    // Re-throw the error or return an error object
    throw error;
  }
}

const bulkImageUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const account = getAccount(req);
  const tempDir = path.join(__dirname, "temp", account);
  const uploadedFilePath = path.join(tempDir, req.file.originalname);

  try {
    const Product = await getProductModel(req);

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
        console.log(`Processing images for product: ${productCode}`);

        const images = fs
          .readdirSync(productPath)
          .filter((file) => /\.(jpg|jpeg|png|gif)$/i.test(file));
        for (const image of images) {
          const imagePath = path.join(productPath, image);
          if (fs.statSync(imagePath).isFile()) {
            let name = `file-${generateUUID()}${path.extname(imagePath)}`;
            //let hostURL = getOriginUrl(req);
            let hostURL = "http://127.0.0.1:5000";
            let baseUrl = `${hostURL}/uploadcontent/notes/uploads/images/`;
            let url = addQSToURL(baseUrl, { filename: name });

            await uploadImageToExternalAPI(url, imagePath);
            let downloadUrl = hostURL + "/content/notes/uploads/images/" + name;
            imageUploadedPaths.push(downloadUrl);

            await Product.updateOne(
              { code: productCode },
              { $push: { images: downloadUrl } }
            );

            console.log(`Uploaded: ${downloadUrl}`);
          }
        }
      }
    }

    res.json({ message: "Files uploaded and processed successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    // Cleanup temporary files
    //fs.removeSync(extractionDir);
    //fs.unlinkSync(uploadedFilePath);
  }
};

router.post("/bulk-upload", upload.single("file"), bulkUploadProducts);
router.post("/bulk-image-upload", upload.single("file"), bulkImageUpload);
router.post("/delete-product-by-id", deleteProductByID);
// Routes
router.use(validateAccount);

router
  .route("/")
  .post(createProduct)
  .get(getAllProducts)
  .delete(deleteAllProducts);

router
  .route("/:id")
  .get(getProductById)
  .put(updateProduct)
  .delete(deleteProduct);

module.exports = router;
