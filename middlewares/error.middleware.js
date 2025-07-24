const logger = require('../utils/logger');

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });
  
  const statusCode = err.statusCode || 500;
  const errorResponse = {
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === "development" ? err.stack : undefined
  };
  
  res.status(statusCode).json(errorResponse);
};

/**
 * Not found middleware for handling undefined routes
 */
const notFound = (req, res, next) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl} - Account: ${req.headers['x-iviva-account'] || 'MISSING'}`);
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFound
};