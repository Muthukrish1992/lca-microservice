const mongoose = require('mongoose');

const ProjectProductMapSchema = new mongoose.Schema({
  projectCode: {
    type: String,
    required: true,
  },
  productCode: {
    type: String,
    required: true,
  },
  // Raw Materials Impact
  rawMaterialsContribution: [{
    materialClass: {
      type: String,
      required: true
    },
    specificMaterial: {
      type: String,
      required: true
    },
    emissionFactor: {
      type: Number,
      required: true
    },
    contributionPercentage: {
      type: Number,
      required: true
    }
  }],
  totalRawMaterialsEmission: {
    type: Number,
    required: true
  },

  // Manufacturing Impact
  manufacturingContribution: [{
    materialClass: {
      type: String,
      required: true
    },
    manufacturingProcess: {
      type: String,
      required: true
    },
    emissionFactor: {
      type: Number,
      required: true
    },
    contributionPercentage: {
      type: Number,
      required: true
    }
  }],
  totalManufacturingEmission: {
    type: Number,
    required: true
  },

  // Transportation Impact
  transportationLegs: [{
    transportMode: {
      type: String,
      required: true
    },
    originGateway: {
      type: String,
      required: true
    },
    destinationGateway: {
      type: String,
      required: true
    },
    transportEmission: {
      type: Number,
      required: true
    },
    contributionPercentage: {
      type: Number,
      required: true
    }
  }],
  totalTransportationEmission: {
    type: Number,
    required: true
  },

  // Overall Impact Summary
  totalProductFootprint: {
    type: Number,
    required: true,
    get: function() {
      return this.totalRawMaterialsEmission + 
             this.totalManufacturingEmission + 
             this.totalTransportationEmission;
    }
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add indexes for common queries
ProjectProductMapSchema.index({ projectCode: 1, productCode: 1 }, { unique: true });

module.exports = mongoose.model('ProjectProductMap', ProjectProductMapSchema);