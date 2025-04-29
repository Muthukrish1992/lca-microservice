const logger = require('../utils/logger');
const { getModel } = require('../config/database');
const productSchema = require('../models/product_schema');
const { getAccount } = require('../middlewares/auth.middleware');
const emissionData = require('../data/materials_database.json');
const manufacturingProcesses = require('../data/manufacturingProcesses.json');

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
    let emissionFactor = 
      emissionMap.get(specificKey) || 
      emissionMap.get(globalKey) || 
      emissionMap.get(rowKey);
    
    // If still not found, try to find any entry with same material class/specific material
    if (!emissionFactor) {
      // Find any entry with same materialClass and specificMaterial
      const materialEntries = emissionData.filter(
        data => data.materialClass === material.materialClass && 
                data.specificMaterial === material.specificMaterial
      );
      
      if (materialEntries.length > 0) {
        // Use the first match
        emissionFactor = materialEntries[0].EmissionFactor;
        logger.debug(`Using alternative region ${materialEntries[0].countryOfOrigin} for ${material.materialClass}-${material.specificMaterial}`);
      } else {
        // Default to 0 if all lookups fail
        emissionFactor = 0;
      }
    }
    
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
 * @param {Array} productManufacturingProcess - The manufacturing processes for the product
 * @param {String} countryOfOrigin - The country of origin of the product (e.g., 'CN', 'VN', 'GLO')
 */
const calculateProcessEmissions = (productManufacturingProcess, countryOfOrigin = 'GLO') => {
  // Country-specific electricity emission factors (kg CO2eq/kWh)
  const countryEmissionFactors = {
    'CN': 0.84,   // China
    'VN': 0.63,   // Vietnam
    'GLO': 0.68   // Global default
  };
  
  // Get the appropriate emission factor based on country of origin
  // Default to global if country not found
  const emissionFactor = countryEmissionFactors[countryOfOrigin] || countryEmissionFactors['GLO'];
  
  logger.debug(`Using electricity emission factor for ${countryOfOrigin}: ${emissionFactor} kg CO2eq/kWh`);
  
  return productManufacturingProcess.reduce((total, materialProcess) => {
    const processTotal = materialProcess.manufacturingProcesses.reduce(
      (sum, processGroup) => {
        const groupTotal = processGroup.processes.reduce(
          (innerSum, processName) => {
            // Check if the material and process exist in manufacturingProcesses
            let energyValue = 0; // Energy value in kWh/kg
            
            if (
              manufacturingProcesses[processGroup.category] && 
              manufacturingProcesses[processGroup.category][processName]
            ) {
              energyValue = manufacturingProcesses[processGroup.category][processName];
            } else {
              // Log when process not found
              logger.debug(`Process ${processName} not found for ${processGroup.category} in manufacturingProcesses. Using 0.`);
            }
            
            // Calculate emissions: energy (kWh/kg) * weight (kg) * emission factor (kg CO2eq/kWh)
            const calculatedEmission = energyValue * materialProcess.weight * emissionFactor;
            
            // Store the emission factor for reference
            if (!materialProcess.processEmissions) {
              materialProcess.processEmissions = [];
            }
            
            materialProcess.processEmissions.push({
              process: processName,
              energyValue: energyValue,
              emissionFactor: emissionFactor,
              weight: materialProcess.weight,
              emission: calculatedEmission
            });
            
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
    productManufacturingProcess,
    countryOfOrigin
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