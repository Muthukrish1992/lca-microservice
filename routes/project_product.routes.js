const express = require('express');
const router = express.Router();
const projectProductController = require('../controllers/project_product.controller');
const { validateAccount } = require('../middlewares/auth.middleware');

// Apply account validation middleware
router.use(validateAccount);

// Base routes
router.route('/')
  .post(projectProductController.createProjectProductMapping)
  .get(projectProductController.getAllProjectProductMappings);

// Routes with ID
router.route('/:id')
  .get(projectProductController.getProjectProductMappingById)
  .put(projectProductController.updateProjectProductMapping)
  .delete(projectProductController.deleteProjectProductMapping);

// Project-specific routes
router.route('/project/:projectID')
  .get(projectProductController.getProjectProductMappingsByProjectId)
  .delete(projectProductController.deleteProjectProductMappingsByProjectId);

// Direct product management by project ID
router.route('/project/:projectID/product')
  .post(projectProductController.addProductToProjectByProjectId);

router.route('/project/:projectID/product/:productID')
  .delete(projectProductController.removeProductFromProjectByProjectId);

// Product-specific routes
router.route('/product/:productID')
  .get(projectProductController.getProjectProductMappingsByProductId);

// Single product management routes
router.route('/:id/product')
  .post(projectProductController.addProductToProject);

router.route('/:id/product/:productID')
  .delete(projectProductController.removeProductFromProject);

module.exports = router;