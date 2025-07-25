const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const uploadController = require('../controllers/upload.controller');
const statusController = require('../controllers/status.controller');
const aiQueueController = require('../controllers/aiQueue.controller');
const { validateAccount } = require('../middlewares/auth.middleware');

// Apply the account validation middleware to all routes
router.use(validateAccount);

// Main product routes
router.route('/')
  .post(productController.createProduct)
  .get(productController.getAllProducts)
  .delete(productController.deleteAllProducts);

// Bulk upload routes (must come before /:id routes to avoid conflicts)
router.post('/bulk-upload', uploadController.upload.single('file'), uploadController.bulkUploadProducts);
// Add timeout middleware for large file uploads
const timeoutMiddleware = (req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes
  next();
};

router.post('/bulk-image-upload', timeoutMiddleware, uploadController.upload.single('file'), uploadController.bulkImageUpload);
router.post('/trigger-ai-processing', uploadController.triggerAIProcessing);
router.post('/delete-product-by-id', productController.deleteProductByID);

// Status monitoring routes
router.get('/processing-status', statusController.getProcessingStatus);
router.get('/status/:productCode', statusController.getProductStatus);

// AI Queue management routes
router.get('/queue-status', aiQueueController.getQueueStatus);
router.post('/start-queue', aiQueueController.startQueue);
router.post('/stop-queue', aiQueueController.stopQueue);
router.post('/reset-failed', aiQueueController.resetFailedProducts);
router.get('/processing-stats', aiQueueController.getProcessingStats);
router.put('/queue-config', aiQueueController.updateQueueConfig);

// Product routes with ID
router.route('/:id')
  .get(productController.getProductById)
  .put(productController.updateProduct)
  .delete(productController.deleteProduct);

module.exports = router;