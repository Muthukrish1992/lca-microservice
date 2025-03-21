const express = require("express");
const router = express.Router();

const projectSchema = require("../models/project_schema");
const projectProductMapSchema = require('../models/project_product_map_schema');
const productSchema = require("../models/product_schema");

const { getModel, getAccount ,getAccountPlan} = require("../utils/utils");

// Constants that will be used across different routes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

const getProjectModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, projectSchema, "Project");
};

const getProjectProductMapModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, projectProductMapSchema, "ProjectProductMap");
};

const getProductModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, productSchema, "Product");
};

// Create Project
router.post("/", async (req, res) => {
  try {
    const { code, name } = req.body;

    const Project = await getProjectModel(req);

    const newProject = new Project({
      code,
      name,
    });

    const savedProject = await newProject.save();
    res.status(HTTP_STATUS.OK).json({ success: true, data: savedProject });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET endpoint to fetch all projects
// router.get("/", async (req, res) => {
//   try {
//     const Project = await getProjectModel(req);
//     const projects = await Project.find().lean();
//     res.status(HTTP_STATUS.OK).json({ success: true, data: projects });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// } );

// GET endpoint to fetch all projects
router.get("/", async (req, res) => {
  try {
    const Project = await getProjectModel(req);
    const projects = await Project.find({}).sort({ createdDate: -1 });

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

    res.status(201).json({ success: true, data: { projects : transformedProjects , plan : plan} });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add product impact to project
router.post("/:projectId/products/:productId/impact", async (req, res) => {
  try {
    const { projectId, productId } = req.params;
    const {
      productImage,
      totalImpact,
      impactByMaterials,
      impactByManufacturing,
      impactByTransportation,
    } = req.body;

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check if product already exists in project
    const existingProductIndex = project.products.findIndex(
      (p) => p.productId.toString() === productId
    );

    const productData = {
      productId,
      productImage,
      impacts: {
        totalImpact,
        impactByMaterials,
        impactByManufacturing,
        impactByTransportation,
      },
    };

    if (existingProductIndex !== -1) {
      // Update existing product
      project.products[existingProductIndex] = productData;
    } else {
      // Add new product
      project.products.push(productData);
    }

    project.modifiedDate = new Date();
    const updatedProject = await project.save();

    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get project impacts
router.post("/impacts", async (req, res) => {
  try {
    const { projectId } = req.body;

    const Project = await getProjectModel(req);
    const ProjectProductMap = await getProjectProductMapModel(req);
    const Product = await getProductModel(req); // must declaration DONT remove
    
    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Find all product mappings related to the project
    const productMappings = await ProjectProductMap.find({
      projectID: projectId,
    }).populate({
      path: "productID",
      model: "Product", // Explicitly specify the model name
      select: "name code images co2Emission co2EmissionRawMaterials co2EmissionFromProcesses materials productManufacturingProcess"
    });
    
    // Initialize totals
    let totalMaterialsImpact = 0;
    let totalManufacturingImpact = 0;
    let totalTransportationImpact = 0;

    const products = productMappings.map((mapping) => {
      // Check if productID exists
      if (!mapping.productID) {
        return {
          productName: "Unknown",
          productCode: "Unknown",
          materials: [],
          productManufacturingProcess: [],
          co2EmissionRawMaterials: 0,
          co2EmissionFromProcesses: 0,
          transportationEmission: 0,
          transportationLegs: [],
          packagingWeight: mapping.packagingWeight || 0,
          palletWeight: mapping.palletWeight || 0,
          productImage: null,
          impacts: {
            materialsImpact: 0,
            manufacturingImpact: 0,
            transportationImpact: 0,
            totalImpact: 0,
          },
        };
      }
      
      const product = mapping.productID;
      const materialsImpact = product.co2EmissionRawMaterials || 0;
      const manufacturingImpact = product.co2EmissionFromProcesses || 0;
      const transportationImpact = mapping.totalTransportationEmission || 0;
      
      // Add to running totals
      totalMaterialsImpact += materialsImpact;
      totalManufacturingImpact += manufacturingImpact;
      totalTransportationImpact += transportationImpact;

      return {
        productName: product.name,
        productCode: product.code,
        materials: product.materials || [],
        productManufacturingProcess: product.productManufacturingProcess || [],
        co2EmissionRawMaterials: materialsImpact,
        co2EmissionFromProcesses: manufacturingImpact,
        transportationEmission: transportationImpact,
        transportationLegs: mapping.transportationLegs || [],
        packagingWeight: mapping.packagingWeight || 0,
        palletWeight: mapping.palletWeight || 0,
        productImage: product.images && product.images.length > 0 ? product.images[0] : null,
        impacts: {
          materialsImpact,
          manufacturingImpact,
          transportationImpact,
          totalImpact: materialsImpact + manufacturingImpact + transportationImpact,
        },
      };
    });

    // Calculate total project impact AFTER processing all products
    const totalProjectImpact = totalMaterialsImpact + totalManufacturingImpact + totalTransportationImpact;

    res.status(HTTP_STATUS.OK).json({ 
      success: true, 
      data: {
        projectCode: project.code,
        projectName: project.name,
        totalProjectImpact,
        totalMaterialsImpact,
        totalManufacturingImpact,
        totalTransportationImpact,
        products,
      } 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
