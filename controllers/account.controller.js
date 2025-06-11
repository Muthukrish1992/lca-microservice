const logger = require('../utils/logger');
const { HTTP_STATUS, formatResponse } = require('../utils/http');
const accountService = require('../services/account.service');

/**
 * Get account plan
 * @route GET /api/account-plan
 */
const getAccountPlan = async (req, res) => {
  try {
    const accountPlan = await accountService.getAccountPlan(req);
    res.status(HTTP_STATUS.OK).json(formatResponse(true, accountPlan));
  } catch (error) {
    logger.error('Error fetching account plan:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false, 
      null, 
      `Error fetching account plan: ${error.message}`
    ));
  }
};

/**
 * Create or update account plan
 * @route POST /api/account-plan
 */
const createOrUpdateAccountPlan = async (req, res) => {
  try {
    const { account_id, plan } = req.body;
    
    if (!account_id || !plan) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false, 
        null, 
        'Account ID and plan are required'
      ));
    }
    
    const result = await accountService.createOrUpdateAccountPlan(req, account_id, plan);
    
    if (result.created) {
      res.status(HTTP_STATUS.CREATED).json(formatResponse(
        true, 
        result.data, 
        'Account plan created successfully'
      ));
    } else {
      res.status(HTTP_STATUS.OK).json(formatResponse(
        true, 
        result.data, 
        'Account plan updated successfully'
      ));
    }
  } catch (error) {
    logger.error('Error processing account plan:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false, 
      null, 
      `Error processing account plan: ${error.message}`
    ));
  }
};

/**
 * Get account plan by ID
 * @route GET /api/account-plan/:id
 */
const getAccountPlanById = async (req, res) => {
  try {
    const accountPlan = await accountService.getAccountPlanById(req, req.params.id);
    
    if (!accountPlan) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false, 
        null, 
        'Account plan not found'
      ));
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(true, accountPlan));
  } catch (error) {
    logger.error('Error fetching account plan:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false, 
      null, 
      `Error fetching account plan: ${error.message}`
    ));
  }
};

/**
 * Update account plan by ID
 * @route PUT /api/account-plan/:id
 */
const updateAccountPlanById = async (req, res) => {
  try {
    const { account_id, plan } = req.body;
    
    if (!account_id || !plan) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false, 
        null, 
        'Account ID and plan are required'
      ));
    }
    
    const updatedAccountPlan = await accountService.updateAccountPlanById(
      req, 
      req.params.id, 
      account_id, 
      plan
    );
    
    if (!updatedAccountPlan) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false, 
        null, 
        'Account plan not found'
      ));
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true, 
      updatedAccountPlan, 
      'Account plan updated successfully'
    ));
  } catch (error) {
    logger.error('Error updating account plan:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false, 
      null, 
      `Error updating account plan: ${error.message}`
    ));
  }
};

/**
 * Delete account plan by ID
 * @route DELETE /api/account-plan/:id
 */
const deleteAccountPlanById = async (req, res) => {
  try {
    const result = await accountService.deleteAccountPlanById(req, req.params.id);
    
    if (!result) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(formatResponse(
        false, 
        null, 
        'Account plan not found'
      ));
    }
    
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true, 
      null, 
      'Account plan deleted successfully'
    ));
  } catch (error) {
    logger.error('Error deleting account plan:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false, 
      null, 
      `Error deleting account plan: ${error.message}`
    ));
  }
};

/**
 * Get AI tokens
 * @route GET /api/account-plan/ai-tokens
 */
const getAITokens = async (req, res) => {
  try {
    const aiTokens = await accountService.getAccountAITokens(req);
    res.status(HTTP_STATUS.OK).json(formatResponse(true, { ai_tokens: aiTokens }));
  } catch (error) {
    logger.error('Error fetching AI tokens:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false, 
      null, 
      `Error fetching AI tokens: ${error.message}`
    ));
  }
};

/**
 * Update AI tokens
 * @route POST /api/account-plan/ai-tokens
 */
const updateAITokens = async (req, res) => {
  try {
    const { ai_tokens } = req.body;
    
    if (ai_tokens === undefined) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(formatResponse(
        false, 
        null, 
        'AI tokens value is required'
      ));
    }
    
    await accountService.updateAITokens(req, ai_tokens);
    res.status(HTTP_STATUS.OK).json(formatResponse(
      true, 
      null, 
      'AI tokens updated successfully'
    ));
  } catch (error) {
    logger.error('Error updating AI tokens:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(formatResponse(
      false, 
      null, 
      `Error updating AI tokens: ${error.message}`
    ));
  }
};

module.exports = {
  getAccountPlan,
  createOrUpdateAccountPlan,
  getAccountPlanById,
  updateAccountPlanById,
  deleteAccountPlanById,
  getAITokens,
  updateAITokens
};