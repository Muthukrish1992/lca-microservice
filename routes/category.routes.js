const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

// Category routes
router.get('/categories', categoryController.getAllCategories);
router.get('/subcategories', categoryController.getSubcategories);
router.get('/productCategories', categoryController.getAllProductCategories);
router.get('/manufacturingProcesses', categoryController.getAllManufacturingProcesses);

module.exports = router;