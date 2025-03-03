const express = require("express");
const router = express.Router();

const projectSchema = require("../models/project_schema");
const projectProductMapSchema = require("../models/project_product_map_schema");
const productSchema = require("../models/product_schema");

const { getModel, getAccount } = require("../utils/utils");

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

    res.status(201).json({ success: true, data: transformedProjects });
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
    const account = getAccount(req);
    const Project = await getProjectModel(req);
    const ProjectProductMap = await getModel(
        account,
      projectProductMapSchema,
      "ProjectProductMap"
    );
    

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Find all product mappings related to the project
    const productMappings = await ProjectProductMap.find({
      projectID: projectId,
    }).populate(
      "productID",
      "name code images co2Emission co2EmissionRawMaterials co2EmissionFromProcesses"
    );

    // Compute total impacts
    let totalProjectImpact = 0;
    let totalMaterialsImpact = 0;
    let totalManufacturingImpact = 0;
    let totalTransportationImpact = 0;

    const products = productMappings.map((mapping) => {
      const product = mapping.productID;

      totalMaterialsImpact += product.co2EmissionRawMaterials || 0;
      totalManufacturingImpact += product.co2EmissionFromProcesses || 0;
      totalTransportationImpact += mapping.totalTransportationEmission || 0;
      totalProjectImpact +=
        totalMaterialsImpact +
        totalManufacturingImpact +
        totalTransportationImpact;

      return {
        productName: product.name,
        productCode: product.code,
        productImage: product.images.length > 0 ? product.images[0] : null,
        impacts: {
          materialsImpact: product.co2EmissionRawMaterials || 0,
          manufacturingImpact: product.co2EmissionFromProcesses || 0,
          transportationImpact: mapping.totalTransportationEmission || 0,
          totalImpact:
            (product.co2EmissionRawMaterials || 0) +
            (product.co2EmissionFromProcesses || 0) +
            (mapping.totalTransportationEmission || 0),
        },
      };
    });

    res.status(HTTP_STATUS.OK).json({ success: true, data: {
        projectCode: project.code,
        projectName: project.name,
        totalProjectImpact,
        totalMaterialsImpact,
        totalManufacturingImpact,
        totalTransportationImpact,
        products,
      } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
