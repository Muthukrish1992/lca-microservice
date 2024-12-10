const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  images: {
    type: [String], // Array of binary data to hold multiple images
  },
  weight: {
    type: String,
  },
  countryOfOrigin: {
    type: String,
  },
  category: {
    type: String,
  },
  subCategory: {
    type: String,
  },
  brandName: {
    type: String,
  },
  supplierName: {
    type: String,
  },
  modifiedDate: {
    type: Date,
  },
  createdDate: {
    type: Date,
  },
  co2Emission: {
    type: String,
  },
  materials: [
    {
      materialClass: {
        type: String, // Class of material (e.g., "Wood", "Metal")
        required: true,
      },
      specificMaterial: {
        type: String, // Specific material (e.g., "Oak", "Steel")
        required: true,
      },
      weight: {
        type: Number, // Weight of the material
        required: true,
      },
      unit: {
        type: String, // Unit of weight (e.g., "kg", "m3")
        required: true,
      },
    },
  ],
  productManufacturingProcess: [
    {
      materialClass: {
        type: String,
      },
      specificMaterial: {
        type: String,
      },
      weight: {
        type: Number, 
      },
      manufacturingProcesses: [
        {
          category: {
            type: String,
          },
          processes: [
            {
              type: String,
            },
          ],
        },
      ],
    },
  ],
});

module.exports = mongoose.model("Product", ProductSchema);
