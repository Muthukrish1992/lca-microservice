const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  code: { type: String, required: true ,index: true},
  name: { type: String, required: true ,index: true},
  description: { type: String ,index: true},
  images: { type: [String] , default: []},
  weight: { type: Number , default: 0},
  countryOfOrigin: { type: String , default: "Unknown"},
  category: { type: String  ,index: true, default: "Uncategorized"},
  subCategory: { type: String ,index: true ,default: "Uncategorized"},
  supplierName: { type: String , default: "Unknown"},
  modifiedDate: { type: Date , default: Date.now},
  createdDate: { type: Date , default: Date.now},
  co2Emission: { type: Number , default: 0},
  co2EmissionRawMaterials: { type: Number , default: 0},
  co2EmissionFromProcesses: { type: Number , default: 0},
  materials: {
    type: [{
      materialClass: { type: String, required: true },
      specificMaterial: { type: String },
      weight: { type: Number, required: true },
      unit: { type: String, required: true, default: "kg" },
      emissionFactor: { type: Number, required: true, default: 0 },
      reasoning: { type: String },
      EF_Source: {type: String },
      EF_Type: {type:String},
      Type_Rationale: {type:String}
    }],
    default: []  // Empty array default
  },
  productManufacturingProcess: {
    type: [{
      materialClass: { type: String, default: "" },
      specificMaterial: { type: String, default: "" },
      weight: { type: Number, default: 0 },
      emissionFactor: { type: Number, required: true, default: 0 },
      manufacturingProcesses: {
        type: [{
          category: { type: String, default: "" },
          processes: { type: [String], default: [] }
        }],
        default: []
      }
    }],
    default: []  // Empty array default
  }
});

module.exports = ProductSchema; // Export only the schema, NOT a model
