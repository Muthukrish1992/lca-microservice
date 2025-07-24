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

const updateAITokens = async (req, usage) => {
  try {
    const account_id = getAccount(req);
    const AccountAIToken = await getAccountAITokenModel(account_id);

    // Calculate token and cost details
    const {
      inputTokens,
    newPromptTokens,
    cachedPromptTokens,
    outputTokens,
    inputCost,
    cachedInputCost,
    outputCost,
    totalCost,
    } = await calculateOpenAICost(usage, "gpt-4o");

    const totalTokens = inputTokens + outputTokens;

    let existingEntry = await AccountAIToken.findOne({ account_id });

    if (existingEntry) {
      existingEntry.prompt_tokens = (existingEntry.prompt_tokens || 0) + inputTokens;
      existingEntry.completion_tokens = (existingEntry.completion_tokens || 0) + outputTokens;
      existingEntry.total_tokens = (existingEntry.total_tokens || 0) + totalTokens;
      existingEntry.ai_cost_usd = (existingEntry.ai_cost_usd || 0) + totalCost;
      await existingEntry.save();
    } else {
      const newEntry = new AccountAIToken({
        account_id,
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: totalTokens,
        ai_cost_usd: totalCost
      });
      await newEntry.save();
    }

    console.log(`✅ AI usage updated for ${account_id}: ${inputTokens} prompt, ${outputTokens} completion, ${totalTokens} total, ~$${totalCost.toFixed(6)} USD`);
  } catch (error) {
    console.error(`❌ Failed to update AI usage: ${error.message}`);
  }
};



const calculateOpenAICost= async (usage, model = "gpt-4o") =>{
  // Pricing per 1M tokens in USD (based on OpenAI docs as of 2024-08-06)
  const pricing = {
    "gpt-4o": {
      input: 2.5,        // per 1M new prompt tokens
      cached_input: 1.25,// per 1M cached tokens
      output: 1.25       // per 1M output tokens
    },
    // Add support for other models if needed
  };

  const modelPricing = pricing[model];
  if (!modelPricing) {
    throw new Error(`Unsupported model: ${model}`);
  }

  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  const cachedTokens = usage.prompt_tokens_details?.cached_tokens || 0;

  const newPromptTokens = promptTokens - cachedTokens;
  const cachedPromptTokens = cachedTokens;

  const inputCost = (newPromptTokens * modelPricing.input) / 1_000_000;
  const cachedCost = (cachedPromptTokens * modelPricing.cached_input) / 1_000_000;
  const outputCost = (completionTokens * modelPricing.output) / 1_000_000;

  const totalCost = inputCost + cachedCost + outputCost;

  return {
    inputTokens: promptTokens,
    newPromptTokens,
    cachedPromptTokens,
    outputTokens: completionTokens,
    inputCost: parseFloat(inputCost.toFixed(6)),
    cachedInputCost: parseFloat(cachedCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6)),
  };
}


const getAccountAITokens = async (req) => {
    try {
      
      const account_id = getAccount(req);
      const AccountAIToken = await getAccountAITokenModel(account_id);
  
      let existingEntry = await AccountAIToken.findOne({ account_id });
  
      return existingEntry.total_tokens;
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
