const express = require('express');
const router = express.Router();
const projectProductMapSchema = require('../models/project_product_map_schema');
const {
    getModel,
    getAccount,
  } = require("../utils/utils");
  
  const getProjectProductMapModel = async (req) => {
    const account = getAccount(req);
    return getModel(account, projectProductMapSchema, "ProjectProductMap");
  };

router.post('/', async (req, res) => {
    try {
        const {
            projectID,
            productID,
            packagingWeight,
            palletWeight,
            totalTransportationEmission,
            transportationLegs
        } = req.body;
            

        const ProjectProductMap = await getProjectProductMapModel(req);

        // Create new mapping document
        const projectProductMapping = new ProjectProductMap({
            projectID,
            productID,
            packagingWeight,
            palletWeight,
            totalTransportationEmission,
            transportationLegs
        });

        // Save to database
        const savedMapping = await projectProductMapping.save();

        res.status(201).json({
            success: true,
            message: 'Project-Product mapping created successfully',
            data: savedMapping
        });

    } catch (error) {
        console.error('Error saving project-product mapping:', error);
        
        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'A mapping for this project and product already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating project-product mapping',
            error: error.message
        });
    }
});

module.exports = router;