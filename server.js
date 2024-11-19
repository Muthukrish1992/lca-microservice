const dotenv = require("dotenv");
const express = require("express");
const connectDB = require("./config/db");
const cors = require("cors");
const axios = require("axios");
const manufacturingProcesses = require("./data/manufacturingProcesses.json");
const billOfMaterials = require("./data/billOfMaterials.json");
const productCategories = require("./data/productCategories.json");

dotenv.config();
const app = express();

// Connect to MongoDB
connectDB();

// Middleware to parse JSON
app.use(express.json());

app.use(
    cors({
      origin: "*", // Allow both origins
    })
  );

const openaiApiKey = process.env.OPENAI_API_KEY;

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const productRoutes = require("./routes/productRoutes");
app.use("/api/products", productRoutes);

app.post("/api/classify-product", async (req, res) => {
  const { productCode, description, name } = req.body;

  if (!name) {
    return res
      .status(400)
      .json({ error: "Product code, description, and name are required." });
  }

  try {
    // Dynamically generate categories list for the prompt
    const categoriesList = Object.entries(productCategories)
      .map(
        ([category, subcategories]) =>
          `${category}:\n  - ${subcategories.join("\n  - ")}`
      )
      .join("\n\n");

    // Construct prompt for classification
    const prompt = `Classify the following product into a category and subcategory. Ensure the subcategory is chosen strictly from the correct category listed below.

Product Code: ${productCode}
Product Name: ${name}
Product Description: ${description}

Categories and Subcategories:
${categoriesList}

Return the result in this format:
{
    "category": "<category>",
    "subcategory": "<subcategory>"
}

Ensure that the subcategory belongs to the category.`;

    // Send the prompt to OpenAI API
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o", // Updated model to "gpt-4o"
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Parse the response safely, ensuring clean JSON format
    const chatCompletion = response.data.choices[0].message.content;

    // Clean the response to remove markdown or any extraneous characters
    const cleanedResponse = chatCompletion.replace(/```json|```/g, "").trim();

    // Parse the cleaned response
    let result;
    try {
      result = JSON.parse(cleanedResponse); // Parse the clean JSON string
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Invalid response format from AI." });
    }

    // Validate the subcategory within the chosen category
    const validSubcategories = productCategories[result.category] || [];
    if (!validSubcategories.includes(result.subcategory)) {
      return res
        .status(400)
        .json({ error: "Invalid subcategory for the given category." });
    }

    res.json(result);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request." });
  }
});

// Endpoint for classification of manufacturing process
app.post("/api/classify-manufacturing-process", async (req, res) => {
    const { productCode, name, description , bom } = req.body;
  
  
    if (!productCode || !name || !description || !bom) {
      return res
        .status(400)
        .json({ error: "Product code, name, description and Bill of Materials are required." });
    }
  
    try {
      // Format manufacturing processes into a structured string
      const formattedProcesses = Object.entries(manufacturingProcesses)
        .map(
          ([category, processes]) =>
            `- ${category}: ${processes.join(", ") || "No specific processes listed"}`
        )
        .join("\n");
  
      // Format the Bill of Materials (BoM) for the prompt
      const formattedBoM = bom
        .map(
          (item) =>
            `- Material Class: ${item.materialClass}, Specific Material: ${item.specificMaterial}, Weight: ${item.weight}kg`
        )
        .join("\n");
  
      // Build the OpenAI prompt
      const prompt = `
Classify the following product into manufacturing processes strictly based on the materials provided in the Bill of Materials (BoM). Ensure that every material listed in the BoM is included in the response. Each material must have at least one manufacturing process. If no specific process applies, assign a general process like "General Processing."

Product Code: ${productCode}
Product Name: ${name}
Product Description: ${description}

Bill of Materials (BoM):
${formattedBoM}

Categories and Processes:
${formattedProcesses}

Return the result in this format:
[
  {
    "materialClass": "<materialClass>",
    "specificMaterial": "<specificMaterial>",
    "manufacturingProcesses": [
      {
        "category": "<category1>",
        "processes": ["<process1>", "..."]
      }
    ]
  },
  ...
]

Rules:
1. Every material in the BoM must be included in the response, and each must have at least one manufacturing process.
2. If no specific processes apply, assign a general process like "General Processing."
3. Use only the categories and processes provided above.
4. Do not include any materialClass or specificMaterial that is not listed in the Bill of Materials (BoM).

Important:
- Do not include any text, explanation, or extra characters outside of the JSON array.
- Ensure the result is strictly valid JSON.

Example Output:
[
  {
    "materialClass": "Metal",
    "specificMaterial": "Steel",
    "manufacturingProcesses": [
      {
        "category": "Metal",
        "processes": ["Cutting", "Welding"]
      }
    ]
  },
  {
    "materialClass": "Fabric",
    "specificMaterial": "Mesh",
    "manufacturingProcesses": [
      {
        "category": "Fabric",
        "processes": ["General Processing"]
      }
    ]
  }
]
`;
  
      // Send the prompt to OpenAI API
      const openaiApiKey = process.env.OPENAI_API_KEY; // Ensure API key is in environment variables
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
  
      // Parse the response and return the result
      const chatCompletion = response.data.choices[0]?.message?.content || "[]";
      const result = JSON.parse(chatCompletion);
  
      res.json(result);
    } catch (error) {
      console.error("Error:", error.response?.data || error.message);
  
      res.status(500).json({
        error: "An error occurred while processing your request.",
        details: error.response?.data || error.message,
      });
    }
  });

// Function to format the BOM data as a string for the prompt
const formatBOMList = (bom) => {
    return Object.entries(bom)
        .map(([category, materials]) => `- ${category}: ${materials.join(', ')}`)
        .join('\n');
}

app.post("/api/classify-bom", async (req, res) => {
    const { productCode, name, description, weight } = req.body;

    if (!productCode || !name || !description || weight === undefined) {
        return res
            .status(400)
            .json({ error: "Product code, name, description, and weight are required." });
    }

    try {
        // Dynamically generate BOM list for the prompt
        const bomList = formatBOMList(billOfMaterials);

        // Updated prompt for flat list format
        const prompt = `
You are an assistant tasked with classifying products based on their description and distributing a given weight across identified materials.

Product Details:
- Code: ${productCode}
- Name: ${name}
- Description: ${description}
- Total Weight: ${weight} kg

Available Materials:
${bomList}

Your task:
1. Identify relevant materials from the list.
2. Distribute the total weight (${weight} kg) across these materials proportionally based on the description.
3. Ensure that the total weight of all materials adds up exactly to ${weight} kg.
4. Return the result as a flat list in the following JSON format:

[
    {
        "materialClass": "<category>",
        "specificMaterial": "<material>",
        "weight": <weight>
    }
]

Important:
- Do not include any text, explanation, or extra characters outside of the JSON array.
- Ensure the result is strictly valid JSON.
- Ensure the total weight equals ${weight} kg.

Now, classify the product and provide the result.
`;

        // Send the prompt to OpenAI API using gpt-4o
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
            },
            {
                headers: {
                    Authorization: `Bearer ${openaiApiKey}`,
                    "Content-Type": "application/json",
                },
            }
        );

        // Extract the content of the response
        const chatCompletion = response.data.choices[0].message.content;

        // Clean the response to remove "```json" or "```" and trim whitespace
        const cleanedResponse = chatCompletion
            .replace(/```json|```/g, "") // Remove code fences
            .trim(); // Remove extra spaces or line breaks

        // Attempt to parse the cleaned response as JSON
        let result;
        try {
            result = JSON.parse(cleanedResponse);
        } catch (error) {
            console.error("Error parsing JSON response:", cleanedResponse);
            return res.status(500).json({ error: "Failed to parse JSON from AI response." });
        }

        // Validate the weights in the flat list
        const totalWeightCalculated = result
            .map((material) => material.weight) // Directly access flat list weights
            .reduce((sum, materialWeight) => sum + materialWeight, 0);

        if (Math.abs(totalWeightCalculated - weight) > 0.01) {
            console.warn(
                `Weight mismatch: expected ${weight}, got ${totalWeightCalculated}`
            );
            return res
                .status(400)
                .json({ error: "Total weight of materials does not match the provided weight." });
        }

        res.json(result);
    } catch (error) {
        console.error("Error:", error.response?.data || error.message);
        res
            .status(500)
            .json({ error: "An error occurred while processing your request." });
    }
});

  
  
  
  

// Endpoint to return all categories only
app.get("/api/categories", (req, res) => {
  const categories = Object.keys(productCategories); // Extract keys (categories) only
  res.json(categories);
});

// Endpoint to return subcategories based on the given category
app.get("/api/subcategories", (req, res) => {
  const category = req.query.category;

  if (!category) {
    return res
      .status(400)
      .json({ error: "Category is required as a query parameter." });
  }

  const subcategories = productCategories[category];

  if (!subcategories) {
    return res.status(404).json({ error: "Category not found" });
  }

  res.json(subcategories);
});

// Endpoint to return subcategories based on the given category
app.get("/api/productCategories", (req, res) => {
  res.json(productCategories);
});
