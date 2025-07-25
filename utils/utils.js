// utils/commonUtils.js

const getDBConnection = require("../config/dbManager");
const accountPlanSchema = require("../models/account_plan_schema");
const accountAITokenSchema = require("../models/account_ai_tokens_schema");

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
  const missingFields = requiredFields.filter((field) => !body[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
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
    ...(message && { message }),
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
  Object.keys(query).forEach((key) => {
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
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  };
};

const getAccount = (req) => {
  const account = req.headers["x-iviva-account"];

  return account;
};

const getAccountPlanModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, accountPlanSchema, "AccountPlan");
};

const getAccountAITokenModel = async (account) => {
  return getModel(account, accountAITokenSchema, "AccountAIToken");
};

const getAccountPlan = async (req) => {
  const account = getAccount(req);
  const AccountPlan = await getAccountPlanModel(req);
  const entry = await AccountPlan.findOne({ account_id: account });
  return entry ?? "professional";
};

const getOriginUrl = (req) => {
  const protocol = req.protocol; // http or https
  const host = req.get("host"); // localhost:3000 or example.com
  return `${protocol}://${host}`;
};

const getAuthorizationKey = (req) => {
  const authorizationKey = req.headers["authorization"];
  return authorizationKey;
};

const updateAITokens = async (req, ai_tokens) => {
  try {
    
    const account_id = getAccount(req);
    const AccountAIToken = await getAccountAITokenModel(account_id);

    let existingEntry = await AccountAIToken.findOne({ account_id });

    if (existingEntry) {
      // Update existing entry
      existingEntry.ai_tokens = existingEntry.ai_tokens + ai_tokens;
      await existingEntry.save();
    } else {
      // Create new entry
      const newEntry = new AccountAIToken({ account_id, ai_tokens });
      savedEntry = await newEntry.save();
    }
  } catch (error) {
    console.log(error);
  }
};

const getAccountAITokens = async (req) => {
    try {
      
      const account_id = getAccount(req);
      const AccountAIToken = await getAccountAITokenModel(account_id);
  
      let existingEntry = await AccountAIToken.findOne({ account_id });
  
      return existingEntry.ai_tokens;
    } catch (error) {
      console.log(error);
    }
  };

module.exports = {
  HTTP_STATUS,
  getModel,
  validateRequiredFields,
  formatResponse,
  getPaginationParams,
  sanitizeQuery,
  isValidObjectId,
  formatError,
  getAccount,
  getOriginUrl,
  getAuthorizationKey,
  getAccountPlan,
  updateAITokens,
  getAccountAITokens,
};
