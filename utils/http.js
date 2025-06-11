/**
 * HTTP status codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
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
    ...(data !== null && { data }),
    ...(message && { message })
  };
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
    error: process.env.NODE_ENV === "development" ? error.stack : undefined
  };
};

module.exports = {
  HTTP_STATUS,
  formatResponse,
  formatError
};