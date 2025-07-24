const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const productService = require('../services/product.service');
const { getAccount } = require('../middlewares/auth.middleware');

/**
 * Get processing status for products
 * GET /api/products/processing-status
 */
const getProcessingStatus = async (req, res) => {
  try {
    const Product = await productService.getProductModel(req);
    
    // Count products by processing status
    const statusCounts = await Product.aggregate([
      {
        $group: {
          _id: "$aiProcessingStatus",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent products (last 24 hours) with their status
    const recentProducts = await Product.find({
      createdDate: { 
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
      }
    })
    .select('code name aiProcessingStatus createdDate modifiedDate')
    .sort({ createdDate: -1 })
    .limit(50);

    // Format status counts
    const statusSummary = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    statusCounts.forEach(status => {
      if (status._id && statusSummary.hasOwnProperty(status._id)) {
        statusSummary[status._id] = status.count;
      }
    });

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      {
        summary: statusSummary,
        recentProducts: recentProducts,
        lastUpdated: new Date()
      },
      "Processing status retrieved successfully"
    ));

  } catch (error) {
    logger.error("Error getting processing status:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to get processing status: ${error.message}`
    ));
  }
};

/**
 * Get detailed product status by code
 * GET /api/products/status/:productCode
 */
const getProductStatus = async (req, res) => {
  try {
    const { productCode } = req.params;
    const Product = await productService.getProductModel(req);
    
    const product = await Product.findOne({ code: productCode })
      .select('code name description aiProcessingStatus category subCategory materials images createdDate modifiedDate');

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        `Product with code ${productCode} not found`
      ));
    }

    res.status(HTTP_STATUS.OK).json(formatResponse(
      true,
      {
        product: product,
        processingComplete: product.aiProcessingStatus === 'completed',
        hasImages: product.images && product.images.length > 0,
        hasMaterials: product.materials && product.materials.length > 0
      },
      "Product status retrieved successfully"
    ));

  } catch (error) {
    logger.error("Error getting product status:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      `Failed to get product status: ${error.message}`
    ));
  }
};

module.exports = {
  getProcessingStatus,
  getProductStatus
};