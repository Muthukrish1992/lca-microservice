const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Environment configuration
 */
const config = {
    // Server configuration
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // Database configuration
    mongodbUri: process.env.MONGODB_URI,
    
    // CORS configuration
    corsOrigin: process.env.CORS_ORIGIN || '*',
    
    // Other configurations
    uploadDir: process.env.UPLOAD_DIR || 'uploads'
};

module.exports = config;