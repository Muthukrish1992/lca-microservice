const mongoose = require("mongoose");

const ProjectProductMapSchema = new mongoose.Schema({
  projectID: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  productID: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  packagingWeight: { type: Number, required: true },
  palletWeight: { type: Number, required: true },
  totalTransportationEmission: { type: Number, required: true },

  transportationLegs: {
    type: [{
      transportMode: { type: String, required: true },
      originCountry: { type: String, required: true },
      destinationCountry: { type: String, required: true },
      originGateway: { type: String, required: true },
      destinationGateway: { type: String, required: true },
      transportEmission: { type: Number, required: true },
      transportDistance: { type: Number, required: true },
    }],
    default: []
  },

  createdDate: { type: Date, default: Date.now },
  modifiedDate: { type: Date, default: Date.now }
});

module.exports = ProjectProductMapSchema; // Export only the schema, NOT a model