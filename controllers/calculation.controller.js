const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const { getAccountPlan } = require('../services/account.service');
const productCategories = require('../data/productCategories.json');
const materialsDatabase = require('../data/materials_database.json');
const transportDatabase = require('../data/transport_database.json');
const transportDatabaseBasic = require('../data/country_distances.json');
const portDistances = require('../data/port_distances.json');
const { 
  classifyProduct, 
  classifyBOM, 
  classifyBOMBasic, 
  classifyManufacturingProcess,
  classifyManufacturingProcessBasic 
} = require('../utils/chatGPTUtils');

/**
 * Classify product
 * @route POST /api/classify-product
 */
const classifyProductController = async (req, res) => {
  try {
    const { productCode, description, name } = req.body;

    if (!productCode || !name || !description) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        'Product code, name, and description are required.'
      ));
    }

    const result = await classifyProduct(productCode, name, description, req);
    res.status(HTTP_STATUS.OK).json(formatResponse(true, result));
  } catch (error) {
    logger.error('Error classifying product:', error);
    res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
      false,
      null,
      error.message
    ));
  }
};

/**
 * Classify manufacturing process
 * @route POST /api/classify-manufacturing-process
 */
const classifyManufacturingProcessController = async (req, res) => {
  try {
    const { productCode, name, description, bom } = req.body;

    if (!productCode || !name || !description || !bom) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Product code, name, description, and Bill of Materials are required."
      ));
    }

    const plan = await getAccountPlan(req);

    let result = {};
    if (plan.plan === "basic") {
      result = await classifyManufacturingProcessBasic(
        productCode,
        name,
        description,
        bom,
        req
      );
    } else {
      result = await classifyManufacturingProcess(
        productCode,
        name,
        description,
        bom,
        req
      );
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      { manufacturingProcess: result, plan: plan }
    ));
  } catch (error) {
    logger.error('Error classifying manufacturing process:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while processing your request.",
      { details: error.message }
    ));
  }
};

/**
 * Classify bill of materials
 * @route POST /api/classify-bom
 */
const classifyBOMController = async (req, res) => {
  try {
    const { productCode, name, description, weight, imageUrl } = req.body;

    if (!productCode || !name || !description || weight === undefined) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Product code, name, description, and weight are required."
      ));
    }

    const plan = await getAccountPlan(req);

    let result = {};
    if (plan.plan === "basic") {
      result = await classifyBOMBasic(
        productCode,
        name,
        description,
        weight,
        imageUrl,
        req
      );
    } else {
      result = await classifyBOM(
        productCode,
        name,
        description,
        weight,
        imageUrl,
        req
      );
    }

    const totalWeightCalculated = result.reduce(
      (sum, material) => sum + material.weight,
      0
    );

    if (Math.abs(totalWeightCalculated - weight) > 0.01) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Total weight of materials does not match the provided weight."
      ));
    }

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      { plan: plan.plan, bom: result }
    ));
  } catch (error) {
    logger.error('Error classifying BOM:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while processing your request.",
      { details: error.message }
    ));
  }
};

/**
 * Get transport database
 * @route GET /api/transportDB
 */
const getTransportDB = async (req, res) => {
  try {
    const plan = await getAccountPlan(req);
    if (plan.plan === "basic") {
      res.status(HTTP_STATUS.OK).json(formatResponse(
        true,
        {
          transportDatabase: Object.keys(transportDatabaseBasic),
          plan: plan
        }
      ));
    } else {
      res.status(HTTP_STATUS.OK).json(formatResponse(
        true,
        { transportDatabase: transportDatabase, plan: plan }
      ));
    }
  } catch (error) {
    logger.error('Error fetching transport database:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving transport database."
    ));
  }
};

/**
 * Get distance between locations
 * @route POST /api/distance
 */
const getDistance = async (req, res) => {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Origin and destination are required."
      ));
    }

    const plan = await getAccountPlan(req);

    let distance;

    if (plan.plan === "basic") {
      if (!transportDatabaseBasic[origin] || !transportDatabaseBasic[origin][destination]) {
        return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
          false,
          null,
          `Distance between '${origin}' and '${destination}' not found.`
        ));
      }
      distance = transportDatabaseBasic[origin][destination];
    } else {
      const originDistances = portDistances[origin];

      if (!originDistances) {
        return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
          false,
          null,
          `Origin port '${origin}' not found.`
        ));
      }

      distance = originDistances[destination];

      if (distance === undefined) {
        return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
          false,
          null,
          `Destination port '${destination}' not found for origin '${origin}'.`
        ));
      }
    }

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      { origin, destination, distance_in_km: distance }
    ));
  } catch (error) {
    logger.error('Error calculating distance:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving distance."
    ));
  }
};

/**
 * Calculate transport emission
 * @route POST /api/calculate-transport-emission
 */
const calculateTransportEmission = (req, res) => {
  const EMISSION_FACTORS = {
    SeaFreight: 0.119,
    RoadFreight: 0.16,
    RailFreight: 0.056,
    AirFreight: 0.801,
  };

  try {
    const { weightKg, transportMode, transportKm } = req.body;

    // Input validation
    if (!weightKg || !transportMode || !transportKm) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Missing required parameters: weightKg, transportMode, and transportKm are required."
      ));
    }

    if (!EMISSION_FACTORS[transportMode]) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        `Invalid transport mode: ${transportMode}. Valid modes are: ${Object.keys(EMISSION_FACTORS).join(', ')}.`
      ));
    }

    // Convert weight to tons
    const weightTon = weightKg / 1000;

    // Calculate emission
    const emissionFactor = EMISSION_FACTORS[transportMode];
    const totalEmission = weightTon * transportKm * emissionFactor;

    return res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      {
        transportEmissions: parseFloat(totalEmission.toFixed(2)),
        unit: "kg CO₂eq/unit",
        calculationMetadata: {
          weightTon,
          transportMode,
          transportKm,
          emissionFactor,
        },
      }
    ));
  } catch (error) {
    logger.error('Error calculating transport emission:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while calculating transport emission.",
      { details: error.message }
    ));
  }
};

/**
 * Get all categories
 * @route GET /api/categories
 */
const getAllCategories = (req, res) => {
  try {
    const categories = Object.keys(productCategories);
    res.status(HTTP_STATUS.OK).json(formatResponse(true, categories));
  } catch (error) {
    logger.error('Error retrieving categories:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving categories."
    ));
  }
};

/**
 * Get subcategories by category
 * @route GET /api/subcategories
 */
const getSubcategories = (req, res) => {
  try {
    const category = req.query.category;

    if (!category) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Category is required as a query parameter."
      ));
    }

    const subcategories = productCategories[category];

    if (!subcategories) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        `Category '${category}' not found.`
      ));
    }

    res.status(HTTP_STATUS.OK).json(formatResponse(true, subcategories));
  } catch (error) {
    logger.error('Error retrieving subcategories:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving subcategories."
    ));
  }
};

/**
 * Get all product categories
 * @route GET /api/productCategories
 */
const getAllProductCategories = (req, res) => {
  try {
    res.status(HTTP_STATUS.OK).json(formatResponse(true, productCategories));
  } catch (error) {
    logger.error('Error retrieving product categories:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving product categories."
    ));
  }
};

/**
 * Get bill of materials
 * @route GET /api/bill-of-materials
 */
const getBillOfMaterials = (req, res) => {
  try {
    // Get the category parameter from query string if it exists
    const category = req.query.category;
    
    // Convert materials database to the expected format (grouped by materialClass)
    const materialsByClass = {};
    
    materialsDatabase.forEach(material => {
      if (!materialsByClass[material.materialClass]) {
        materialsByClass[material.materialClass] = new Set();
      }
      materialsByClass[material.materialClass].add(material.specificMaterial);
    });
    
    // Convert Sets to sorted arrays
    const formattedMaterials = {};
    for (const [materialClass, materials] of Object.entries(materialsByClass)) {
      formattedMaterials[materialClass] = Array.from(materials).sort();
    }
    
    if (category) {
      // If a specific category is requested
      if (!formattedMaterials[category]) {
        return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
          false,
          null,
          `Category '${category}' not found in bill of materials.`
        ));
      }
      
      // Return materials for the requested category
      return res.status(HTTP_STATUS.OK).json(formatResponse(
        true, 
        { category, materials: formattedMaterials[category] }
      ));
    }
    
    // If no category specified, return the full structure
    res.status(HTTP_STATUS.OK).json(formatResponse(true, formattedMaterials));
  } catch (error) {
    logger.error('Error retrieving bill of materials:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving bill of materials."
    ));
  }
};

module.exports = {
  classifyProductController,
  classifyManufacturingProcessController,
  classifyBOMController,
  getTransportDB,
  getDistance,
  calculateTransportEmission,
  getAllCategories,
  getSubcategories,
  getAllProductCategories,
  getBillOfMaterials
};