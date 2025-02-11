const express = require("express");
const multer = require('multer');
const XLSX = require('xlsx');

const productSchema = require("../models/product_schema");
const router = express.Router();

const {classifyProduct} = require("../utils/chatGPTUtils");
const { ObjectId } = require('mongodb'); 

const {
  HTTP_STATUS,
  getModel,
  validateAccount,
  getAccount,
} = require("../utils/utils");
const emissionData = require("../data/materials_database.json");
const processing_database = require("../data/processing_database.json");

const getProductModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, productSchema, "Product");
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
      materials,
      images,
      productManufacturingProcess,
    } = req.body;

    const emissionMap = new Map(
      emissionData.map((data) => [
        `${data.countryOfOrigin}-${data.materialClass}-${data.specificMaterial}`,
        data.EmissionFactor,
      ])
    );
    const processingMap = new Map(
      processing_database.map((data) => [
        `${data.Category}-${data.SubType}`,
        data.Value,
      ])
    );

    let co2EmissionRawMaterials = materials.reduce((total, material) => {
      let key = `${countryOfOrigin}-${material.materialClass}-${material.specificMaterial}`;
      material.emissionFactor = (emissionMap.get(key) || 10) * material.weight;
      return total + material.emissionFactor;
    }, 0);

    const co2EmissionFromProcesses = productManufacturingProcess.reduce(
      (total, materialProcess) => {
        return (
          total +
          materialProcess.manufacturingProcesses.reduce(
            (processTotal, processGroup) => {
              return (
                processTotal +
                processGroup.processes.reduce((innerTotal, processName) => {
                  let key = `${processGroup.category}-${processName}`;
                  materialProcess.emissionFactor =
                    (processingMap.get(key) || 10) * materialProcess.weight;
                  return innerTotal + materialProcess.emissionFactor;
                }, 0)
              );
            },
            0
          )
        );
      },
      0
    );

    let co2Emission = co2EmissionRawMaterials + co2EmissionFromProcesses;

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
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: savedProduct });
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: `Failed to create product: ${error.message}`,
      });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const Product = await getProductModel(req);
    const products = await Product.find().lean();
    res.status(HTTP_STATUS.OK).json({ success: true, data: products });
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({
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
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({
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
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({
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
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: `Failed to delete product: ${error.message}`,
      });
  }
};

const deleteAllProducts = async (req, res) => {
  try {
    const Product = await getProductModel(req);
    const result = await Product.deleteMany({});

    res
      .status(HTTP_STATUS.OK)
      .json({
        success: true,
        message: "All products have been deleted successfully",
        deletedCount: result.deletedCount,
      });
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: `Failed to delete products: ${error.message}`,
      });
  }
};

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const bulkUploadProducts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'No file uploaded' });
        }

        const Product = await getProductModel(req);
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const products = XLSX.utils.sheet_to_json(sheet);

        // Insert products into MongoDB
        const savedProducts = await Product.insertMany(products);

        // Process each product in the background
        savedProducts.forEach(async (product) => {
            try {
                // Wait for classification result
                const result = await classifyProduct(product.code, product.name, product.description);
                
                // Ensure result exists before updating
                if (result?.category && result?.subcategory) {
                    await Product.updateOne(
                        { _id: product._id },
                        { $set: { category: result.category, subCategory: result.subcategory } }
                    );

                    console.log(`✅ Product ${product.code} updated with category: ${result.category}, subcategory: ${result.subcategory}`);
                } else {
                    console.warn(`⚠️ Product ${product.code} classification failed, skipping update.`);
                }
            } catch (error) {
                console.error(`❌ Failed to classify and update product ${product.code}:`, error.message);
            }
        });

        // Send response immediately while classification happens in the background
        res.status(HTTP_STATUS.CREATED).json({ success: true, data: savedProducts });
    } catch (error) {
        console.error(error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: `Failed to upload products: ${error.message}` });
    }
};

router.get("/test-insert", async (req, res) => {
    const Product = await getProductModel(req);
    const newProduct = new Product({
        code: "TEST123",
        name: "Test Product",
        description: "This is a test product",
        category: "test"
    });

    const savedProduct = await newProduct.save();
    console.log("Test route");
});

router.get("/test", async (req, res) => {
    const Product = await getProductModel(req);
    const result = await Product.updateOne(
        { _id: new ObjectId("67aadc5cf9f7a9ca451838f8") },
        { $set: { category: "test11", subCategory: "test22" } }
    );

    console.log("Test route");
});



router.post('/bulk-upload', upload.single('file'), bulkUploadProducts);

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
