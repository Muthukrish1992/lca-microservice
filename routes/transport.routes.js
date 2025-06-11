const express = require('express');
const router = express.Router();
const transportController = require('../controllers/transport.controller');
const { validateAccount } = require('../middlewares/auth.middleware');

// Apply account validation middleware
router.use(validateAccount);

// Transport routes
router.get('/transportDB', transportController.getTransportDB);
router.post('/distance', transportController.getDistance);

module.exports = router;