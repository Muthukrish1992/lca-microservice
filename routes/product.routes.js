const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const uploadController = require('../controllers/upload.controller');
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

// Product routes with ID
router.route('/:id')
  .get(productController.getProductById)
  .put(productController.updateProduct)
  .delete(productController.deleteProduct);

module.exports = router;