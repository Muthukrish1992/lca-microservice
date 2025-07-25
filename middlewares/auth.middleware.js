const { formatResponse } = require('../utils/http');
const logger = require('../utils/logger');

/**
 * Middleware to validate account header
 */
const validateAccount = (req, res, next) => {
  const account = getAccount(req);
  if (!account) {
    logger.warn('Request missing account header');
    return res
      .status(400)
      .json(formatResponse(false, null, "Account header missing"));
  }
  req.account = account;
  next();
};

/**
 * Get account from request headers
 */
const getAccount = (req) => {
  return req?.headers?.["x-iviva-account"];
};

/**
 * Get authorization key from request headers
 */
const getAuthorizationKey = (req) => {
  return req?.headers?.["authorization"];
};

/**
 * Get the origin URL from the request
 */
const getOriginUrl = (req) => {
  try {
    const protocol = req.protocol || 'http';
    
    // Try to get host using Express req.get method if available
    let host;
    if (typeof req.get === 'function') {
      host = req.get("host");
    } else if (req.headers && req.headers.host) {
      // Fallback to headers if req.get is not available (mock requests)
      host = req.headers.host;
    } else {
      // Default fallback
      host = 'localhost:5000';
    }
    
    return `${protocol}://${host}`;
  } catch (error) {
    // Fallback if anything goes wrong
    return 'http://localhost:5000';
  }
};

module.exports = {
  validateAccount,
  getAccount,
  getAuthorizationKey,
  getOriginUrl
};