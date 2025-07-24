const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const chunkUploadManager = require('../utils/chunkUpload');
const { getAccount, getOriginUrl } = require('../middlewares/auth.middleware');

// Set up multer for chunk uploads (memory storage for small chunks)
const chunkStorage = multer.memoryStorage();
const chunkUpload = multer({ 
  storage: chunkStorage,
  limits: { 
    fileSize: 20 * 1024 * 1024 // 20MB per chunk (increased from 10MB for better efficiency)
  }
});

/**
 * Initialize a chunked upload session
 * POST /api/products/chunk-upload/init
 */
const initializeChunkUpload = async (req, res) => {
  try {
    const { filename, totalSize, totalChunks, fileHash } = req.body;
    const account = getAccount(req);

    // Validate required parameters
    if (!filename || !totalSize || !totalChunks) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Missing required parameters: filename, totalSize, totalChunks"
      ));
    }

    // Generate unique upload ID
    const uploadId = uuidv4();

    // Initialize the upload session
    const fileInfo = await chunkUploadManager.initializeUpload(
      uploadId, 
      account, 
      filename, 
      parseInt(totalSize), 
      parseInt(totalChunks),
      fileHash
    );

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      {
        uploadId: uploadId,
        filename: filename,
        totalChunks: parseInt(totalChunks),
        chunkSize: Math.ceil(totalSize / totalChunks)
      },
      "Upload session initialized successfully"
    ));

  } catch (error) {
    logger.error("Error initializing chunk upload:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to initialize upload: ${error.message}`
    ));
  }
};

/**
 * Upload a single chunk
 * POST /api/products/chunk-upload/chunk
 */
const uploadChunk = async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    const account = getAccount(req);

    // Validate required parameters
    if (!uploadId || chunkIndex === undefined || !req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Missing required parameters: uploadId, chunkIndex, and file chunk"
      ));
    }

    const chunkIndexNum = parseInt(chunkIndex);

    // Store the chunk
    const result = await chunkUploadManager.storeChunk(
      uploadId,
      account,
      chunkIndexNum,
      req.file.buffer
    );

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      {
        uploadId: uploadId,
        chunkIndex: chunkIndexNum,
        receivedChunks: result.receivedChunks,
        totalChunks: result.totalChunks,
        isComplete: result.isComplete,
        progress: Math.round((result.receivedChunks / result.totalChunks) * 100)
      },
      `Chunk ${chunkIndexNum + 1}/${result.totalChunks} uploaded successfully`
    ));

  } catch (error) {
    logger.error("Error uploading chunk:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to upload chunk: ${error.message}`
    ));
  }
};

/**
 * Complete chunk upload and assemble file for bulk product upload
 * POST /api/products/chunk-upload/complete-bulk-upload
 */
const completeChunkUploadForBulkUpload = async (req, res) => {
  try {
    const { uploadId } = req.body;
    const account = getAccount(req);

    if (!uploadId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Missing uploadId parameter"
      ));
    }

    // Check if upload is complete
    const isComplete = await chunkUploadManager.isUploadComplete(uploadId, account);
    if (!isComplete) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Upload is not complete. Some chunks are missing."
      ));
    }

    // Assemble the file
    const assembledFile = await chunkUploadManager.assembleFile(uploadId, account);

    // Create a mock req.file object for the existing bulkUploadProducts function
    const mockReq = {
      ...req,
      headers: req.headers || {}, // Ensure headers exist
      protocol: req.protocol || 'http',
      get: req.get || ((headerName) => req.headers && req.headers[headerName.toLowerCase()]),
      file: {
        originalname: assembledFile.filename,
        path: assembledFile.filePath,
        size: assembledFile.size,
        mimetype: getContentType(assembledFile.filename)
      }
    };

    // Debug logging
    logger.info(`🔍 mockReq headers: ${JSON.stringify(mockReq.headers)}`);
    const mockAccount = getAccount(mockReq);
    logger.info(`🔍 Account from mockReq: ${mockAccount}`);
    
    if (!mockAccount) {
      throw new Error('Account header missing in mock request for bulk upload processing');
    }

    // Import and call the existing bulkUploadProducts function
    const { bulkUploadProducts } = require('./upload.controller');
    
    // Override res.json to capture the response and add cleanup
    const originalJson = res.json;
    res.json = function(data) {
      // Clean up assembled file and chunks after processing
      setImmediate(async () => {
        try {
          await fs.unlink(assembledFile.filePath);
          await chunkUploadManager.cleanupUpload(uploadId, account);
          logger.info(`🧹 Cleaned up assembled file and chunks for upload: ${uploadId}`);
        } catch (cleanupError) {
          logger.error('Error cleaning up after bulk upload:', cleanupError);
        }
      });
      
      return originalJson.call(this, data);
    };

    // Call the existing bulk upload function
    await bulkUploadProducts(mockReq, res);

  } catch (error) {
    logger.error("Error completing chunk upload for bulk upload:", error);
    
    // Clean up on error
    try {
      await chunkUploadManager.cleanupUpload(uploadId, getAccount(req));
    } catch (cleanupError) {
      logger.error('Error cleaning up after failed bulk upload:', cleanupError);
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to complete bulk upload: ${error.message}`
    ));
  }
};

/**
 * Complete chunk upload and assemble file for bulk image upload
 * POST /api/products/chunk-upload/complete-image-upload
 */
const completeChunkUploadForImageUpload = async (req, res) => {
  try {
    const { uploadId } = req.body;
    const account = getAccount(req);

    if (!uploadId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Missing uploadId parameter"
      ));
    }

    // Check if upload is complete
    const isComplete = await chunkUploadManager.isUploadComplete(uploadId, account);
    if (!isComplete) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Upload is not complete. Some chunks are missing."
      ));
    }

    // Assemble the file
    const assembledFile = await chunkUploadManager.assembleFile(uploadId, account);

    // Create a mock req.file object for the existing bulkImageUpload function
    const mockReq = {
      ...req,
      headers: req.headers || {}, // Ensure headers exist
      protocol: req.protocol || 'http',
      get: req.get || ((headerName) => req.headers && req.headers[headerName.toLowerCase()]),
      file: {
        originalname: assembledFile.filename,
        path: assembledFile.filePath,
        size: assembledFile.size,
        mimetype: getContentType(assembledFile.filename)
      }
    };

    // Debug logging
    logger.info(`🔍 mockReq headers for image upload: ${JSON.stringify(mockReq.headers)}`);
    logger.info(`🔍 mockReq protocol: ${mockReq.protocol}`);
    logger.info(`🔍 mockReq.get type: ${typeof mockReq.get}`);
    const mockAccount = getAccount(mockReq);
    logger.info(`🔍 Account from mockReq for image upload: ${mockAccount}`);
    
    // Test getOriginUrl
    try {
      const originUrl = getOriginUrl(req);
      logger.info(`🔍 getOriginUrl result: ${originUrl}`);
    } catch (error) {
      logger.error(`🔍 getOriginUrl error: ${error.message}`);
    }
    
    if (!mockAccount) {
      throw new Error('Account header missing in mock request for image upload processing');
    }

    // Import and call the existing bulkImageUpload function
    const { bulkImageUpload } = require('./upload.controller');
    
    // Override res.json to capture the response and add cleanup
    const originalJson = res.json;
    res.json = function(data) {
      // Clean up assembled file and chunks after processing
      setImmediate(async () => {
        try {
          await fs.unlink(assembledFile.filePath);
          await chunkUploadManager.cleanupUpload(uploadId, account);
          logger.info(`🧹 Cleaned up assembled file and chunks for upload: ${uploadId}`);
        } catch (cleanupError) {
          logger.error('Error cleaning up after image upload:', cleanupError);
        }
      });
      
      return originalJson.call(this, data);
    };

    // Call the existing bulk image upload function
    await bulkImageUpload(mockReq, res);

  } catch (error) {
    logger.error("Error completing chunk upload for image upload:", error);
    
    // Clean up on error
    try {
      await chunkUploadManager.cleanupUpload(uploadId, getAccount(req));
    } catch (cleanupError) {
      logger.error('Error cleaning up after failed image upload:', cleanupError);
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to complete image upload: ${error.message}`
    ));
  }
};

/**
 * Get upload status
 * GET /api/products/chunk-upload/status/:uploadId
 */
const getUploadStatus = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const account = getAccount(req);

    const status = await chunkUploadManager.getUploadStatus(uploadId, account);

    if (!status.exists) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        "Upload session not found"
      ));
    }

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      {
        uploadId: status.uploadId,
        filename: status.filename,
        totalSize: status.totalSize,
        totalChunks: status.totalChunks,
        receivedChunks: status.receivedChunks,
        isComplete: status.isComplete,
        progress: Math.round((status.receivedChunks / status.totalChunks) * 100),
        createdAt: status.createdAt,
        lastActivity: status.lastActivity
      },
      "Upload status retrieved successfully"
    ));

  } catch (error) {
    logger.error("Error getting upload status:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to get upload status: ${error.message}`
    ));
  }
};

/**
 * Cancel/cleanup upload
 * DELETE /api/products/chunk-upload/:uploadId
 */
const cancelUpload = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const account = getAccount(req);

    await chunkUploadManager.cleanupUpload(uploadId, account);

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      null,
      "Upload cancelled and cleaned up successfully"
    ));

  } catch (error) {
    logger.error("Error cancelling upload:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to cancel upload: ${error.message}`
    ));
  }
};

/**
 * Helper function to determine content type from filename
 */
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = {
  chunkUpload,
  initializeChunkUpload,
  uploadChunk,
  completeChunkUploadForBulkUpload,
  completeChunkUploadForImageUpload,
  getUploadStatus,
  cancelUpload
};