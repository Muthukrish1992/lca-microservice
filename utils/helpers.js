const logger = require('./logger');

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
 * Generate a UUID
 */
function generateUUID() {
  var d = new Date().getTime();
  var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    function (c) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c == "x" ? r : (r & 0x7) | 0x8).toString(16);
    }
  );
  return uuid;
}

/**
 * Add query string parameters to a URL
 */
function addQSToURL(url, qs) {
  let result = url.includes("?") ? url : url + "?";
  let qsArray = Object.entries(qs).map(([key, value]) => `${key}=${value}`);
  return result + qsArray.join("&");
}

/**
 * Retry a function multiple times with delay
 */
const retry = async (fn, args, retries = 1, delay = 1000) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(...args);
    } catch (error) {
      logger.warn(`⚠️ Attempt ${attempt + 1} failed: ${error.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};

module.exports = {
  validateRequiredFields,
  getPaginationParams,
  sanitizeQuery,
  isValidObjectId,
  generateUUID,
  addQSToURL,
  retry
};