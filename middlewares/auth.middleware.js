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
  return req.headers["x-iviva-account"];
};

/**
 * Get authorization key from request headers
 */
const getAuthorizationKey = (req) => {
  return req.headers["authorization"];
};

/**
 * Get the origin URL from the request
 */
const getOriginUrl = (req) => {
  const protocol = req.protocol; // http or https
  const host = req.get("host"); // localhost:3000 or example.com
  return `${protocol}://${host}`;
};

module.exports = {
  validateAccount,
  getAccount,
  getAuthorizationKey,
  getOriginUrl
};