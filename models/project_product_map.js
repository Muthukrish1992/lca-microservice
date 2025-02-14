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
    transportationLegs: {
        type: [{
          originCountry: { type: String, required: true },
          originPort: { type: String, required: true },
          destinationCountry: { type: String, required: true },
            destinationPort: { type: String, required: true },
         
        }],
        default: []  // Empty array default
      },
    
});

module.exports = mongoose.model(' ProjectProductMap', ProjectProductMapSchema);