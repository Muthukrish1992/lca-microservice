const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const productCategories = require('../data/productCategories.json');

/**
 * Get all categories
 * @route GET /api/categories
 */
const getAllCategories = (req, res) => {
  try {
    const categories = Object.keys(productCategories);
    res.status(HTTP_STATUS.OK).json(formatResponse(true, categories));
  } catch (error) {
    logger.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving categories."
    ));
  }
};

/**
 * Get subcategories by category
 * @route GET /api/subcategories
 */
const getSubcategories = (req, res) => {
  try {
    const category = req.query.category;

    if (!category) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false,
        null,
        "Category is required as a query parameter."
      ));
    }

    const subcategories = productCategories[category];

    if (!subcategories) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false,
        null,
        "Category not found"
      ));
    }

    res.status(HTTP_STATUS.OK).json(formatResponse(true, subcategories));
  } catch (error) {
    logger.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving subcategories."
    ));
  }
};

/**
 * Get all product categories
 * @route GET /api/productCategories
 */
const getAllProductCategories = (req, res) => {
  try {
    res.status(HTTP_STATUS.OK).json(formatResponse(true, productCategories));
  } catch (error) {
    logger.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false,
      null,
      "An error occurred while retrieving product categories."
    ));
  }
};

module.exports = {
  getAllCategories,
  getSubcategories,
  getAllProductCategories
};