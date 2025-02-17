const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
  code: { type: String, required: true ,index: true},
  name: { type: String, required: true ,index: true},
  
});

module.exports = ProjectSchema; // Export only the schema, NOT a model
