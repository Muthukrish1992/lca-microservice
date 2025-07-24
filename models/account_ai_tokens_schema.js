const mongoose = require("mongoose");

const AccountAITokensSchema = new mongoose.Schema({
  account_id: { type: String, required: true, index: true },
  total_tokens: { type: Number, required: true }, // total tokens (prompt + completion)
  prompt_tokens: { type: Number, default: 0 },
  completion_tokens: { type: Number, default: 0 },
  ai_cost_usd: { type: Number, default: 0 }, // total cost in USD
});

module.exports = AccountAITokensSchema;
