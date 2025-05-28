const mongoose = require("mongoose");

const TransportationLegSchema = new mongoose.Schema({
  transportMode: { type: String, required: true },
  originCountry: { type: String, required: true },
  destinationCountry: { type: String, required: true },
  originGateway: { type: String, required: true },
  destinationGateway: { type: String, required: true },
  transportEmission: { type: Number, required: true },
  transportDistance: { type: Number, required: true },
}, { _id: true, id: false });

const ProductMapSchema = new mongoose.Schema({
  productID: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  packagingWeight: { type: Number, required: true },
  palletWeight: { type: Number, required: true },
  totalTransportationEmission: { type: Number, required: true },
  transportationLegs: {
    type: [TransportationLegSchema],
    default: []
  }
}, { _id: true, id: false });

const ProjectProductMapSchema = new mongoose.Schema({
  projectID: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  products: {
    type: [ProductMapSchema],
    default: []
  },
  createdDate: { type: Date, default: Date.now },
  modifiedDate: { type: Date, default: Date.now }
});

module.exports = ProjectProductMapSchema; // Export only the schema, NOT a model