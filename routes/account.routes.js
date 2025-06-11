const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const { validateAccount } = require('../middlewares/auth.middleware');

// Apply account validation middleware
router.use(validateAccount);

// Account plan routes
router.route('/')
  .get(accountController.getAccountPlan)
  .post(accountController.createOrUpdateAccountPlan);

router.route('/:id')
  .get(accountController.getAccountPlanById)
  .put(accountController.updateAccountPlanById)
  .delete(accountController.deleteAccountPlanById);

// AI tokens routes
router.route('/ai-tokens')
  .get(accountController.getAITokens)
  .post(accountController.updateAITokens);

module.exports = router;