const logger = require("../utils/logger");
const { HTTP_STATUS, formatResponse } = require("../utils/http");
const aiProcessingQueue = require("../utils/aiProcessingQueue");
const productService = require("../services/product.service");

/**
 * Get AI processing queue status
 * @route GET /api/products/queue-status
 */
const getQueueStatus = async (req, res) => {
  try {
    const queueStatus = aiProcessingQueue.getStatus();
    const Product = await productService.getProductModel(req);
    
    // Get database statistics
    const statusCounts = await Product.aggregate([
      {
        $group: {
          _id: "$aiProcessingStatus",
          count: { $sum: 1 }
        }
      }
    ]);

    const dbStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    statusCounts.forEach(stat => {
      if (stat._id && dbStats.hasOwnProperty(stat._id)) {
        dbStats[stat._id] = stat.count;
      }
    });

    const response = {
      queue: queueStatus,
      database: dbStats,
      totalProducts: Object.values(dbStats).reduce((sum, count) => sum + count, 0)
    };

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      response,
      "AI processing queue status retrieved successfully"
    ));

  } catch (error) {
    logger.error("Error getting queue status:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to get queue status: ${error.message}`
    ));
  }
};

/**
 * Start AI processing queue manually
 * @route POST /api/products/start-queue
 */
const startQueue = async (req, res) => {
  try {
    const Product = await productService.getProductModel(req);
    
    // Find pending products
    const pendingProducts = await Product.find({ 
      aiProcessingStatus: 'pending' 
    });

    if (pendingProducts.length === 0) {
      return res.status(HTTP_STATUS.OK).json(formatResponse(
        true,
        { message: "No pending products found" },
        "No products to process"
      ));
    }

    // Add to queue
    await aiProcessingQueue.addToQueue(pendingProducts, req);

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      { 
        addedToQueue: pendingProducts.length,
        queueStatus: aiProcessingQueue.getStatus()
      },
      `Added ${pendingProducts.length} products to AI processing queue`
    ));

  } catch (error) {
    logger.error("Error starting queue:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to start queue: ${error.message}`
    ));
  }
};

/**
 * Stop AI processing queue
 * @route POST /api/products/stop-queue
 */
const stopQueue = async (req, res) => {
  try {
    aiProcessingQueue.stop();

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      aiProcessingQueue.getStatus(),
      "AI processing queue stopped"
    ));

  } catch (error) {
    logger.error("Error stopping queue:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to stop queue: ${error.message}`
    ));
  }
};

/**
 * Reset failed products to pending status
 * @route POST /api/products/reset-failed
 */
const resetFailedProducts = async (req, res) => {
  try {
    const Product = await productService.getProductModel(req);
    
    const result = await Product.updateMany(
      { aiProcessingStatus: 'failed' },
      { 
        $set: { 
          aiProcessingStatus: 'pending',
          processingError: null,
          lastProcessed: null
        }
      }
    );

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      { 
        modifiedCount: result.modifiedCount,
        message: `Reset ${result.modifiedCount} failed products to pending status`
      },
      "Failed products reset successfully"
    ));

  } catch (error) {
    logger.error("Error resetting failed products:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to reset failed products: ${error.message}`
    ));
  }
};

/**
 * Get processing statistics and performance metrics
 * @route GET /api/products/processing-stats
 */
const getProcessingStats = async (req, res) => {
  try {
    const Product = await productService.getProductModel(req);
    
    // Get processing statistics from last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentStats = await Product.aggregate([
      {
        $match: {
          lastProcessed: { $gte: last24Hours }
        }
      },
      {
        $group: {
          _id: "$aiProcessingStatus",
          count: { $sum: 1 },
          avgProcessingTime: {
            $avg: {
              $subtract: ["$lastProcessed", "$createdDate"]
            }
          }
        }
      }
    ]);

    // Get overall statistics
    const overallStats = await Product.aggregate([
      {
        $group: {
          _id: "$aiProcessingStatus",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get products with errors
    const errorProducts = await Product.find(
      { 
        aiProcessingStatus: 'failed',
        processingError: { $exists: true }
      },
      'code name processingError lastProcessed'
    ).limit(10);

    const response = {
      last24Hours: recentStats,
      overall: overallStats,
      recentErrors: errorProducts,
      queueStatus: aiProcessingQueue.getStatus()
    };

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      response,
      "Processing statistics retrieved successfully"
    ));

  } catch (error) {
    logger.error("Error getting processing stats:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to get processing stats: ${error.message}`
    ));
  }
};

/**
 * Update queue configuration
 * @route PUT /api/products/queue-config
 */
const updateQueueConfig = async (req, res) => {
  try {
    const { batchSize, batchDelayMs, maxConcurrentRequests } = req.body;

    const currentConfig = aiProcessingQueue.getStatus();

    // Update configuration if provided
    if (batchSize && batchSize > 0 && batchSize <= 1000) {
      aiProcessingQueue.batchSize = batchSize;
    }
    
    if (batchDelayMs && batchDelayMs >= 30000) { // Minimum 30 seconds
      aiProcessingQueue.batchDelayMs = batchDelayMs;
    }
    
    if (maxConcurrentRequests && maxConcurrentRequests > 0 && maxConcurrentRequests <= 20) {
      aiProcessingQueue.maxConcurrentRequests = maxConcurrentRequests;
    }

    const newConfig = {
      batchSize: aiProcessingQueue.batchSize,
      batchDelayMs: aiProcessingQueue.batchDelayMs,
      maxConcurrentRequests: aiProcessingQueue.maxConcurrentRequests,
      updated: new Date()
    };

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      {
        previous: {
          batchSize: currentConfig.batchSize,
          batchDelayMs: aiProcessingQueue.batchDelayMs,
          maxConcurrentRequests: aiProcessingQueue.maxConcurrentRequests
        },
        current: newConfig
      },
      "Queue configuration updated successfully"
    ));

  } catch (error) {
    logger.error("Error updating queue config:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to update queue config: ${error.message}`
    ));
  }
};

module.exports = {
  getQueueStatus,
  startQueue,
  stopQueue,
  resetFailedProducts,
  getProcessingStats,
  updateQueueConfig
};