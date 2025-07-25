const logger = require("./logger");
const { makeOpenAIRequestWithRetry } = require("./chatGPTUtils");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Batch AI Processor for Multiple Products
 * 
 * This module provides optimized batch processing for products without images.
 * It sends multiple products in a single API request to reduce the number of requests
 * while staying within OpenAI's rate limits and token limits.
 */

// Define schemas for batch processing
const BatchProductClassificationSchema = z.object({
  products: z.array(z.object({
    productCode: z.string(),
    category: z.string(),
    subcategory: z.string()
  }))
});

const BatchBOMItemSchema = z.object({
  materialClass: z.string(),
  specificMaterial: z.string(),
  weight: z.number(),
  reasoning: z.string()
});

const BatchBOMSchema = z.object({
  products: z.array(z.object({
    productCode: z.string(),
    bom: z.array(BatchBOMItemSchema)
  }))
});

const BatchManufacturingProcessSchema = z.object({
  materialClass: z.string(),
  specificMaterial: z.string(),
  weight: z.number(),
  manufacturingProcesses: z.array(z.object({
    category: z.string(),
    processes: z.array(z.string())
  }))
});

const BatchManufacturingSchema = z.object({
  products: z.array(z.object({
    productCode: z.string(),
    processes: z.array(BatchManufacturingProcessSchema)
  }))
});

/**
 * Process batch product classification
 */
async function batchClassifyProducts(products, productCategories, req) {
  logger.info(`🔄 Batch classifying ${products.length} products`);

  const systemPrompt = `You are an expert product classification specialist. Your task is to classify multiple products simultaneously into appropriate categories and subcategories.

CLASSIFICATION PRINCIPLES:
1. You MUST ONLY select categories and subcategories EXACTLY as they appear in the provided list.
2. The category MUST be one of: ${Object.keys(productCategories).join(", ")}
3. Each subcategory MUST belong to its selected category.
4. DO NOT invent, modify, or generalize any category or subcategory values.
5. Process all products in the batch and return results for each one.

RESPONSE FORMAT:
{
  "products": [
    {
      "productCode": "<code>",
      "category": "<category>",
      "subcategory": "<subcategory>"
    }
  ]
}`;

  const productsData = products.map(product => 
    `Product Code: ${product.code}
Name: ${product.name}
Description: ${product.description}`
  ).join("\n\n---\n\n");

  const userPrompt = `Classify the following ${products.length} products:

${productsData}

Return results for ALL products in the specified JSON format.`;

  try {
    const completion = await makeOpenAIRequestWithRetry(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: zodResponseFormat(BatchProductClassificationSchema, "products"),
        temperature: 0,
      });
    });

    const result = JSON.parse(completion.choices[0].message.content);
    logger.info(`✅ Successfully batch classified ${result.products.length} products`);
    
    return {
      success: true,
      results: result.products,
      usage: completion.usage
    };

  } catch (error) {
    logger.error("❌ Batch product classification failed:", error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

/**
 * Process batch BOM classification
 */
async function batchClassifyBOM(products, materialsDatabase, req) {
  logger.info(`🔄 Batch BOM classification for ${products.length} products`);

  // Format materials database
  const materialsList = formatMaterialsDatabase(materialsDatabase);

  const systemPrompt = `You are an expert materials classification specialist. Analyze multiple products simultaneously to determine their bill of materials (BOM).

AVAILABLE MATERIALS:
${materialsList}

CLASSIFICATION PRINCIPLES:
1. You MUST ONLY use material classes and specific materials EXACTLY as they appear in the list above.
2. Distribute each product's total weight proportionally across materials.
3. Ensure each product's total weight equals exactly what was specified.
4. Process all products in the batch and return BOM for each one.

RESPONSE FORMAT:
{
  "products": [
    {
      "productCode": "<code>",
      "bom": [
        {
          "materialClass": "<class>",
          "specificMaterial": "<material>",
          "weight": <weight>,
          "reasoning": "<brief explanation>"
        }
      ]
    }
  ]
}`;

  const productsData = products.map(product => 
    `Product Code: ${product.code}
Name: ${product.name}
Description: ${product.description}
Total Weight: ${product.weight} kg`
  ).join("\n\n---\n\n");

  const userPrompt = `Analyze the following ${products.length} products for their bill of materials:

${productsData}

Return BOM results for ALL products in the specified JSON format.`;

  try {
    const completion = await makeOpenAIRequestWithRetry(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: zodResponseFormat(BatchBOMSchema, "products"),
        temperature: 0,
      });
    });

    const result = JSON.parse(completion.choices[0].message.content);
    logger.info(`✅ Successfully batch processed BOM for ${result.products.length} products`);
    
    return {
      success: true,
      results: result.products,
      usage: completion.usage
    };

  } catch (error) {
    logger.error("❌ Batch BOM classification failed:", error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

/**
 * Process batch manufacturing processes
 */
async function batchClassifyManufacturingProcesses(productsWithBOM, manufacturingProcesses, req) {
  logger.info(`🔄 Batch manufacturing process classification for ${productsWithBOM.length} products`);

  // Format manufacturing processes data
  const processesData = formatManufacturingProcesses(manufacturingProcesses);

  const systemPrompt = `You are an expert manufacturing process specialist. Classify multiple products into manufacturing processes based on their Bill of Materials (BOM).

AVAILABLE MANUFACTURING PROCESSES:
${processesData}

CLASSIFICATION PRINCIPLES:
1. Every material in each product's BOM MUST be included in the response EXACTLY as provided.
2. You MUST ONLY use manufacturing categories and processes from the list above.
3. Manufacturing processes must be relevant to the material class.
4. Process all products in the batch and return results for each one.

RESPONSE FORMAT:
{
  "products": [
    {
      "productCode": "<code>",
      "processes": [
        {
          "materialClass": "<class>",
          "specificMaterial": "<material>",
          "weight": <weight>,
          "manufacturingProcesses": [
            {
              "category": "<category>",
              "processes": ["<process1>", "<process2>"]
            }
          ]
        }
      ]
    }
  ]
}`;

  const productsData = productsWithBOM.map(product => {
    const bomText = product.bom.map(item => 
      `- Material Class: ${item.materialClass}, Specific Material: ${item.specificMaterial}, Weight: ${item.weight}kg`
    ).join("\n");
    
    return `Product Code: ${product.code}
Name: ${product.name}
Description: ${product.description}
Bill of Materials:
${bomText}`;
  }).join("\n\n---\n\n");

  const userPrompt = `Classify manufacturing processes for the following ${productsWithBOM.length} products:

${productsData}

Return manufacturing process results for ALL products in the specified JSON format.`;

  try {
    const completion = await makeOpenAIRequestWithRetry(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: zodResponseFormat(BatchManufacturingSchema, "products"),
        temperature: 0,
      });
    });

    const result = JSON.parse(completion.choices[0].message.content);
    logger.info(`✅ Successfully batch processed manufacturing for ${result.products.length} products`);
    
    return {
      success: true,
      results: result.products,
      usage: completion.usage
    };

  } catch (error) {
    logger.error("❌ Batch manufacturing classification failed:", error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

/**
 * Format materials database for prompt
 */
function formatMaterialsDatabase(materialsDatabase) {
  const materialsByClass = {};

  materialsDatabase.forEach(material => {
    if (!materialsByClass[material.materialClass]) {
      materialsByClass[material.materialClass] = new Set();
    }
    materialsByClass[material.materialClass].add(material.specificMaterial);
  });

  return Object.entries(materialsByClass)
    .map(([materialClass, specificMaterials]) => {
      const materialsStr = Array.from(specificMaterials).join(", ");
      return `- ${materialClass}: ${materialsStr}`;
    })
    .join("\n");
}

/**
 * Format manufacturing processes for prompt
 */
function formatManufacturingProcesses(manufacturingProcesses) {
  const processesByMaterial = {};

  manufacturingProcesses.forEach(item => {
    const materialClass = item.materialClass;
    const process = item.Process;
    
    if (!processesByMaterial[materialClass]) {
      processesByMaterial[materialClass] = new Set();
    }
    
    if (process) {
      processesByMaterial[materialClass].add(process);
    }
  });

  return Object.entries(processesByMaterial)
    .map(([materialClass, processes]) => {
      const processesStr = Array.from(processes).join(", ");
      return `- ${materialClass}: ${processesStr}`;
    })
    .join("\n");
}

/**
 * Estimate token count for batch processing
 * This helps determine optimal batch sizes to stay under TPM limits
 */
function estimateTokenCount(products) {
  // Rough estimation: ~3-4 tokens per word for input + response overhead
  const inputTokens = products.reduce((total, product) => {
    const textLength = (product.name + product.description + product.code).length;
    return total + Math.ceil(textLength / 4) * 3; // 3 tokens per 4 characters roughly
  }, 0);

  // Add overhead for system prompts and response structure
  const overhead = 2000; // Conservative overhead
  const responseTokens = products.length * 200; // ~200 tokens per product response

  return {
    estimated: inputTokens + overhead + responseTokens,
    inputTokens,
    responseTokens,
    overhead
  };
}

/**
 * Determine optimal batch size based on token limits
 */
function calculateOptimalBatchSize(products, maxTokensPerRequest = 100000) {
  if (products.length === 0) return 0;

  // Start with a small batch and estimate
  let batchSize = Math.min(5, products.length);
  let testBatch = products.slice(0, batchSize);
  let tokenEstimate = estimateTokenCount(testBatch);

  // Adjust batch size based on token estimate
  while (tokenEstimate.estimated < maxTokensPerRequest && batchSize < products.length) {
    batchSize = Math.min(batchSize + 1, products.length);
    testBatch = products.slice(0, batchSize);
    tokenEstimate = estimateTokenCount(testBatch);
  }

  // Go one step back if we exceeded the limit
  if (tokenEstimate.estimated > maxTokensPerRequest && batchSize > 1) {
    batchSize--;
  }

  logger.info(`📊 Optimal batch size: ${batchSize} products (estimated ${tokenEstimate.estimated} tokens)`);
  
  return Math.max(1, batchSize); // Ensure at least 1
}

module.exports = {
  batchClassifyProducts,
  batchClassifyBOM,
  batchClassifyManufacturingProcesses,
  estimateTokenCount,
  calculateOptimalBatchSize
};