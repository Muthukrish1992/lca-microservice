// utils/commonUtils.js

const getDBConnection = require('../config/dbManager');

// Constants that will be used across different routes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
};

/**
 * Gets a Mongoose model for a given schema and account
 * @param {string} account - Account identifier
 * @param {Schema} schema - Mongoose schema
 * @param {string} modelName - Name of the model
 */
const getModel = async (account, schema, modelName) => {
    try {
        const db = await getDBConnection(account);
        return db.model(modelName, schema);
    } catch (error) {
        throw new Error(`Failed to get ${modelName} model: ${error.message}`);
    }
};

/**
 * Validates required fields in a request body
 * @param {Object} body - Request body
 * @param {Array} requiredFields - Array of required field names
 */
const validateRequiredFields = (body, requiredFields) => {
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    return true;
};

/**
 * Formats API response consistently
 * @param {boolean} success - Whether the operation was successful
 * @param {*} data - Data to be returned (optional)
 * @param {string} message - Message to be returned (optional)
 */
const formatResponse = (success, data = null, message = null) => {
    return {
        success,
        ...(data && { data }),
        ...(message && { message })
    };
};

/**
 * Handles MongoDB pagination
 * @param {Object} query - Query parameters
 * @param {number} defaultLimit - Default items per page
 */
const getPaginationParams = (query, defaultLimit = 10) => {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, parseInt(query.limit) || defaultLimit);
    const skip = (page - 1) * limit;
    
    return { page, limit, skip };
};

/**
 * Sanitizes query parameters for MongoDB
 * @param {Object} query - Query parameters to sanitize
 * @param {Array} allowedFields - Fields that are allowed in the query
 */
const sanitizeQuery = (query, allowedFields) => {
    const sanitized = {};
    Object.keys(query).forEach(key => {
        if (allowedFields.includes(key)) {
            sanitized[key] = query[key];
        }
    });
    return sanitized;
};

/**
 * Check if string is valid MongoDB ObjectId
 * @param {string} id - ID to validate
 */
const isValidObjectId = (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Handles API errors consistently
 * @param {Error} error - Error object
 * @param {string} operation - Operation being performed
 */
const formatError = (error, operation) => {
    return {
        success: false,
        message: `Failed to ${operation}: ${error.message}`,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
};

const validateAccount = (req, res, next) => {
    const account = getAccount(req);
    if (!account) {
        return res.status(HTTP_STATUS.BAD_REQUEST)
            .json(formatResponse(false, null, 'Account header missing'));
    }
    req.account = account;
    next();
}

const getAccount = (req) => {
    const account = req.headers['x-iviva-account'];
    
    return account;
}

module.exports = {
    HTTP_STATUS,
    getModel,
    validateRequiredFields,
    formatResponse,
    getPaginationParams,
    sanitizeQuery,
    isValidObjectId,
    formatError,
    validateAccount,
    getAccount,
};