const express = require('express');
const Product = require('../models/Product');
const router = express.Router();
const emissionData = require("../data/materials_database.json");
const processing_database = require("../data/processing_database.json");

router.delete('/', async (req, res) => {
    try {
        const result = await Product.deleteMany({});
        res.status(200).json({
            message: 'All products have been deleted successfully.',
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Create Product
router.post('/', async (req, res) => {
    try {
        const {
            code,
            name,
            description,
            weight,
            countryOfOrigin,
            category,
            subCategory,
            brandName,
            supplierName,
            materials,
            images, 
            productManufacturingProcess,
        } = req.body;

        // Calculate CO2 Emission
        let co2EmissionRawMaterials = materials.reduce((total, material) => {
            let emissionFactorData = emissionData.find(data =>
                data.countryOfOrigin === countryOfOrigin &&
                data.materialClass === material.materialClass &&
                data.specificMaterial === material.specificMaterial
            );

            if (!emissionFactorData) {
                const randomValue = Math.random() * 10; // Random number between 0 and 110
                emissionFactorData = { EmissionFactor: randomValue };
                //throw new Error(`Emission factor not found for material: ${material.specificMaterial} in ${countryOfOrigin}`);
            }

            // Calculate emission for this material and add to the total
            material.emissionFactor = emissionFactorData.EmissionFactor * material.weight;
            return total + (emissionFactorData.EmissionFactor * material.weight);
        }, 0);

        const co2EmissionFromProcesses = productManufacturingProcess.reduce((total, materialProcess) => {
            return total + materialProcess.manufacturingProcesses.reduce((processTotal, processGroup) => {
                return processTotal + processGroup.processes.reduce((innerTotal, processName) => {
                    let processData = processing_database.find(data =>
                        data.Category === processGroup.category &&
                        data.SubType === processName
                    );
        
                    if (!processData) {
                        const randomValue = Math.random() * 10; // Random number between 0 and 110
                        processData = { Value: randomValue };
                        //throw new Error(`Emission factor not found for process: ${processName} in category: ${processGroup.category} for material: ${materialProcess.specificMaterial}`);
                    }

                    materialProcess.emissionFactor = processData.Value * materialProcess.weight;
        
                    // Calculate emission for this process and add to the inner total
                    return innerTotal + (processData.Value * materialProcess.weight);
                }, 0);
            }, 0);
        }, 0);
        
        let co2Emission = co2EmissionRawMaterials + co2EmissionFromProcesses;


        // Create a new Product document
        const newProduct = new Product({
            code,
            name,
            description,
            weight,
            countryOfOrigin,
            category,
            subCategory,
            brandName,
            supplierName,
            materials,
            images, // Add the images field to the document
            modifiedDate: new Date(),
            createdDate: new Date(),
            co2Emission: co2Emission,
            co2EmissionRawMaterials : co2EmissionRawMaterials,
            co2EmissionFromProcesses : co2EmissionFromProcesses,
            productManufacturingProcess,
        });

        // Save the new product
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Read all Products
router.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Read Product by ID
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) res.json(product);
        else res.status(404).json({ message: 'Product not found' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Product
router.put('/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete Product
router.delete('/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
