const logger = require('../utils/logger');
const { getModel } = require('../config/database');
const projectProductMapSchema = require('../models/project_product_map_schema');
const { getAccount } = require('../middlewares/auth.middleware');

/**
 * Get project-product mapping model for the current account
 * @param {Object} req - Express request object
 * @returns {Object} Mongoose model
 */
const getProjectProductMapModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, projectProductMapSchema, "ProjectProductMap");
};

/**
 * Create a new project-product mapping
 * @param {Object} req - Express request object
 * @param {Object} mappingData - Mapping data (projectID, productID, etc.)
 * @returns {Object} Created mapping
 */
const createProjectProductMapping = async (req, mappingData) => {
  const ProjectProductMap = await getProjectProductMapModel(req);
  
  // Create new mapping
  const projectProductMapping = new ProjectProductMap({
    ...mappingData,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Save to database
  return await projectProductMapping.save();
};

/**
 * Get all project-product mappings
 * @param {Object} req - Express request object
 * @returns {Array} List of mappings
 */
const getAllProjectProductMappings = async (req) => {
  const ProjectProductMap = await getProjectProductMapModel(req);
  return await ProjectProductMap.find().sort({ createdAt: -1 });
};

/**
 * Get project-product mapping by ID
 * @param {Object} req - Express request object
 * @param {String} id - Mapping ID
 * @returns {Object} Mapping or null if not found
 */
const getProjectProductMappingById = async (req, id) => {
  const ProjectProductMap = await getProjectProductMapModel(req);
  return await ProjectProductMap.findById(id);
};

/**
 * Get project-product mappings by project ID
 * @param {Object} req - Express request object
 * @param {String} projectID - Project ID
 * @returns {Array} List of mappings
 */
const getProjectProductMappingsByProjectId = async (req, projectID) => {
  const ProjectProductMap = await getProjectProductMapModel(req);
  return await ProjectProductMap.find({ projectID }).sort({ createdAt: -1 });
};

/**
 * Get project-product mappings by product ID
 * @param {Object} req - Express request object
 * @param {String} productID - Product ID
 * @returns {Array} List of mappings
 */
const getProjectProductMappingsByProductId = async (req, productID) => {
  const ProjectProductMap = await getProjectProductMapModel(req);
  return await ProjectProductMap.find({ "products.productID": productID }).sort({ createdAt: -1 });
};

/**
 * Update project-product mapping
 * @param {Object} req - Express request object
 * @param {String} id - Mapping ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated mapping
 */
const updateProjectProductMapping = async (req, id, updateData) => {
  const ProjectProductMap = await getProjectProductMapModel(req);
  
  // Don't allow changing project ID to prevent inconsistency
  const sanitizedData = { ...updateData };
  delete sanitizedData.projectID;
  sanitizedData.modifiedDate = new Date();
  
  return await ProjectProductMap.findByIdAndUpdate(
    id,
    sanitizedData,
    { new: true, runValidators: true }
  );
};

/**
 * Delete project-product mapping
 * @param {Object} req - Express request object
 * @param {String} id - Mapping ID
 * @returns {Object} Deleted mapping or null if not found
 */
const deleteProjectProductMapping = async (req, id) => {
  const ProjectProductMap = await getProjectProductMapModel(req);
  return await ProjectProductMap.findByIdAndDelete(id);
};

/**
 * Delete all project-product mappings for a project
 * @param {Object} req - Express request object
 * @param {String} projectID - Project ID
 * @returns {Object} Delete result with deletedCount
 */
const deleteProjectProductMappingsByProjectId = async (req, projectID) => {
  const ProjectProductMap = await getProjectProductMapModel(req);
  return await ProjectProductMap.deleteMany({ projectID });
};

module.exports = {
  getProjectProductMapModel,
  createProjectProductMapping,
  getAllProjectProductMappings,
  getProjectProductMappingById,
  getProjectProductMappingsByProjectId,
  getProjectProductMappingsByProductId,
  updateProjectProductMapping,
  deleteProjectProductMapping,
  deleteProjectProductMappingsByProjectId
};