const { getModel } = require('../config/database');
const accountPlanSchema = require('../models/account_plan_schema');
const accountAITokenSchema = require('../models/account_ai_tokens_schema');
const { getAccount } = require('../middlewares/auth.middleware');
const logger = require('../utils/logger');

/**
 * Get account plan model
 */
const getAccountPlanModel = async (req) => {
  const account = getAccount(req);
  return getModel(account, accountPlanSchema, "AccountPlan");
};

/**
 * Get account AI token model
 */
const getAccountAITokenModel = async (account) => {
  return getModel(account, accountAITokenSchema, "AccountAIToken");
};

/**
 * Get account plan
 */
const getAccountPlan = async (req) => {
  const account = getAccount(req);
  const AccountPlan = await getAccountPlanModel(req);
  const entry = await AccountPlan.findOne({ account_id: account });
  return entry ?? { plan: "professional" };
};

/**
 * Get all account plans
 */
const getAllAccountPlans = async (req) => {
  const AccountPlan = await getAccountPlanModel(req);
  return await AccountPlan.find();
};

/**
 * Get account plan by ID
 */
const getAccountPlanById = async (req, id) => {
  const AccountPlan = await getAccountPlanModel(req);
  return await AccountPlan.findById(id);
};

/**
 * Create or update account plan
 */
const createOrUpdateAccountPlan = async (req, account_id, plan) => {
  const AccountPlan = await getAccountPlanModel(req);
  
  // Check if account_id already exists
  let existingEntry = await AccountPlan.findOne({ account_id });
  
  if (existingEntry) {
    // Update existing entry
    existingEntry.plan = plan;
    const updatedEntry = await existingEntry.save();
    return { created: false, data: updatedEntry };
  } else {
    // Create new entry
    const newEntry = new AccountPlan({ account_id, plan });
    const savedEntry = await newEntry.save();
    return { created: true, data: savedEntry };
  }
};

/**
 * Update account plan by ID
 */
const updateAccountPlanById = async (req, id, account_id, plan) => {
  const AccountPlan = await getAccountPlanModel(req);
  return await AccountPlan.findByIdAndUpdate(
    id,
    { account_id, plan },
    { new: true, runValidators: true }
  );
};

/**
 * Delete account plan by ID
 */
const deleteAccountPlanById = async (req, id) => {
  const AccountPlan = await getAccountPlanModel(req);
  return await AccountPlan.findByIdAndDelete(id);
};

/**
 * Update AI tokens for an account
 */
const updateAITokens = async (req, ai_tokens) => {
  try {
    const account_id = getAccount(req);
    const AccountAIToken = await getAccountAITokenModel(account_id);

    let existingEntry = await AccountAIToken.findOne({ account_id });

    if (existingEntry) {
      // Update existing entry
      existingEntry.ai_tokens = existingEntry.ai_tokens + ai_tokens;
      await existingEntry.save();
    } else {
      // Create new entry
      const newEntry = new AccountAIToken({ account_id, ai_tokens });
      await newEntry.save();
    }
  } catch (error) {
    logger.error('Error updating AI tokens:', error);
    throw error;
  }
};

/**
 * Get AI tokens for an account
 */
const getAccountAITokens = async (req) => {
  try {
    const account_id = getAccount(req);
    const AccountAIToken = await getAccountAITokenModel(account_id);

    let existingEntry = await AccountAIToken.findOne({ account_id });
    if (!existingEntry) {
      return 0;
    }
    
    return existingEntry.total_tokens || 0;
  } catch (error) {
    logger.error('Error getting AI tokens:', error);
    throw error;
  }
};

/**
 * Reset all AI token values for an account
 */
const resetAllAITokens = async (req) => {
  try {
    const account_id = getAccount(req);
    const AccountAIToken = await getAccountAITokenModel(account_id);

    let existingEntry = await AccountAIToken.findOne({ account_id });

    if (existingEntry) {
      // Reset all token values to 0
      existingEntry.total_tokens = 0;
      existingEntry.prompt_tokens = 0;
      existingEntry.completion_tokens = 0;
      existingEntry.ai_cost_usd = 0;
      await existingEntry.save();
      logger.info(`AI tokens reset successfully for account: ${account_id}`);
    } else {
      // Create new entry with all values as 0
      const newEntry = new AccountAIToken({ 
        account_id, 
        total_tokens: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        ai_cost_usd: 0
      });
      await newEntry.save();
      logger.info(`New AI token entry created with reset values for account: ${account_id}`);
    }
  } catch (error) {
    logger.error('Error resetting AI tokens:', error);
    throw error;
  }
};

module.exports = {
  getAccountPlanModel,
  getAccountAITokenModel,
  getAccountPlan,
  getAllAccountPlans,
  getAccountPlanById,
  createOrUpdateAccountPlan,
  updateAccountPlanById,
  deleteAccountPlanById,
  updateAITokens,
  getAccountAITokens,
  resetAllAITokens
};