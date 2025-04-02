const logger = require('../utils/logger');
const { getModel } = require('../config/database');
const productSchema = require('../models/product_schema');
const { getAccount } = require('../middlewares/auth.middleware');
const emissionData = require('../data/materials_database.json');
const processing_database = require('../data/processing_database.json');

/**
 * Get product model for the current account
 */
const getProductModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, productSchema, "Product");
};

/**
 * Calculate emissions from raw materials
 */
const calculateRawMaterialEmissions = (materials, countryOfOrigin) => {
  // Create Maps for faster lookup
  const emissionMap = new Map(
    emissionData.map((data) => [
      `${data.countryOfOrigin}-${data.materialClass}-${data.specificMaterial}`,
      data.EmissionFactor,
    ])
  );

  return materials.reduce((total, material) => {
    // Try with specific country first
    const specificKey = `${countryOfOrigin}-${material.materialClass}-${material.specificMaterial}`;
    
    // If not found, try with GLO (Global)
    const globalKey = `GLO-${material.materialClass}-${material.specificMaterial}`;
    
    // If still not found, try with RoW (Rest of World)
    const rowKey = `RoW-${material.materialClass}-${material.specificMaterial}`;
    
    // Get the emission factor with fallbacks
    const emissionFactor = 
      emissionMap.get(specificKey) || 
      emissionMap.get(globalKey) || 
      emissionMap.get(rowKey) || 
      0; // Default to 0 if all lookups fail
    
    // Store the emission factor on the material for reference
    material.emissionFactor = emissionFactor * material.weight;
    
    // Log when using fallbacks for debugging (optional)
    if (!emissionMap.get(specificKey) && (emissionMap.get(globalKey) || emissionMap.get(rowKey))) {
      logger.debug(`Using fallback emission factor for ${material.materialClass}-${material.specificMaterial} from ${
        emissionMap.get(globalKey) ? 'GLO' : 'RoW'
      }`);
    }
    
    return total + material.emissionFactor;
  }, 0);
};

/**
 * Calculate emissions from manufacturing processes
 */
const calculateProcessEmissions = (productManufacturingProcess) => {
  // Group processing data by Category and SubType for faster lookup
  const processingMap = new Map(
    processing_database.map((data) => [
      `${data.Category}-${data.SubType}`,
      data.Value,
    ])
  );

  // Create separate maps for global and ROW fallbacks
  const processingByCategory = {};
  
  // Organize processing by category for fallback lookups
  processing_database.forEach(data => {
    if (!processingByCategory[data.Category]) {
      processingByCategory[data.Category] = {
        global: {},
        row: {}
      };
    }
    
    // If this is a global or RoW entry, store it for potential fallback
    if (data.Category === 'GLO' || data.Category.includes('Global')) {
      processingByCategory[data.Category].global[data.SubType] = data.Value;
    } else if (data.Category === 'RoW' || data.Category.includes('Rest')) {
      processingByCategory[data.Category].row[data.SubType] = data.Value;
    }
  });

  return productManufacturingProcess.reduce((total, materialProcess) => {
    const processTotal = materialProcess.manufacturingProcesses.reduce(
      (sum, processGroup) => {
        const groupTotal = processGroup.processes.reduce(
          (innerSum, processName) => {
            // Try specific category first
            const specificKey = `${processGroup.category}-${processName}`;
            let emissionValue = processingMap.get(specificKey);
            
            // If not found, try fallbacks (if available)
            if (emissionValue === undefined) {
              // Try global fallback
              const globalValue = 
                (processingByCategory['GLO'] && processingByCategory['GLO'].global[processName]) ||
                (processingByCategory['Global'] && processingByCategory['Global'].global[processName]);
                
              // Try ROW fallback
              const rowValue = 
                (processingByCategory['RoW'] && processingByCategory['RoW'].row[processName]) ||
                (processingByCategory['Rest of World'] && processingByCategory['Rest of World'].row[processName]);
                
              emissionValue = globalValue || rowValue || 0;
              
              // Log fallback usage (optional)
              if (globalValue || rowValue) {
                logger.debug(`Using fallback emission factor for ${processGroup.category}-${processName} from ${
                  globalValue ? 'Global' : 'RoW'
                }`);
              }
            }
            
            // Calculate and store the emission factor
            const calculatedEmission = emissionValue * materialProcess.weight;
            materialProcess.emissionFactor = calculatedEmission;
            
            return innerSum + calculatedEmission;
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

/**
 * Create a new product
 */
const createProduct = async (req) => {
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

  return await newProduct.save();
};

/**
 * Get all products
 */
const getAllProducts = async (req) => {
  const Product = await getProductModel(req);
  let products = await Product.find().lean();
  
  // Sort products by creation date (newest first)
  products.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
  
  // Format numbers to 2 decimal places
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

  return products;
};

/**
 * Get product by ID
 */
const getProductById = async (req, id) => {
  const Product = await getProductModel(req);
  return await Product.findById(id);
};

/**
 * Update a product
 */
const updateProduct = async (req, id) => {
  const Product = await getProductModel(req);
  return await Product.findByIdAndUpdate(
    id,
    { ...req.body, modifiedDate: new Date() },
    { new: true, runValidators: true }
  );
};

/**
 * Delete a product
 */
const deleteProduct = async (req, id) => {
  const Product = await getProductModel(req);
  return await Product.findByIdAndDelete(id);
};

/**
 * Delete all products
 */
const deleteAllProducts = async (req) => {
  const Product = await getProductModel(req);
  return await Product.deleteMany({});
};

/**
 * Delete product by ID
 */
const deleteProductByID = async (req) => {
  const { _id } = req.body;
  const Product = await getProductModel(req);
  return await Product.deleteOne({ _id });
};

module.exports = {
  getProductModel,
  calculateRawMaterialEmissions,
  calculateProcessEmissions,
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  deleteAllProducts,
  deleteProductByID
};