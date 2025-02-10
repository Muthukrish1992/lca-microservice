const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  code: { type: String, required: true ,index: true},
  name: { type: String, required: true ,index: true},
  description: { type: String ,index: true},
  images: { type: [String] },
  weight: { type: String },
  countryOfOrigin: { type: String },
  category: { type: String  ,index: true},
  subCategory: { type: String ,index: true},
  supplierName: { type: String },
  modifiedDate: { type: Date },
  createdDate: { type: Date },
  co2Emission: { type: String },
  co2EmissionRawMaterials: { type: String },
  co2EmissionFromProcesses: { type: String },
  materials: [
    {
      materialClass: { type: String, required: true },
      specificMaterial: { type: String, required: true },
      weight: { type: Number, required: true },
      unit: { type: String, required: true },
      emissionFactor: { type: Number, required: true },
    },
  ],
  productManufacturingProcess: [
    {
      materialClass: { type: String },
      specificMaterial: { type: String },
      weight: { type: Number },
      emissionFactor: { type: Number, required: true },
      manufacturingProcesses: [
        {
          category: { type: String },
          processes: [{ type: String }],
        },
      ],
    },
  ],
});

module.exports = ProductSchema; // Export only the schema, NOT a model
