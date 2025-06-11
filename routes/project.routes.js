const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const { validateAccount } = require('../middlewares/auth.middleware');

// Apply account validation middleware
router.use(validateAccount);

// Basic project routes
router.route('/')
  .post(projectController.createProject)
  .get(projectController.getAllProjects)
  .delete(projectController.deleteAllProjects);

// Project impacts route (must come before /:id to avoid conflicts)
router.route('/impacts')
  .post(projectController.getProjectImpacts);

// Project routes with ID
router.route('/:id')
  .get(projectController.getProjectById)
  .put(projectController.updateProject)
  .delete(projectController.deleteProject);

module.exports = router;