const mongoose = require("mongoose");

const AccountPlanSchema = new mongoose.Schema({
  account_id: { type: String, required: true ,index: true},
  plan: { type: String, required: true ,index: true},
  
});

module.exports = AccountPlanSchema; // Export only the schema, NOT a model
