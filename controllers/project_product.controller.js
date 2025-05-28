const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const projectProductService = require('../services/project_product.service');
const { validateRequiredFields } = require('../utils/helpers');

/**
 * Create a new project-product mapping
 * @route POST /api/project-product-mapping
 */
const createProjectProductMapping = async (req, res) => {
  try {
    const { projectID, products } = req.body;

    // Validate required fields
    try {
      validateRequiredFields(req.body, ['projectID', 'products']);
      
      if (!Array.isArray(products) || products.length === 0) {
        throw new Error('products must be a non-empty array');
      }
      
      // Validate each product in the array
      products.forEach((product, index) => {
        try {
          validateRequiredFields(product, ['productID']);
        } catch (error) {
          throw new Error(`Product at index ${index}: ${error.message}`);
        }
      });
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        error.message
      ));
    }

    // Create mapping
    try {
      const savedMapping = await projectProductService.createProjectProductMapping(req, {
        projectID,
        products
      });

      return res.status(HTTP_STATUS.CREATED).json(formatResponse(
        true,
        savedMapping,
        'Project-Product mapping created successfully'
      ));
    } catch (error) {
      // Handle duplicate key error
      if (error.code === 11000) {
        return res.status(HTTP_STATUS.CONFLICT).json(formatResponse(
          false,
          null,
          'A mapping for this project already exists'
        ));
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error creating project-product mapping:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error creating project-product mapping: ${error.message}`
    ));
  }
};

/**
 * Get all project-product mappings
 * @route GET /api/project-product-mapping
 */
const getAllProjectProductMappings = async (req, res) => {
  try {
    const mappings = await projectProductService.getAllProjectProductMappings(req);
    res.status(HTTP_STATUS.OK).json(formatResponse(true, mappings));
  } catch (error) {
    logger.error('Error fetching project-product mappings:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error fetching project-product mappings: ${error.message}`
    ));
  }
};

/**
 * Get project-product mapping by ID
 * @route GET /api/project-product-mapping/:id
 */
const getProjectProductMappingById = async (req, res) => {
  try {
    const mapping = await projectProductService.getProjectProductMappingById(req, req.params.id);
    
    if (!mapping) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Project-Product mapping not found'
      ));
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(true, mapping));
  } catch (error) {
    logger.error('Error fetching project-product mapping:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error fetching project-product mapping: ${error.message}`
    ));
  }
};

/**
 * Get project-product mappings by project ID
 * @route GET /api/project-product-mapping/project/:projectID
 */
const getProjectProductMappingsByProjectId = async (req, res) => {
  try {
    const mappings = await projectProductService.getProjectProductMappingsByProjectId(
      req, 
      req.params.projectID
    );
    
    res.status(HTTP_STATUS.OK).json(formatResponse(true, mappings));
  } catch (error) {
    logger.error('Error fetching project-product mappings by project ID:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error fetching project-product mappings: ${error.message}`
    ));
  }
};

/**
 * Get project-product mappings by product ID
 * @route GET /api/project-product-mapping/product/:productID
 */
const getProjectProductMappingsByProductId = async (req, res) => {
  try {
    const mappings = await projectProductService.getProjectProductMappingsByProductId(
      req, 
      req.params.productID
    );
    
    res.status(HTTP_STATUS.OK).json(formatResponse(true, mappings));
  } catch (error) {
    logger.error('Error fetching project-product mappings by product ID:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error fetching project-product mappings: ${error.message}`
    ));
  }
};

/**
 * Update project-product mapping by ID
 * @route PUT /api/project-product-mapping/:id
 */
const updateProjectProductMapping = async (req, res) => {
  try {
    // Validate products array if it exists in the request
    if (req.body.products) {
      try {
        if (!Array.isArray(req.body.products)) {
          throw new Error('products must be an array');
        }
        
        // Validate each product in the array if not empty
        if (req.body.products.length > 0) {
          req.body.products.forEach((product, index) => {
            try {
              validateRequiredFields(product, ['productID']);
            } catch (error) {
              throw new Error(`Product at index ${index}: ${error.message}`);
            }
          });
        }
      } catch (error) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
          false,
          null,
          error.message
        ));
      }
    }

    const updatedMapping = await projectProductService.updateProjectProductMapping(
      req, 
      req.params.id, 
      req.body
    );
    
    if (!updatedMapping) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Project-Product mapping not found'
      ));
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true, 
      updatedMapping, 
      'Project-Product mapping updated successfully'
    ));
  } catch (error) {
    logger.error('Error updating project-product mapping:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error updating project-product mapping: ${error.message}`
    ));
  }
};

/**
 * Delete project-product mapping by ID
 * @route DELETE /api/project-product-mapping/:id
 */
const deleteProjectProductMapping = async (req, res) => {
  try {
    const result = await projectProductService.deleteProjectProductMapping(req, req.params.id);
    
    if (!result) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Project-Product mapping not found'
      ));
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      null,
      'Project-Product mapping deleted successfully'
    ));
  } catch (error) {
    logger.error('Error deleting project-product mapping:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error deleting project-product mapping: ${error.message}`
    ));
  }
};

/**
 * Delete all project-product mappings for a project
 * @route DELETE /api/project-product-mapping/project/:projectID
 */
const deleteProjectProductMappingsByProjectId = async (req, res) => {
  try {
    const result = await projectProductService.deleteProjectProductMappingsByProjectId(
      req, 
      req.params.projectID
    );
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      { deletedCount: result.deletedCount },
      'Project-Product mappings deleted successfully'
    ));
  } catch (error) {
    logger.error('Error deleting project-product mappings by project ID:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error deleting project-product mappings: ${error.message}`
    ));
  }
};

/**
 * Add a product to an existing project mapping
 * @route POST /api/project-product-mapping/:id/product
 */
const addProductToProject = async (req, res) => {
  try {
    const { id } = req.params;
    const productData = req.body;

    // Validate product data
    try {
      validateRequiredFields(productData, ['productID']);
    } catch (error) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        error.message
      ));
    }

    // Get existing mapping
    const ProjectProductMap = await projectProductService.getProjectProductMapModel(req);
    const mapping = await ProjectProductMap.findById(id);
    
    if (!mapping) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Project-Product mapping not found'
      ));
    }
    
    // Check if product already exists in the mapping
    const productExists = mapping.products.some(
      p => p.productID.toString() === productData.productID.toString()
    );
    
    if (productExists) {
      return res.status(HTTP_STATUS.CONFLICT).json(formatResponse(
        false,
        null,
        'Product already exists in this project mapping'
      ));
    }
    
    // Add product to mapping
    mapping.products.push(productData);
    mapping.modifiedDate = new Date();
    const updatedMapping = await mapping.save();
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      updatedMapping,
      'Product added to project successfully'
    ));
  } catch (error) {
    logger.error('Error adding product to project:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error adding product to project: ${error.message}`
    ));
  }
};

/**
 * Remove a product from an existing project mapping
 * @route DELETE /api/project-product-mapping/:id/product/:productID
 */
const removeProductFromProject = async (req, res) => {
  try {
    const { id, productID } = req.params;

    // Get existing mapping
    const ProjectProductMap = await projectProductService.getProjectProductMapModel(req);
    const mapping = await ProjectProductMap.findById(id);
    
    if (!mapping) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Project-Product mapping not found'
      ));
    }
    
    // Find product index
    const productIndex = mapping.products.findIndex(
      p => p.productID.toString() === productID
    );
    
    if (productIndex === -1) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Product not found in this project mapping'
      ));
    }
    
    // Remove product from mapping
    mapping.products.splice(productIndex, 1);
    mapping.modifiedDate = new Date();
    const updatedMapping = await mapping.save();
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      updatedMapping,
      'Product removed from project successfully'
    ));
  } catch (error) {
    logger.error('Error removing product from project:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error removing product from project: ${error.message}`
    ));
  }
};

module.exports = {
  createProjectProductMapping,
  getAllProjectProductMappings,
  getProjectProductMappingById,
  getProjectProductMappingsByProjectId,
  getProjectProductMappingsByProductId,
  updateProjectProductMapping,
  deleteProjectProductMapping,
  deleteProjectProductMappingsByProjectId,
  addProductToProject,
  removeProductFromProject
};