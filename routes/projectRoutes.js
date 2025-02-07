const express = require('express');
const Project = require('../models/Project');
const router = express.Router();

// Create Project
router.post('/', async (req, res) => {
    try {
        const { code, name } = req.body;

        // Create a new Project document
        const newProject = new Project({
            code,
            name,
            modifiedDate: new Date(),
            createdDate: new Date(),
        });

        // Save the new project
        const savedProject = await newProject.save();
        res.status(201).json(savedProject);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 