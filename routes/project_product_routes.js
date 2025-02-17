const express = require('express');
const router = express.Router();
const ProjectProductMap = require('../models/project_product_map');

router.post('/', async (req, res) => {
    try {
        const {
            projectCode,
            product,
            transportationEmission,
            transportLegs
        } = req.body;

        // Calculate total emissions for each category
        const totalRawMaterialsEmission = parseFloat(product.co2EmissionRawMaterials);
        const totalManufacturingEmission = parseFloat(product.co2EmissionFromProcesses);
        const totalTransportEmission = parseFloat(transportationEmission);

        // Process raw materials data
        const rawMaterialsContribution = product.materials.map(material => {
            const totalEmissionFactor = product.materials.reduce(
                (sum, item) => sum + item.emissionFactor, 0
            );
            const contributionPercentage = totalEmissionFactor > 0 
                ? (material.emissionFactor / totalEmissionFactor) * 100 
                : 0;

            return {
                materialClass: material.materialClass,
                specificMaterial: material.specificMaterial,
                emissionFactor: material.emissionFactor,
                contributionPercentage: parseFloat(contributionPercentage.toFixed(2))
            };
        });

        // Process manufacturing data
        const manufacturingContribution = product.productManufacturingProcess.map(process => {
            const totalEmissionFactor = product.productManufacturingProcess.reduce(
                (sum, item) => sum + item.emissionFactor, 0
            );
            const contributionPercentage = totalEmissionFactor > 0 
                ? (process.emissionFactor / totalEmissionFactor) * 100 
                : 0;

            return {
                materialClass: process.materialClass,
                manufacturingProcess: process.manufacturingProcesses[0].category,
                emissionFactor: process.emissionFactor,
                contributionPercentage: parseFloat(contributionPercentage.toFixed(2))
            };
        });

        // Process transportation data
        const processedTransportLegs = transportLegs.map(leg => {
            const totalEmissionFactor = transportLegs.reduce(
                (sum, item) => sum + item.transportEmission, 0
            );
            const contributionPercentage = totalEmissionFactor > 0 
                ? (leg.transportEmission / totalEmissionFactor) * 100 
                : 0;

            return {
                transportMode: leg.transportMode,
                originGateway: leg.originGateway,
                destinationGateway: leg.destinationGateway,
                transportEmission: leg.transportEmission,
                contributionPercentage: parseFloat(contributionPercentage.toFixed(2))
            };
        });

        // Create new mapping document
        const projectProductMapping = new ProjectProductMap({
            projectCode,
            productCode: product.productCode,
            rawMaterialsContribution,
            totalRawMaterialsEmission,
            manufacturingContribution,
            totalManufacturingEmission,
            transportationLegs: processedTransportLegs,
            totalTransportationEmission: totalTransportEmission
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