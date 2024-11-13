const dotenv = require('dotenv');
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const axios = require('axios');
const manufacturingProcesses = require('./data/manufacturingProcesses.json');
const billOfMaterials = require('./data/billOfMaterials.json');
const productCategories = require('./data/productCategories.json');

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB();

// Middleware to parse JSON
app.use(express.json());

app.use(cors({ origin: 'http://127.0.0.1:5500' }));

const openaiApiKey = process.env.OPENAI_API_KEY;

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);

// Function to format the product categories as a string for the prompt
const formatCategoriesList = (categories) => {
    return Object.entries(categories)
        .map(([category, subcategories]) => `- ${category}: ${subcategories.join(', ')}`)
        .join('\n');
};

// Endpoint to classify product based on product details
app.post('/api/classify-product', async (req, res) => {
    const { productCode, description, name } = req.body;

    if (!productCode || !description || !name) {
        return res.status(400).json({ error: 'Product code, description, and name are required.' });
    }

    try {
        // Dynamically generate categories list for the prompt
        const categoriesList = formatCategoriesList(productCategories);

        // Construct prompt for classification
        const prompt = `Classify the following product into a category and subcategory, choosing only from the provided list:

Product Code: ${productCode}
Product Name: ${name}
Product Description: ${description}

Categories and Subcategories:
${categoriesList}

Return the result in this format:
{
    "category": "<category>",
    "subcategory": "<subcategory>"
}`;

        // Send the prompt to OpenAI API
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-3.5-turbo", // or another model if desired
                messages: [{ role: "user", content: prompt }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Parse the response
        const chatCompletion = response.data.choices[0].message.content;
        const result = JSON.parse(chatCompletion); // Ensure response is valid JSON

        res.json(result);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

// Endpoint for classification of manufacturing process
app.post('/api/classify-manufacturing-process', async (req, res) => {
    const { productCode, name, description } = req.body;

    if (!productCode || !name || !description) {
        return res.status(400).json({ error: "Product code, name, and description are required." });
    }

    try {
        // Convert manufacturing processes to a formatted string for the prompt
        const formattedProcesses = Object.entries(manufacturingProcesses)
            .map(([category, processes]) => `- ${category}: ${processes.join(', ') || "No specific processes listed"}`)
            .join('\n');

        // Prompt to send to OpenAI for classification
        const prompt = `
Classify the following product into manufacturing categories and processes based on the provided list. If applicable, return multiple categories, each with a list of relevant processes.

Product Code: ${productCode}
Product Name: ${name}
Product Description: ${description}

Categories and Processes:
${formattedProcesses}

Return the result in this format:
{
    "categories": [
        {
            "category": "<category1>",
            "processes": ["<process1>", "<process2>", "..."]
        },
        {
            "category": "<category2>",
            "processes": ["<process1>", "<process2>", "..."]
        }
    ]
}
        `;

        // Send the prompt to OpenAI API
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }]
            },
            {
                headers: {
                    Authorization: `Bearer ${openaiApiKey}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // Parse the response to handle multiple categories, each with an array of processes
        const chatCompletion = response.data.choices[0].message.content;
        const result = JSON.parse(chatCompletion);

        res.json({
            categories: result.categories || []  // Ensure categories is an array, even if empty
        });
    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
        res.status(500).json({ error: "An error occurred while processing your request." });
    }
});

// Function to format the BOM data as a string for the prompt
const formatBOMList = (bom) => {
    return Object.entries(bom)
        .map(([category, materials]) => `- ${category}: ${materials.join(', ')}`)
        .join('\n');
};

// Endpoint to classify BOM based on product details
app.post('/api/classify-bom', async (req, res) => {
    const { productCode, name, description } = req.body;

    if (!productCode || !name || !description) {
        return res.status(400).json({ error: 'Product code, name, and description are required.' });
    }

    try {
        // Dynamically generate BOM list for the prompt
        const bomList = formatBOMList(billOfMaterials);

        // Construct prompt for BOM classification
        const prompt = `
Classify the following product based on its description and assign relevant materials from the predefined list.

Product Code: ${productCode}
Product Name: ${name}
Product Description: ${description}

Bill of Materials:
${bomList}

Return the result in the following format:
{
    "materials": [
        {
            "category": "<category>",
            "materials": ["<material1>", "<material2>", "..."]
        }
    ]
}
        `;

        // Send the prompt to OpenAI API
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Parse the response
        const chatCompletion = response.data.choices[0].message.content;
        const result = JSON.parse(chatCompletion);

        res.json(result);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});


// Endpoint to return all categories only
app.get('/api/categories', (req, res) => {
    const categories = Object.keys(productCategories); // Extract keys (categories) only
    res.json(categories);
});

// Endpoint to return subcategories based on the given category
app.get('/api/subcategories', (req, res) => {
    const category = req.query.category;

    if (!category) {
        return res.status(400).json({ error: "Category is required as a query parameter." });
    }

    const subcategories = productCategories[category];

    if (!subcategories) {
        return res.status(404).json({ error: "Category not found" });
    }

    res.json(subcategories);
});

