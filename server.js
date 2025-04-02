const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const config = require('./config/environment');
const { errorHandler, notFound } = require('./middlewares/error.middleware');

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: config.corsOrigin
}));

// Routes
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/projects', require('./routes/project.routes'));
app.use('/api/project-product-mapping', require('./routes/project_product.routes'));
app.use('/api/account-plan', require('./routes/account.routes'));
app.use('/api', require('./routes/calculation.routes'));
app.use('/api', require('./routes/home.routes'));

// API Routes currently in server.js will be moved to their respective route files
// This is a temporary measure to maintain compatibility

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
});

module.exports = app;