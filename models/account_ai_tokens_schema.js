const mongoose = require("mongoose");

const AccountAITokensSchema = new mongoose.Schema({
  account_id: { type: String, required: true ,index: true},
  ai_tokens: { type: Number, required: true },
  
});

module.exports = AccountAITokensSchema; // Export only the schema, NOT a model
