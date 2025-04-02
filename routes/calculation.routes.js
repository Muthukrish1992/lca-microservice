const express = require('express');
const router = express.Router();
const calculationController = require('../controllers/calculation.controller');
const { validateAccount } = require('../middlewares/auth.middleware');

// Apply account validation middleware
router.use(validateAccount);

// Classification routes
router.post('/classify-product', calculationController.classifyProductController);
router.post('/classify-manufacturing-process', calculationController.classifyManufacturingProcessController);
router.post('/classify-bom', calculationController.classifyBOMController);

// Transport routes
router.get('/transportDB', calculationController.getTransportDB);
router.post('/distance', calculationController.getDistance);
router.post('/calculate-transport-emission', calculationController.calculateTransportEmission);

// Category routes
router.get('/categories', calculationController.getAllCategories);
router.get('/subcategories', calculationController.getSubcategories);
router.get('/productCategories', calculationController.getAllProductCategories);

// Bill of Materials route
router.get('/bill-of-materials', calculationController.getBillOfMaterials);

module.exports = router;