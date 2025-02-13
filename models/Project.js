const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    totalProjectImpact: {
        type: Number,
        default: 0
    },
    totalMaterialsImpact: {
        type: Number,
        default: 0
    },
    totalManufacturingImpact: {
        type: Number,
        default: 0
    },
    totalTransportationImpact: {
        type: Number,
        default: 0
    },
    products: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        productImage: String,
        impacts: {
            totalImpact: Number,
            impactByMaterials: Number,
            impactByManufacturing: Number,
            impactByTransportation: Number
        }
    }],
    createdDate: {
        type: Date,
        default: Date.now,
    },
    modifiedDate: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Project', ProjectSchema);