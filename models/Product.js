const mongoose = require('mongoose');

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
    
});

module.exports = mongoose.model('Product', ProductSchema);
