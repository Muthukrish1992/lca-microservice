// utils/productUtils.js

const emissionData = require("../data/materials_database.json");
const processing_database = require("../data/processing_database.json");

const calculateMaterialEmissions = (materials, countryOfOrigin) => {
    return materials.reduce((total, material) => {
        const emissionFactorData = emissionData.find(data =>
            data.countryOfOrigin === countryOfOrigin &&
            data.materialClass === material.materialClass &&
            data.specificMaterial === material.specificMaterial
        ) || { EmissionFactor: Math.random() * 10 };

        material.emissionFactor = emissionFactorData.EmissionFactor * material.weight;
        return total + material.emissionFactor;
    }, 0);
};

const calculateProcessEmissions = (productManufacturingProcess) => {
    return productManufacturingProcess.reduce((total, materialProcess) => {
        return total + materialProcess.manufacturingProcesses.reduce((processTotal, processGroup) => {
            return processTotal + processGroup.processes.reduce((innerTotal, processName) => {
                const processData = processing_database.find(data =>
                    data.Category === processGroup.category &&
                    data.SubType === processName
                ) || { Value: Math.random() * 10 };

                materialProcess.emissionFactor = processData.Value * materialProcess.weight;
                return innerTotal + materialProcess.emissionFactor;
            }, 0);
        }, 0);
    }, 0);
};

const calculateTotalEmissions = (materials, countryOfOrigin, productManufacturingProcess) => {
    const co2EmissionRawMaterials = calculateMaterialEmissions(materials, countryOfOrigin);
    const co2EmissionFromProcesses = calculateProcessEmissions(productManufacturingProcess);
    return {
        co2EmissionRawMaterials,
        co2EmissionFromProcesses,
        co2Emission: co2EmissionRawMaterials + co2EmissionFromProcesses
    };
};

const validateProductFields = (productData) => {
    const requiredFields = ['code', 'name', 'materials', 'productManufacturingProcess'];
    const missingFields = requiredFields.filter(field => !productData[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    return true;
};

module.exports = {
    calculateMaterialEmissions,
    calculateProcessEmissions,
    calculateTotalEmissions,
    validateProductFields
};