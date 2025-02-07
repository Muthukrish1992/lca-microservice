const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  modifiedDate: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("Project", ProjectSchema); 