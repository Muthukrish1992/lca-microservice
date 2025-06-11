const express = require('express');
const router = express.Router();
const homeController = require('../controllers/home.controller');
const { validateAccount } = require('../middlewares/auth.middleware');

// Apply account validation middleware
router.use(validateAccount);

// Home dashboard route
router.get('/home', homeController.getHomeData);

module.exports = router;