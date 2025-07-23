const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const config = require('./config/environment');
const { errorHandler, notFound } = require('./middlewares/error.middleware');

// Initialize Express app
const app = express();

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - Headers: ${JSON.stringify(req.headers)}`);
  next();
});

// Middleware
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));
app.use(cors({
  origin: config.corsOrigin
}));

// Routes
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/products/chunk-upload', require('./routes/chunkUpload.routes'));
app.use('/api/projects', require('./routes/project.routes'));
app.use('/api/project-product-mapping', require('./routes/project_product.routes'));
app.use('/api/account-plan', require('./routes/account.routes'));
app.use('/api', require('./routes/calculation.routes'));
app.use('/api', require('./routes/home.routes'));
app.use('/api', require('./routes/category.routes'));

// API Routes currently in server.js will be moved to their respective route files
// This is a temporary measure to maintain compatibility

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
  logger.info(`MongoDB URI: ${config.mongodbUri ? 'SET' : 'NOT SET'}`);
  logger.info(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
});

// Set server timeout for large file uploads
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

module.exports = app;