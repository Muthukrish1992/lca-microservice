const logger = require("../utils/logger");
const { HTTP_STATUS, formatResponse } = require("../utils/http");
const productService = require("../services/product.service");
const { getAccountPlan } = require("../services/account.service");

/**
 * Create a new product or update existing one if product code already exists
 * @route POST /api/products
 */
const createProduct = async (req, res) => {
  try {
    const { code } = req.body;

    const savedProduct = await productService.createProduct(req);
    res.status(201).json(formatResponse(true, savedProduct));

    logger.info(`Product created : ${code}`);
  } catch (error) {
    logger.error("Error creating/updating product:", error);
    res
      .status(500)
      .json(
        formatResponse(
          false,
          null,
          `Failed to create/update product: ${error.message}`
        )
      );
  }
};

/**
 * Get all products
 * @route GET /api/products
 */
const getAllProducts = async (req, res) => {
  try {
    logger.info("Getting all products");
    const products = await productService.getAllProducts(req);
    const plan = await getAccountPlan(req);

    res.status(HTTP_STATUS.OK).json(formatResponse(true, { products, plan }));
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(
        formatResponse(
          false,
          null,
          `Failed to fetch products: ${error.message}`
        )
      );
  }
};

/**
 * Get product by ID
 * @route GET /api/products/:id
 */
const getProductById = async (req, res) => {
  try {
    const product = await productService.getProductById(req, req.params.id);

    if (!product) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(formatResponse(false, null, "Product not found"));
    }

    res.status(HTTP_STATUS.OK).json(formatResponse(true, product));
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(
        formatResponse(false, null, `Failed to fetch product: ${error.message}`)
      );
  }
};

/**
 * Update a product
 * @route PUT /api/products/:id
 */
const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await productService.updateProduct(
      req,
      req.params.id
    );

    if (!updatedProduct) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(formatResponse(false, null, "Product not found"));
    }

    res.status(HTTP_STATUS.OK).json(formatResponse(true, updatedProduct));
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(
        formatResponse(
          false,
          null,
          `Failed to update product: ${error.message}`
        )
      );
  }
};

/**
 * Delete a product
 * @route DELETE /api/products/:id
 */
const deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await productService.deleteProduct(
      req,
      req.params.id
    );

    if (!deletedProduct) {
      return res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(formatResponse(false, null, "Product not found"));
    }

    res
      .status(HTTP_STATUS.OK)
      .json(formatResponse(true, null, "Product deleted successfully"));
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(
        formatResponse(
          false,
          null,
          `Failed to delete product: ${error.message}`
        )
      );
  }
};

/**
 * Delete all products
 * @route DELETE /api/products
 */
const deleteAllProducts = async (req, res) => {
  try {
    const result = await productService.deleteAllProducts(req);

    res
      .status(HTTP_STATUS.OK)
      .json(
        formatResponse(
          true,
          { deletedCount: result.deletedCount },
          "All products have been deleted successfully"
        )
      );
  } catch (error) {
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(
        formatResponse(
          false,
          null,
          `Failed to delete products: ${error.message}`
        )
      );
  }
};

/**
 * Delete product by ID (in request body)
 * @route POST /api/products/delete-product-by-id
 */
const deleteProductByID = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Product _id is required"));
    }

    const result = await productService.deleteProductByID(req);

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json(formatResponse(false, null, `No product found with ID: ${_id}`));
    }

    res
      .status(200)
      .json(
        formatResponse(
          true,
          null,
          `Product with ID ${_id} deleted successfully`
        )
      );
  } catch (error) {
    res
      .status(500)
      .json(
        formatResponse(
          false,
          null,
          `Failed to delete product: ${error.message}`
        )
      );
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  deleteAllProducts,
  deleteProductByID,
};
