const express = require("express");
const router = express.Router();
const projectSchema = require("../models/project_schema");
const { getModel, getAccount } = require("../utils/utils");

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
    res.status(201).json(savedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// // GET endpoint to fetch all projects
// router.get('/', async (req, res) => {
//     try {
//         const projects = await Project.find({})
//             .sort({ createdDate: -1 });

//         // Transform the data to match the expected format
//         const transformedProjects = projects.map(project => ({
//             projectCode: project.code,
//             projectName: project.name,
//             totalProjectImpact: project.totalProjectImpact || 0,
//             totalMaterialsImpact: project.totalMaterialsImpact || 0,
//             totalManufacturingImpact: project.totalManufacturingImpact || 0,
//             totalTransportationImpact: project.totalTransportationImpact || 0,
//             products: project.products || []
//         }));

//         res.json(transformedProjects);
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });

// // Add product impact to project
// router.post('/:projectId/products/:productId/impact', async (req, res) => {
//     try {
//         const { projectId, productId } = req.params;
//         const {
//             productImage,
//             totalImpact,
//             impactByMaterials,
//             impactByManufacturing,
//             impactByTransportation
//         } = req.body;

//         const project = await Project.findById(projectId);

//         if (!project) {
//             return res.status(404).json({ message: 'Project not found' });
//         }

//         // Check if product already exists in project
//         const existingProductIndex = project.products.findIndex(
//             p => p.productId.toString() === productId
//         );

//         const productData = {
//             productId,
//             productImage,
//             impacts: {
//                 totalImpact,
//                 impactByMaterials,
//                 impactByManufacturing,
//                 impactByTransportation
//             }
//         };

//         if (existingProductIndex !== -1) {
//             // Update existing product
//             project.products[existingProductIndex] = productData;
//         } else {
//             // Add new product
//             project.products.push(productData);
//         }

//         project.modifiedDate = new Date();
//         const updatedProject = await project.save();

//         res.status(200).json(updatedProject);
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });

// // Get project impacts
// router.get('/:projectId/impacts', async (req, res) => {
//     try {
//         const { projectId } = req.params;

//         const project = await Project.findById(projectId)
//             .populate('products.productId', 'name code'); // Populate product details

//         if (!project) {
//             return res.status(404).json({ message: 'Project not found' });
//         }

//         // Calculate total impacts across all products
//         const projectImpacts = {
//             totalProjectImpact: 0,
//             totalMaterialsImpact: 0,
//             totalManufacturingImpact: 0,
//             totalTransportationImpact: 0,
//             products: project.products.map(product => ({
//                 productName: product.productId.name,
//                 productCode: product.productId.code,
//                 productImage: product.productImage,
//                 impacts: product.impacts
//             }))
//         };

//         project.products.forEach(product => {
//             projectImpacts.totalProjectImpact += product.impacts.totalImpact || 0;
//             projectImpacts.totalMaterialsImpact += product.impacts.impactByMaterials || 0;
//             projectImpacts.totalManufacturingImpact += product.impacts.impactByManufacturing || 0;
//             projectImpacts.totalTransportationImpact += product.impacts.impactByTransportation || 0;
//         });

//         res.status(200).json({
//             projectCode: project.code,
//             projectName: project.name,
//             ...projectImpacts
//         });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });

module.exports = router;
