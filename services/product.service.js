const logger = require('../utils/logger');
const { getModel } = require('../config/database');
const productSchema = require('../models/product_schema');
const { getAccount } = require('../middlewares/auth.middleware');
const emissionData = require('../data/materials_database.json');
const manufacturingProcesses = require('../data/manufacturing_ef.json');

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
// const calculateRawMaterialEmissions = (materials, countryOfOrigin) => {
//   console.log('executing RawMaterialEmissions',materials,countryOfOrigin)
//   // Create Maps for faster lookup - store full data object instead of just EmissionFactor
//   const emissionMap = new Map(
//     emissionData.map((data) => [
//       `${data.countryOfOrigin}-${data.materialClass}-${data.specificMaterial}`,
//       data
//     ])
//   );

//   return materials.reduce((total, material) => {
//     console.log("executing materials.reduce")
//     // Try with specific country first
//     const specificKey = `${countryOfOrigin}-${material.materialClass}-${material.specificMaterial}`;
    
//     // If not found, try with GLO (Global)
//     const globalKey = `GLO-${material.materialClass}-${material.specificMaterial}`;
    
//     // If still not found, try with RoW (Rest of World)
//     const rowKey = `RoW-${material.materialClass}-${material.specificMaterial}`;
//     console.log(`specificKey`,specificKey)
//     console.log(`globalKey`,globalKey)
//     console.log(`rowKey`,rowKey)
//     // Get the emission data with fallbacks
//     let emissionDataEntry = 
//       emissionMap.get(specificKey) || 
//       emissionMap.get(globalKey) || 
//       emissionMap.get(rowKey);
//     console.log("emissionDataEntry",emissionDataEntry)
//     // If still not found, try to find any entry with same material class/specific material
//     if (!emissionDataEntry) {
//       // Find any entry with same materialClass and specificMaterial
//       const materialEntries = emissionData.filter(
//         data => data.materialClass === material.materialClass && 
//                 data.specificMaterial === material.specificMaterial
//       );
      
//       if (materialEntries.length > 0) {
//         // Use the first match
//         emissionDataEntry = materialEntries[0];
//         logger.debug(`Using alternative region ${materialEntries[0].countryOfOrigin} for ${material.materialClass}-${material.specificMaterial}`);
//       } else {
//         // Default data if all lookups fail
//         emissionDataEntry = { EmissionFactor: 0, EF_Source: 'Unknown',EF_Type:'Unknown',Type_Rationale:'Unknown' };
//       }
//     }
    
//     // Store the emission factor and EF_Source on the material for reference
//     material.emissionFactor = emissionDataEntry.EmissionFactor ;
//     material.EF_Source = emissionDataEntry.EF_Source;
//     material.EF_Type = emissionDataEntry.EF_Type;
//     material.Type_Rationale = emissionDataEntry.Type_Rationale
//     material.countryOfOrigin = emissionDataEntry.countryOfOrigin
//     // Log when using fallbacks for debugging (optional)
//     if (!emissionMap.get(specificKey) && (emissionMap.get(globalKey) || emissionMap.get(rowKey))) {
//       logger.debug(`Using fallback emission factor for ${material.materialClass}-${material.specificMaterial} from ${
//         emissionMap.get(globalKey) ? 'GLO' : 'RoW'
//       }`);
//     }
    
//     return total + material.emissionFactor;
//   }, 0);
// };
const regionToCountryCode = {

};
const isoToCountry = {
  IN: "India",
  US: "United States",
  CN: "China",
  RoW: 'RoW',
  ROW: 'RoW',
  Row: 'RoW',
  Germany: 'DE',
  Sweden: 'SE',
  China: 'CN',
  Global: 'GLO',
  GLO: 'GLO',
  Belgium : 'BE',
  Brazil : 'BR',
  Canada : 'CA',
  Egypt : 'EG',
  Thailand : 'EG',
  Italy : 'IT',
  Turkey : 'TR',
  // Add other mappings as needed
};

const normalize = str => str?.trim().toLowerCase();

const calculateRawMaterialEmissions = (materials, countryOfOrigin) => {
  console.log('executing RawMaterialEmissions', materials, countryOfOrigin);

  const fullCountry = isoToCountry[countryOfOrigin] || countryOfOrigin;

  // Create normalized map for fast lookup
  const emissionMap = new Map(
    emissionData.map((data) => {
      const key = `${normalize(data.countryOfOrigin)}-${normalize(data.materialClass)}-${normalize(data.specificMaterial)}`;
      return [key, data];
    })
  );

  return materials.reduce((total, material) => {

    const materialClass = normalize(material.materialClass);
    const specificMaterial = normalize(material.specificMaterial);
    const origin = normalize(fullCountry);

    const specificKey = `${origin}-${materialClass}-${specificMaterial}`;
    const globalKey = `glo-${materialClass}-${specificMaterial}`;
    const rowKey = `row-${materialClass}-${specificMaterial}`;

    let emissionDataEntry = 
      emissionMap.get(specificKey) || 
      emissionMap.get(globalKey) || 
      emissionMap.get(rowKey);

    if (!emissionDataEntry) {
      // Fallback: find first matching material class + specific material
      const materialEntries = emissionData.filter(data =>
        normalize(data.materialClass) === materialClass &&
        normalize(data.specificMaterial) === specificMaterial
      );

      if (materialEntries.length > 0) {
        emissionDataEntry = materialEntries[0];
        logger?.debug?.(`Using alternative region ${materialEntries[0].countryOfOrigin} for ${material.materialClass}-${material.specificMaterial}`);
      } else {
        emissionDataEntry = {
          EmissionFactor: 0,
          EF_Source: 'Unknown',
          EF_Type: 'Unknown',
          Type_Rationale: 'Unknown',
          countryOfOrigin: 'Unknown'
        };
      }
    }

    // Assign results back to the material
    material.specificMaterialEmissionFactor = emissionDataEntry.EmissionFactor;
    material.emissionFactor = emissionDataEntry.EmissionFactor * material.weight;
    material.EF_Source = emissionDataEntry.EF_Source;
    material.EF_Type = emissionDataEntry.EF_Type;
    material.Type_Rationale = emissionDataEntry.Type_Rationale;
    material.countryOfOrigin = emissionDataEntry.countryOfOrigin;

    if (!emissionMap.get(specificKey) && (emissionMap.get(globalKey) || emissionMap.get(rowKey))) {
      logger?.debug?.(`Using fallback emission factor for ${material.materialClass}-${material.specificMaterial} from ${emissionMap.get(globalKey) ? 'GLO' : 'RoW'}`);
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
  // Create a normalized lookup map for manufacturing processes
  const processMap = new Map();
  
  manufacturingProcesses.forEach(item => {
    const key = `${normalize(item['materialClass'])}-${normalize(item['specificMaterial'])}-${normalize(item['Process'])}-${normalize(item['countryOfOrigin'])}`;
    processMap.set(key, item['EmissionFactor']);
  });
  
  // Get the appropriate country name for lookup
  const fullCountry = isoToCountry[countryOfOrigin] || countryOfOrigin;
  
  logger.debug(`Calculating process emissions for country: ${fullCountry}`);
  
  return productManufacturingProcess.reduce((total, materialProcess) => {
    const processTotal = materialProcess.manufacturingProcesses.reduce(
      (sum, processGroup) => {
        const groupTotal = processGroup.processes.reduce(
          (innerSum, processName) => {
            // Try to find the emission factor in the new structure
            let emissionFactor = 0; // Direct emission factor in kg CO2/kg
            
            // Try different lookup strategies
            const materialClass = normalize(materialProcess.materialClass);
            const specificMaterial = normalize(materialProcess.specificMaterial);
            const process = normalize(processName);
            const country = normalize(fullCountry);
            
            // Try specific country first
            const specificKey = `${materialClass}-${specificMaterial}-${process}-${country}`;
            
            // Try global fallback
            const globalKey = `${materialClass}-${specificMaterial}-${process}-GLO`;
            
            // Try with different material combinations
            const materialOnlyKey = `${materialClass}-${specificMaterial}-${process}`;
            
            emissionFactor = processMap.get(specificKey) || 
                           processMap.get(globalKey) || 
                           0;
            
            // If still not found, try to find any matching process for this material class
            if (emissionFactor === 0) {
              for (const [key, value] of processMap.entries()) {
                if (key.includes(materialClass) && key.includes(process)) {
                  emissionFactor = value;
                  logger.debug(`Using fallback emission factor for ${materialClass}-${process}: ${emissionFactor}`);
                  break;
                }
              }
            }
            
            if (emissionFactor === 0) {
              logger.debug(`No emission factor found for ${materialClass}-${specificMaterial}-${process}. Using 0.`);
            }
            
            // Calculate emissions: emission factor (kg CO2/kg) * weight (kg)
            const calculatedEmission = emissionFactor * materialProcess.weight;
            
            // Store the emission factor for reference
            if (!materialProcess.processEmissions) {
              materialProcess.processEmissions = [];
            }
            
            materialProcess.processEmissions.push({
              process: processName,
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
 * Create or update product with AI processing
 * @param {Object} req - Request object
 * @param {Object} productData - Product data
 * @param {boolean} runAI - Whether to run AI classification
 * @returns {Object} - Created or updated product
 */
const createOrUpdateProductWithAI = async (req, productData, runAI = false) => {
  const { 
    classifyProduct, 
    classifyBOM, 
    classifyManufacturingProcess 
  } = require('../utils/chatGPTUtils');
  
  const Product = await getProductModel(req);
  const { code, name, description, weight, images } = productData;

  // Check if product with same code already exists
  const existingProduct = await Product.findOne({ code });

  let result = {
    isUpdate: !!existingProduct,
    product: null,
    aiProcessingRequired: runAI
  };

  if (runAI) {
    try {
      // Run AI classification
      const classifyResult = await classifyProduct(code, name, description, images?.[0], req);
      const classifyBOMResult = await classifyBOM(code, name, description, weight, images?.[0], req);
      const classifyManufacturingProcessResult = await classifyManufacturingProcess(
        code, name, description, classifyBOMResult, req
      );

      // Calculate emissions
      const co2EmissionRawMaterials = calculateRawMaterialEmissions(
        classifyBOMResult,
        productData.countryOfOrigin
      );
      const co2EmissionFromProcesses = calculateProcessEmissions(
        classifyManufacturingProcessResult,
        productData.countryOfOrigin
      );

      // Update product data with AI results
      productData.category = classifyResult.category;
      productData.subCategory = classifyResult.subcategory;
      productData.materials = classifyBOMResult;
      productData.productManufacturingProcess = classifyManufacturingProcessResult;
      productData.co2Emission = co2EmissionRawMaterials + co2EmissionFromProcesses;
      productData.co2EmissionRawMaterials = co2EmissionRawMaterials;
      productData.co2EmissionFromProcesses = co2EmissionFromProcesses;
      productData.aiProcessingStatus = 'completed';
    } catch (error) {
      logger?.error?.(`AI processing failed for product ${code}: ${error.message}`);
      productData.aiProcessingStatus = 'failed';
    }
  }

  // Set timestamps
  productData.modifiedDate = new Date();
  
  if (existingProduct) {
    // Update existing product
    logger?.info?.(`Updating existing product with code: ${code}`);
    productData.createdDate = existingProduct.createdDate;
    
    result.product = await Product.findOneAndUpdate(
      { code },
      productData,
      { new: true, runValidators: true }
    );
  } else {
    // Create new product
    logger?.info?.(`Creating new product with code: ${code}`);
    productData.createdDate = new Date();
    
    const newProduct = new Product(productData);
    result.product = await newProduct.save();
  }

  return result;
};

/**
 * Create a new product or update existing one if product code already exists
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

  // Check if product with same code already exists
  const existingProduct = await Product.findOne({ code });

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

  const productData = {
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
    co2Emission,
    co2EmissionRawMaterials,
    co2EmissionFromProcesses,
    productManufacturingProcess,
  };

  if (existingProduct) {
    // Update existing product with new data and re-calculated emissions
    logger?.info?.(`Updating existing product with code: ${code}`);
    
    // Preserve original creation date
    productData.createdDate = existingProduct.createdDate;
    
    // Update the existing product
    const updatedProduct = await Product.findOneAndUpdate(
      { code },
      productData,
      { new: true, runValidators: true }
    );
    
    return updatedProduct;
  } else {
    // Create new product
    logger?.info?.(`Creating new product with code: ${code}`);
    productData.createdDate = new Date();
    
    const newProduct = new Product(productData);
    return await newProduct.save();
  }
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
  
  // Get all products to calculate total AI tokens before deletion
  const products = await Product.find({}, 'ai_tokens');
  const totalAITokens = products.reduce((sum, product) => sum + (product.ai_tokens || 0), 0);
  
  const result = await Product.deleteMany({});
  return { ...result, totalAITokens };
};

/**
 * Delete product by ID
 */
const deleteProductByID = async (req) => {
  const { _id } = req.body;
  const Product = await getProductModel(req);
  
  // Get the product to retrieve AI tokens before deletion
  const product = await Product.findById(_id, 'ai_tokens');
  const ai_tokens = product ? product.ai_tokens || 0 : 0;
  
  const result = await Product.deleteOne({ _id });
  return { ...result, ai_tokens };
};

module.exports = {
  getProductModel,
  calculateRawMaterialEmissions,
  calculateProcessEmissions,
  createProduct,
  createOrUpdateProductWithAI,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  deleteAllProducts,
  deleteProductByID
};