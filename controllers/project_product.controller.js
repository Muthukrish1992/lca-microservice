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
    const {
      projectID,
      productID,
      packagingWeight,
      palletWeight,
      totalTransportationEmission,
      transportationLegs
    } = req.body;

    // Validate required fields
    try {
      validateRequiredFields(req.body, ['projectID', 'productID']);
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
        productID,
        packagingWeight,
        palletWeight,
        totalTransportationEmission,
        transportationLegs
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
          'A mapping for this project and product already exists'
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

module.exports = {
  createProjectProductMapping,
  getAllProjectProductMappings,
  getProjectProductMappingById,
  getProjectProductMappingsByProjectId,
  getProjectProductMappingsByProductId,
  updateProjectProductMapping,
  deleteProjectProductMapping,
  deleteProjectProductMappingsByProjectId
};