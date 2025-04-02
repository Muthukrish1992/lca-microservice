const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const productService = require('../services/product.service');
const projectService = require('../services/project.service');
const { getAccountAITokens } = require('../services/account.service');

/**
 * Get home dashboard data
 * @route GET /api/home
 */
const getHomeData = async (req, res) => {
  try {
    // Placeholder functions for the models
    const getProductModel = productService.getProductModel;
    const getProjectModel = async (req) => { 
      // Dummy implementation until we create project service
      return { countDocuments: async () => 0 }; 
    };
    const getProjectProductMapModel = async (req) => { 
      // Dummy implementation until we create project-product service
      return { countDocuments: async () => 0 }; 
    };

    // Fetch dynamic values from the database
    const Product = await getProductModel(req);
    const Project = await getProjectModel(req);
    const ProjectProductMap = await getProjectProductMapModel(req);

    const totalProducts = await Product.countDocuments();
    const totalImpact = await ProjectProductMap.countDocuments();
    const totalProjects = await Project.countDocuments();

    const totalCredits = await getAccountAITokens(req);

    return res.status(200).json(formatResponse(
      true,
      {
        totalProducts,
        totalImpact: totalImpact,
        totalProjects,
        totalCredits: totalCredits || 0,
      }
    ));
  } catch (error) {
    logger.error("Error fetching data:", error);
    return res
      .status(500)
      .json(formatResponse(false, null, "Internal Server Error"));
  }
};

module.exports = {
  getHomeData
};