const logger = require('../utils/logger');
const { getModel } = require('../config/database');
const projectSchema = require('../models/project_schema');
const productSchema = require('../models/product_schema');
const projectProductMapSchema = require('../models/project_product_map_schema');
const { getAccount } = require('../middlewares/auth.middleware');

/**
 * Get project model for the current account
 */
const getProjectModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, projectSchema, "Project");
};

/**
 * Get product model for the current account
 */
const getProductModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, productSchema, "Product");
};

/**
 * Get project-product mapping model for the current account
 */
const getProjectProductMapModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, projectProductMapSchema, "ProjectProductMap");
};

/**
 * Get all projects
 */
const getAllProjects = async (req) => {
  const Project = await getProjectModel(req);
  return await Project.find().sort({ createdDate: -1 }).lean();
};

/**
 * Get project by ID
 */
const getProjectById = async (req, id) => {
  const Project = await getProjectModel(req);
  return await Project.findById(id);
};

/**
 * Create a new project
 */
const createProject = async (req) => {
  const Project = await getProjectModel(req);
  const project = new Project({
    ...req.body,
    createdDate: new Date(),
    modifiedDate: new Date()
  });
  return await project.save();
};

/**
 * Update a project
 */
const updateProject = async (req, id) => {
  const Project = await getProjectModel(req);
  return await Project.findByIdAndUpdate(
    id,
    { ...req.body, modifiedDate: new Date() },
    { new: true, runValidators: true }
  );
};

/**
 * Delete a project
 */
const deleteProject = async (req, id) => {
  const Project = await getProjectModel(req);
  return await Project.findByIdAndDelete(id);
};

/**
 * Delete all projects
 */
const deleteAllProjects = async (req) => {
  const Project = await getProjectModel(req);
  return await Project.deleteMany({});
};

/**
 * Calculate project impacts
 */
const calculateProjectImpacts = async (req, projectId) => {
  const Project = await getProjectModel(req);
  const ProductModel = await getProductModel(req);
  const ProjectProductMapModel = await getProjectProductMapModel(req);
  
  // Find the project
  const project = await Project.findById(projectId);
  if (!project) {
    return null;
  }
  
  // Find the project-product mapping for the project
  const projectMappings = await ProjectProductMapModel.find({
    projectID: projectId
  });
  
  if (!projectMappings || projectMappings.length === 0) {
    return {
      projectCode: project.code,
      projectName: project.name,
      totalProjectImpact: 0,
      totalMaterialsImpact: 0,
      totalManufacturingImpact: 0,
      totalTransportationImpact: 0,
      products: []
    };
  }
  
  // Initialize totals
  let totalMaterialsImpact = 0;
  let totalManufacturingImpact = 0;
  let totalTransportationImpact = 0;
  
  // Create a flattened array of all products from all mappings
  let allProductDetails = [];
  
  // Process each mapping
  for (const mapping of projectMappings) {
    // Process each product in the mapping
    for (const productEntry of mapping.products) {
      // Fetch the full product details
      const productDetails = await ProductModel.findById(productEntry.productID).select(
        'name code images co2Emission co2EmissionRawMaterials co2EmissionFromProcesses materials productManufacturingProcess'
      );
      
      // Check if product details exist
      if (!productDetails) {
        allProductDetails.push({
          productName: 'Unknown',
          productCode: 'Unknown',
          materials: [],
          productManufacturingProcess: [],
          co2EmissionRawMaterials: 0,
          co2EmissionFromProcesses: 0,
          transportationEmission: 0,
          transportationLegs: productEntry.transportationLegs || [],
          packagingWeight: productEntry.packagingWeight || 0,
          palletWeight: productEntry.palletWeight || 0,
          images: null,
          impacts: {
            materialsImpact: 0,
            manufacturingImpact: 0,
            transportationImpact: 0,
            totalImpact: 0
          }
        });
        continue;
      }
      
      // Calculate impacts
      const materialsImpact = productDetails.co2EmissionRawMaterials || 0;
      const manufacturingImpact = productDetails.co2EmissionFromProcesses || 0;
      const transportationImpact = productEntry.totalTransportationEmission || 0;
      
      // Add to running totals
      totalMaterialsImpact += materialsImpact;
      totalManufacturingImpact += manufacturingImpact;
      totalTransportationImpact += transportationImpact;
      
      // Add product details to the result array
      allProductDetails.push({
        productName: productDetails.name,
        productCode: productDetails.code,
        materials: productDetails.materials || [],
        productManufacturingProcess: productDetails.productManufacturingProcess || [],
        co2EmissionRawMaterials: materialsImpact,
        co2EmissionFromProcesses: manufacturingImpact,
        transportationEmission: transportationImpact,
        transportationLegs: productEntry.transportationLegs || [],
        packagingWeight: productEntry.packagingWeight || 0,
        palletWeight: productEntry.palletWeight || 0,
        images: productDetails.images && productDetails.images.length > 0 ? productDetails.images[0] : null,
        impacts: {
          materialsImpact,
          manufacturingImpact,
          transportationImpact,
          totalImpact: materialsImpact + manufacturingImpact + transportationImpact
        }
      });
    }
  }
  
  const products = allProductDetails;
  
  // Calculate total project impact
  const totalProjectImpact = parseFloat(
    (totalMaterialsImpact + totalManufacturingImpact + totalTransportationImpact).toFixed(2)
  );
  
  // Format all values to 2 decimal places
  totalMaterialsImpact = parseFloat(totalMaterialsImpact.toFixed(2));
  totalManufacturingImpact = parseFloat(totalManufacturingImpact.toFixed(2));
  totalTransportationImpact = parseFloat(totalTransportationImpact.toFixed(2));
  
  // Update project with impact information
  await Project.findByIdAndUpdate(projectId, {
    totalProjectImpact,
    totalMaterialsImpact,
    totalManufacturingImpact,
    totalTransportationImpact,
    modifiedDate: new Date()
  });
  
  return {
    projectCode: project.code,
    projectName: project.name,
    totalProjectImpact,
    totalMaterialsImpact,
    totalManufacturingImpact,
    totalTransportationImpact,
    products
  };
};

module.exports = {
  getProjectModel,
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  deleteAllProjects,
  calculateProjectImpacts
};