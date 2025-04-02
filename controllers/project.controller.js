const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const projectService = require('../services/project.service');
const projectProductService = require('../services/project_product.service');
const { getAccountPlan } = require('../services/account.service');

/**
 * Create a new project
 * @route POST /api/projects
 */
const createProject = async (req, res) => {
  try {
    const { code, name } = req.body;
    
    if (!code || !name) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        'Project code and name are required'
      ));
    }
    
    const savedProject = await projectService.createProject(req, { code, name });
    
    res.status(HTTP_STATUS.CREATED).json(formatResponse(true, savedProject));
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error creating project: ${error.message}`
    ));
  }
};

/**
 * Get all projects
 * @route GET /api/projects
 */
const getAllProjects = async (req, res) => {
  try {
    const projects = await projectService.getAllProjects(req);
    const plan = await getAccountPlan(req);
    
    // Transform the data to match the expected format
    const transformedProjects = projects.map((project) => ({
      _id: project._id,
      projectCode: project.code,
      projectName: project.name,
      totalProjectImpact: project.totalProjectImpact || 0,
      totalMaterialsImpact: project.totalMaterialsImpact || 0,
      totalManufacturingImpact: project.totalManufacturingImpact || 0,
      totalTransportationImpact: project.totalTransportationImpact || 0,
      products: project.products || [],
    }));
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      { projects: transformedProjects, plan: plan }
    ));
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error fetching projects: ${error.message}`
    ));
  }
};

/**
 * Get project by ID
 * @route GET /api/projects/:id
 */
const getProjectById = async (req, res) => {
  try {
    const project = await projectService.getProjectById(req, req.params.id);
    
    if (!project) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Project not found'
      ));
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(true, project));
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error fetching project: ${error.message}`
    ));
  }
};

/**
 * Update project
 * @route PUT /api/projects/:id
 */
const updateProject = async (req, res) => {
  try {
    const updatedProject = await projectService.updateProject(req, req.params.id, req.body);
    
    if (!updatedProject) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Project not found'
      ));
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(true, updatedProject));
  } catch (error) {
    logger.error('Error updating project:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error updating project: ${error.message}`
    ));
  }
};

/**
 * Delete project
 * @route DELETE /api/projects/:id
 */
const deleteProject = async (req, res) => {
  try {
    const project = await projectService.deleteProject(req, req.params.id);
    
    if (!project) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Project not found'
      ));
    }
    
    // Also delete all project-product mappings for this project
    await projectProductService.deleteProjectProductMappingsByProjectId(req, req.params.id);
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      null,
      'Project and all associated product mappings deleted successfully'
    ));
  } catch (error) {
    logger.error('Error deleting project:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error deleting project: ${error.message}`
    ));
  }
};

/**
 * Delete all projects
 * @route DELETE /api/projects
 */
const deleteAllProjects = async (req, res) => {
  try {
    // Delete all project-product mappings first
    await projectProductService.getProjectProductMapModel(req).then(model => 
      model.deleteMany({})
    );
    
    // Then delete all projects
    const result = await projectService.deleteAllProjects(req);
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      { deletedCount: result.deletedCount },
      `Successfully deleted ${result.deletedCount} projects and all associated product mappings`
    ));
  } catch (error) {
    logger.error('Error deleting all projects:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error deleting projects: ${error.message}`
    ));
  }
};

/**
 * Get project impacts
 * @route POST /api/projects/impacts
 */
const getProjectImpacts = async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        'Project ID is required'
      ));
    }
    
    // Get project and its impacts
    const projectImpacts = await projectService.calculateProjectImpacts(req, projectId);
    
    if (!projectImpacts) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        'Project not found'
      ));
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(true, projectImpacts));
  } catch (error) {
    logger.error('Error calculating project impacts:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Error calculating project impacts: ${error.message}`
    ));
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  deleteAllProjects,
  getProjectImpacts
};