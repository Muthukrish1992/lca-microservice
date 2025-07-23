const express = require('express');
const router = express.Router();
const chunkUploadController = require('../controllers/chunkUpload.controller');
const { validateAccount } = require('../middlewares/auth.middleware');

// Apply the account validation middleware to all routes
router.use(validateAccount);

/**
 * Chunk Upload Routes
 * These routes handle large file uploads by breaking them into smaller chunks
 */

// Initialize a new chunk upload session
router.post('/init', chunkUploadController.initializeChunkUpload);

// Upload a single chunk
router.post('/chunk', 
  chunkUploadController.chunkUpload.single('chunk'), 
  chunkUploadController.uploadChunk
);

// Complete bulk product upload (assemble chunks and process)
router.post('/complete-bulk-upload', chunkUploadController.completeChunkUploadForBulkUpload);

// Complete bulk image upload (assemble chunks and process)
router.post('/complete-image-upload', chunkUploadController.completeChunkUploadForImageUpload);

// Get upload status
router.get('/status/:uploadId', chunkUploadController.getUploadStatus);

// Cancel/cleanup upload
router.delete('/:uploadId', chunkUploadController.cancelUpload);

console.log('✅ Chunk upload routes registered:', {
  'init': '✓',
  'chunk': '✓',
  'complete-bulk-upload': '✓',
  'complete-image-upload': '✓',
  'status': '✓',
  'cancel': '✓'
});

module.exports = router;