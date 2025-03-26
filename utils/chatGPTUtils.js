const axios = require("axios");
require("dotenv").config();

const productCategories = require("../data/productCategories.json");
const billOfMaterials = require("../data/billOfMaterials.json");
const manufacturingProcesses = require("../data/manufacturingProcesses.json");
const materialsDatabaseBasic = require("../data/materials_database_basic.json");
const manufacturingProcessesBasic = require("../data/manufacturingProcesses_basic.json");

const { updateAITokens } = require("../utils/utils");

const OpenAI = require("openai");
const { zodResponseFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const Fuse = require("fuse.js");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the Zod schema for structured output validation
const ClassificationSchema = z.object({
  category: z.string(),
  subcategory: z.string(),
});

// Define the Zod schema for BOM classification output
const BOMItemSchema = z.object({
  materialClass: z.string(),
  specificMaterial: z.string(),
  weight: z.number(),
});

// Define the Zod schema for BOM classification output
const BOMItemSchemaBasic = z.object({
  materialClass: z.string(),
  weight: z.number(),
});

const BOMSchema = z.object({
  bom: z.array(BOMItemSchema), // Wrap the array inside a "bom" key
});
const BOMSchemaBasic = z.object({
  bom: z.array(BOMItemSchemaBasic), // Wrap the array inside a "bom" key
});

// Define the schema for the manufacturing process response
const ManufacturingProcessSchema = z.object({
  materialClass: z.string(),
  specificMaterial: z.string(),
  weight: z.number(),
  manufacturingProcesses: z.array(
    z.object({
      category: z.string(),
      processes: z.array(z.string()),
    })
  ),
});

const ManufacturingSchema = z.object({
  processes: z.array(ManufacturingProcessSchema), // Wrap in an object key
});

// Define the schema for the basic manufacturing process response
const ManufacturingProcessSchemaBasic = z.object({
  materialClass: z.string(),
  weight: z.number(),
  manufacturingProcesses: z.array(
    z.object({
      category: z.string(),
      processes: z.array(z.string()),
    })
  ),
});

const ManufacturingSchemaBasic = z.object({
  processes: z.array(ManufacturingProcessSchemaBasic), // Wrap in an object key
});

// Format manufacturing processes as a string for the prompt
const formatManufacturingProcesses = () => {
  return Object.entries(manufacturingProcesses)
    .map(
      ([category, processes]) =>
        `- ${category}: ${
          processes.join(", ") || "No specific processes listed"
        }`
    )
    .join("\n");
};

// Format basic manufacturing processes as a string for the prompt
const formatManufacturingProcessesBasic = () => {
  return Object.entries(manufacturingProcessesBasic)
    .map(
      ([category, processes]) =>
        `- ${category}: ${
          processes.join(", ") || "No specific processes listed"
        }`
    )
    .join("\n");
};

/**
 * Finds the closest match from a list using Fuse.js for fuzzy matching.
 */
function findClosestMatch(input, validOptions) {
  const fuse = new Fuse(validOptions, { threshold: 0.4 });
  const result = fuse.search(input);
  return result.length > 0 ? result[0].item : validOptions[0]; // Default to first valid option
}

// Function to format the BOM data as a string for the prompt
const formatBOMList = () => {
  return Object.entries(billOfMaterials)
    .map(([category, materials]) => `- ${category}: ${materials.join(", ")}`)
    .join("\n");
};

async function classifyProduct(productCode, name, description, req) {
  console.log(`🚀 Starting classification for product: ${productCode}`);
  
  if (!name || !description) {
    console.log(`❌ Missing required fields for product: ${productCode}`);
    throw new Error("Product code, name, and description are required.");
  }

  console.log(`📋 Preparing categories list for prompt`);
  // Construct categories list for the prompt
  const categoriesList = Object.entries(productCategories)
    .map(
      ([category, subcategories]) =>
        `${category}:\n  - ${subcategories.join("\n  - ")}`
    )
    .join("\n\n");

  console.log(`📝 Building classification prompt`);
  // Prompt for classification
  const prompt = `Classify the following product into a category and subcategory from the given list.
  
  Product Code: ${productCode}
  Product Name: ${name}
  Product Description: ${description}
  
  Categories and Subcategories:
  ${categoriesList}
  
  Return the result in JSON format:
  {
      "category": "<category>",
      "subcategory": "<subcategory>"
  }
  
  Ensure the subcategory belongs to the category. If no exact match is found, return the closest valid subcategory.`;

  try {
    console.log(`🤖 Sending request to AI model for product: ${productCode}`);
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini-2024-07-18", // Ensure model supports structured outputs
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(
        ClassificationSchema,
        "classification"
      ),
    });

    let result = completion.choices[0].message.parsed;
    console.log(`✅ Received AI classification response: ${JSON.stringify(result)}`);

    updateAITokens(req, completion.usage.total_tokens);
    console.log(`📊 Updated token usage: ${completion.usage.total_tokens} tokens`);

    // Validate the category and subcategory
    if (!productCategories[result.category]) {
      console.log(`⚠️ Invalid category "${result.category}". Finding closest match...`);
      result.category = findClosestMatch(
        result.category,
        Object.keys(productCategories)
      );
      console.log(`🔄 Adjusted category to: ${result.category}`);
    }
    
    if (!productCategories[result.category].includes(result.subcategory)) {
      console.log(`⚠️ Invalid subcategory "${result.subcategory}" for category "${result.category}". Finding closest match...`);
      result.subcategory = findClosestMatch(
        result.subcategory,
        productCategories[result.category]
      );
      console.log(`🔄 Adjusted subcategory to: ${result.subcategory}`);
    }

    console.log(`✅ Final classification for ${productCode}: Category=${result.category}, Subcategory=${result.subcategory}`);
    return result;
  } catch (error) {
    console.error(`❌ Classification failed for ${productCode}: ${error.message}`);
    console.log(`⚠️ Using default fallback classification for ${productCode}`);
    return { category: "Uncategorized", subcategory: "Other" }; // Default fallback
  }
}

const cacheClassifyBOM = new Map();

// Function to format the materials database basic data as a string for the prompt
const formatMaterialsDatabaseBasic = () => {
  return materialsDatabaseBasic
    .map((material) => `- ${material.materialClass}`)
    .join("\n");
};

const classifyBOMBasic = async (
  productCode,
  name,
  description,
  weight,
  imageUrl,
  req
) => {
  const keyClassifyBOM = JSON.stringify({
    productCode,
    name,
    description,
    weight,
    imageUrl,
  });

  if (cacheClassifyBOM.has(keyClassifyBOM)) {
    return cacheClassifyBOM.get(keyClassifyBOM);
  }

  const materialsList = formatMaterialsDatabaseBasic();
  const prompt = `
You are an assistant tasked with classifying products based on their description and analyzing an image to determine the composition of materials. 

### **Product Details**:
- **Code**: ${productCode}
- **Name**: ${name}
- **Description**: ${description}
- **Total Weight**: ${weight} kg

### **Available Materials**:
${materialsList}

### **Your Task**:
1. Analyze the text description and image (if provided) to determine relevant materials.
2. Distribute the total weight (${weight} kg) proportionally across these materials.
3. Ensure the total weight of all materials adds up **exactly** to ${weight} kg.
4. Return the result **strictly as a valid JSON array** in the following format:

[
    {
        "materialClass": "<category>",
        "weight": <weight>
    }
]


### **Important Rules**:
- If an image is provided, use it to refine material classification.
- The total weight must match exactly **${weight} kg**.
- Do **not** include any explanation, extra text, or formatting outside the JSON array.
`;

  try {
    const messages = [{ type: "text", text: prompt }];

    if (imageUrl) {
      messages.push({ type: "image_url", image_url: { url: imageUrl } }); // ✅ Fixed structure
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Supports text + image analysis
      messages: [{ role: "user", content: messages }],
      response_format: zodResponseFormat(BOMSchemaBasic, "bom"),
      temperature: 0,
    });

    const result = JSON.parse(response.choices[0].message.content).bom; // ✅ Fixed response parsing

    updateAITokens(req, response.usage.total_tokens);

    // Validate and adjust material categories
    result.forEach((item) => {
      if (
        !materialsDatabaseBasic.some(
          (material) => material.materialClass === item.materialClass
        )
      ) {
        item.materialClass = findClosestMatch(
          item.materialClass,
          materialsDatabaseBasic.map((material) => material.materialClass)
        );
      }
    });

    // Validate total weight
    const totalWeight = result.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(totalWeight - weight) > 0.01) {
      throw new Error(
        `Total weight mismatch: expected ${weight} kg, but got ${totalWeight} kg.`
      );
    }

    cacheClassifyBOM.set(keyClassifyBOM, result);
    return result;
  } catch (error) {
    console.error(
      "Error classifying BOM:",
      error.response?.data || error.message
    );
    throw new Error("An error occurred while classifying the BOM.");
  }
};

const classifyBOM = async (
  productCode,
  name,
  description,
  weight,
  imageUrl,
  req
) => {
  const keyClassifyBOM = JSON.stringify({
    productCode,
    name,
    description,
    weight,
    imageUrl,
  });

  if (cacheClassifyBOM.has(keyClassifyBOM)) {
    return cacheClassifyBOM.get(keyClassifyBOM);
  }

  const bomList = formatBOMList();
  const prompt = `
You are an assistant tasked with classifying products based on their description and analyzing an image to determine the composition of materials. 

### **Product Details**:
- **Code**: ${productCode}
- **Name**: ${name}
- **Description**: ${description}
- **Total Weight**: ${weight} kg

### **Available Materials**:
${bomList}

### **Your Task**:
1. Analyze the text description and image (if provided) to determine relevant materials.
2. Distribute the total weight (${weight} kg) proportionally across these materials.
3. Ensure the total weight of all materials adds up **exactly** to ${weight} kg.
4. Return the result **strictly as a valid JSON array** in the following format:

[
    {
        "materialClass": "<category>",
        "specificMaterial": "<material>",
        "weight": <weight>
    }
]


### **Important Rules**:
- If an image is provided, use it to refine material classification.
- The total weight must match exactly **${weight} kg**.
- Do **not** include any explanation, extra text, or formatting outside the JSON array.
`;

  try {
    const messages = [{ type: "text", text: prompt }];

    if (imageUrl) {
      messages.push({ type: "image_url", image_url: { url: imageUrl } }); // ✅ Fixed structure
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Supports text + image analysis
      messages: [{ role: "user", content: messages }],
      response_format: zodResponseFormat(BOMSchema, "bom"),
      temperature: 0,
    });

    const result = JSON.parse(response.choices[0].message.content).bom; // ✅ Fixed response parsing

    updateAITokens(req, response.usage.total_tokens);

    // Validate and adjust material categories
    result.forEach((item) => {
      if (!billOfMaterials[item.materialClass]) {
        item.materialClass = findClosestMatch(
          item.materialClass,
          Object.keys(billOfMaterials)
        );
      }
    });

    // Validate total weight
    const totalWeight = result.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(totalWeight - weight) > 0.01) {
      throw new Error(
        `Total weight mismatch: expected ${weight} kg, but got ${totalWeight} kg.`
      );
    }

    cacheClassifyBOM.set(keyClassifyBOM, result);
    return result;
  } catch (error) {
    console.error(
      "Error classifying BOM:",
      error.response?.data || error.message
    );
    throw new Error("An error occurred while classifying the BOM.");
  }
};

const classifyManufacturingProcess = async (
  productCode,
  name,
  description,
  bom,
  req
) => {
  const formattedProcesses = formatManufacturingProcesses();

  const formattedBoM = bom
    .map(
      (item) =>
        `- Material Class: ${item.materialClass}, Specific Material: ${item.specificMaterial}, Weight: ${item.weight}kg`
    )
    .join("\n");

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
{
  "processes": [
    {
      "materialClass": "<materialClass>",
      "specificMaterial": "<specificMaterial>",
      "weight": <weight>,
      "manufacturingProcesses": [
        {
          "category": "<category1>",
          "processes": ["<process1>", "..."]
        }
      ]
    }
  ]
}

Rules:
1. Every material in the BoM must be included in the response, and each must have at least one manufacturing process.
2. If no specific processes apply, assign a general process like "General Processing."
3. Use only the categories and processes provided above.
4. Do not include any materialClass or specificMaterial that is not listed in the Bill of Materials (BoM).

Important:
- Do not include any text, explanation, or extra characters outside of the JSON object.
- Ensure the result is strictly valid JSON.
`;

  try {
    const response = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(ManufacturingSchema, "processes"),
    });

    const result = response.choices[0].message.parsed.processes; // Access the 'processes' array

    updateAITokens(req, response.usage.total_tokens);

    return result;
  } catch (error) {
    console.error(
      "Error classifying manufacturing process:",
      error.response?.data || error.message
    );
    throw new Error(
      "An error occurred while classifying the manufacturing process."
    );
  }
};

const classifyManufacturingProcessBasic = async (
  productCode,
  name,
  description,
  bom,
  req
) => {
  const formattedProcesses = formatManufacturingProcessesBasic();

  const formattedBoM = bom
    .map(
      (item) =>
        `- Material Class: ${item.materialClass}, Weight: ${item.weight}kg`
    )
    .join("\n");

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
{
  "processes": [
    {
      "materialClass": "<materialClass>",
      "weight": <weight>,
      "manufacturingProcesses": [
        {
          "category": "<category1>",
          "processes": ["<process1>", "..."]
        }
      ]
    }
  ]
}

Rules:
1. Every material in the BoM must be included in the response, and each must have at least one manufacturing process.
2. If no specific processes apply, assign a general process like "General Processing."
3. Use only the categories and processes provided above.
4. Do not include any materialClass that is not listed in the Bill of Materials (BoM).

Important:
- Do not include any text, explanation, or extra characters outside of the JSON object.
- Ensure the result is strictly valid JSON.
`;

  try {
    const response = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(ManufacturingSchemaBasic, "processes"),
    });

    const result = response.choices[0].message.parsed.processes; // Access the 'processes' array

    updateAITokens(req, completion.usage.total_tokens);

    return result;
  } catch (error) {
    console.error(
      "Error classifying manufacturing process:",
      error.response?.data || error.message
    );
    throw new Error(
      "An error occurred while classifying the manufacturing process."
    );
  }
};

module.exports = {
  classifyProduct,
  classifyBOM,
  classifyBOMBasic,
  classifyManufacturingProcess,
  classifyManufacturingProcessBasic,
};
