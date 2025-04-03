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
 * Finds the closest match from a list using advanced fuzzy matching with intelligent term extraction.
 * 
 * Handles descriptive input like "Solid Oak" by recognizing that "Oak" is the key term.
 * Tries multiple matching strategies to find the best possible match:
 * 1. Exact match (with normalization)
 * 2. Contains match (input is a substring of an option)
 * 3. Key term extraction (for descriptive inputs)
 * 4. Fuzzy matching with both full input and extracted key terms
 * 5. Partial term matching as fallback
 * 
 * @param {string} input - The input string to match
 * @param {string[]|Object[]} validOptions - Array of valid options to match against.
 *                                       Can be an array of strings or objects with {value, weight} properties
 * @param {Object} options - Additional options for matching
 * @param {number} options.threshold - Threshold for fuzzy matching (0-1, lower is stricter)
 * @param {number} options.minScore - Minimum score to consider a match valid (0-1)
 * @param {boolean} options.returnDetails - Whether to return detailed match info
 * @param {boolean} options.ignoreCase - Whether to ignore case in string comparison
 * @param {boolean} options.normalizeInput - Whether to normalize input (remove special chars)
 * @param {boolean} options.useWeights - Whether to use weights in scoring (if validOptions contains weighted objects)
 * @returns {string|Object} - The closest matching string or match details object with information about the match type
 * 
 * @example
 * // Simple matching
 * findClosestMatch("Oak", ["Pine", "Oak", "Maple"]) // Returns "Oak"
 * 
 * // Descriptive matching with key term extraction
 * findClosestMatch("Solid Oak", ["Pine", "Oak", "Maple"]) // Returns "Oak"
 * 
 * // With details
 * findClosestMatch("Solid Oak", ["Pine", "Oak", "Maple"], {returnDetails: true})
 * // Returns {match: "Oak", score: 0.95, isExact: false, matchType: "keyTerm", ...}
 */
function findClosestMatch(input, validOptions, options = {}) {
  // Default options
  const {
    threshold = 0.4, 
    minScore = 0,
    returnDetails = false,
    ignoreCase = true,
    normalizeInput = true,
    useWeights = false
  } = options;
  
  const logger = console.log;
  
  // Handle edge cases
  if (!input || typeof input !== 'string') {
    logger('⚠️ Invalid input provided to findClosestMatch:', input);
    
    // Return first option if available, otherwise return null
    const defaultOption = validOptions && validOptions.length > 0 
      ? (useWeights ? validOptions[0].value : validOptions[0]) 
      : null;
    
    return returnDetails 
      ? { match: defaultOption, score: 0, isExact: false, isDefault: true, reason: 'invalid_input' } 
      : defaultOption;
  }
  
  if (!validOptions || !Array.isArray(validOptions) || validOptions.length === 0) {
    logger('⚠️ Invalid options array provided to findClosestMatch');
    return returnDetails ? { match: input, score: 1, isExact: true, reason: 'no_options' } : input;
  }
  
  // Normalize and prepare data
  const isWeightedOptions = useWeights && validOptions.length > 0 && 
                          typeof validOptions[0] === 'object' && 
                          'value' in validOptions[0] && 
                          'weight' in validOptions[0];
  
  // Extract the actual strings to compare against
  const optionStrings = isWeightedOptions 
    ? validOptions.map(opt => opt.value) 
    : validOptions;
  
  // Normalize the input string (remove special chars, extra spaces)
  const normalize = (str) => {
    if (!normalizeInput) return str;
    return str
      .replace(/[^\w\s]/gi, '') // Remove special characters
      .replace(/\s+/g, ' ')     // Replace multiple spaces with a single space
      .trim();                  // Remove leading/trailing spaces
  };
  
  // Extract key terms from descriptive inputs like "Solid Oak" -> "Oak"
  const extractKeyTerms = (input) => {
    // Common descriptive prefixes to strip
    const prefixes = ['solid', 'natural', 'synthetic', 'processed', 'treated', 'finished', 'unfinished', 
                      'painted', 'stained', 'laminated', 'veneered', 'engineered', 'reclaimed'];
    
    // Common descriptive suffixes to strip
    const suffixes = ['board', 'panel', 'sheet', 'veneer', 'plank', 'lumber', 'timber', 'block'];
    
    let terms = input.toLowerCase().split(/\s+/);
    
    // Remove known prefixes if they appear at the beginning
    if (terms.length > 1 && prefixes.includes(terms[0])) {
      terms = terms.slice(1);
    }
    
    // Remove known suffixes if they appear at the end
    if (terms.length > 1 && suffixes.includes(terms[terms.length - 1])) {
      terms = terms.slice(0, -1);
    }
    
    return terms.join(' ');
  };
  
  // Normalize input if needed
  const cleanInput = normalize(input);
  const normalizedInput = ignoreCase ? cleanInput.toLowerCase() : cleanInput;
  
  // Also try with extracted key terms (for descriptive inputs like "Solid Oak" -> "Oak")
  const extractedInput = extractKeyTerms(cleanInput);
  const normalizedExtractedInput = ignoreCase ? extractedInput.toLowerCase() : extractedInput;
  
  // Check for exact match first (case-insensitive if ignoreCase is true)
  const exactMatchIndex = optionStrings.findIndex(option => {
    const normalizedOption = normalize(option);
    return ignoreCase 
      ? normalizedOption.toLowerCase() === normalizedInput 
      : normalizedOption === cleanInput;
  });
  
  // Also check if any option contains the input exactly
  const containsMatchIndex = exactMatchIndex === -1 ? optionStrings.findIndex(option => {
    const normalizedOption = normalize(option).toLowerCase();
    return normalizedInput.length > 2 && normalizedOption.includes(normalizedInput);
  }) : -1;
  
  // Also check if our extracted key term matches exactly
  const keyTermMatchIndex = (exactMatchIndex === -1 && containsMatchIndex === -1) ? 
    optionStrings.findIndex(option => {
      const normalizedOption = normalize(option);
      return ignoreCase 
        ? normalizedOption.toLowerCase() === normalizedExtractedInput 
        : normalizedOption === extractedInput;
    }) : -1;
  
  // If we have any exact match or key term match, use it
  if (exactMatchIndex !== -1 || containsMatchIndex !== -1 || keyTermMatchIndex !== -1) {
    const matchIndex = exactMatchIndex !== -1 ? exactMatchIndex : 
                      (containsMatchIndex !== -1 ? containsMatchIndex : keyTermMatchIndex);
                      
    const matchValue = isWeightedOptions 
      ? validOptions[matchIndex].value 
      : optionStrings[matchIndex];
      
    const matchType = exactMatchIndex !== -1 ? "exact" : 
                     (containsMatchIndex !== -1 ? "contains" : "keyTerm");
      
    logger(`✓ Found ${matchType} match for "${input}": "${matchValue}"`);
    
    return returnDetails 
      ? { 
          match: matchValue, 
          score: matchType === "exact" ? 1 : 0.95, 
          isExact: matchType === "exact", 
          matchIndex: matchIndex,
          matchType: matchType
        } 
      : matchValue;
  }
  
  // Configure Fuse for fuzzy search
  const fuseOptions = {
    includeScore: true,
    threshold: threshold,
    ignoreLocation: true,
    useExtendedSearch: true,
    ignoreFieldNorm: true,
    shouldSort: true,
    minMatchCharLength: 2,
    keys: ['item']
  };
  
  // Prepare data for Fuse
  const searchData = optionStrings.map(item => ({ item: normalize(item) }));
  const fuse = new Fuse(searchData, fuseOptions);
  
  // Try to find the best search term to use
  let searchTerm = cleanInput;
  let usingExtractedTerm = false;
  
  // If input contains multiple words and seems descriptive (like "Solid Oak"), 
  // also try with the extracted key term (might match "Oak" better than "Solid Oak")
  if (normalizedExtractedInput !== normalizedInput) {
    const initialResult = fuse.search(cleanInput);
    const extractedResult = fuse.search(extractedInput);
    
    // If the extracted term gives better results, use it
    if (extractedResult.length > 0 && 
        (initialResult.length === 0 || extractedResult[0].score < initialResult[0].score)) {
      searchTerm = extractedInput;
      usingExtractedTerm = true;
      logger(`🔍 Using extracted key term "${extractedInput}" instead of "${cleanInput}" for better matching`);
    }
  }
  
  // Perform fuzzy search with the best search term
  const result = fuse.search(searchTerm);
  
  // Handle no matches
  if (result.length === 0 || (result[0].score && result[0].score > (1 - minScore))) {
    // If we haven't tried the extracted term yet and it's different, try it now as a fallback
    if (!usingExtractedTerm && normalizedExtractedInput !== normalizedInput) {
      const extractedResult = fuse.search(extractedInput);
      if (extractedResult.length > 0 && extractedResult[0].score < (1 - minScore)) {
        // We got a reasonable match with the extracted term
        logger(`🔍 Falling back to extracted key term "${extractedInput}" - found match`);
        return findClosestMatch(extractedInput, validOptions, options);
      }
    }
    
    // Try to find a default that might be reasonable
    // If we're looking for "Solid Oak", prioritize finding "Oak" in the options
    const inputTerms = input.toLowerCase().split(/\s+/);
    const lastTerm = inputTerms[inputTerms.length - 1];
    
    // If the last term is substantial (not a descriptor) and appears in any option, use that
    if (lastTerm.length > 2) {
      const termMatch = optionStrings.findIndex(opt => 
        normalize(opt).toLowerCase().includes(lastTerm.toLowerCase()));
      
      if (termMatch !== -1) {
        const termMatchValue = isWeightedOptions ? validOptions[termMatch].value : optionStrings[termMatch];
        logger(`⚠️ No good full match found for "${input}". Found partial term match for "${lastTerm}": "${termMatchValue}"`);
        
        return returnDetails 
          ? { 
              match: termMatchValue, 
              score: 0.6, 
              isExact: false, 
              isPartialMatch: true,
              matchTerm: lastTerm
            } 
          : termMatchValue;
      }
    }
    
    // No match found, use the first option as default
    const defaultOption = isWeightedOptions ? validOptions[0].value : optionStrings[0];
    
    logger(`⚠️ No good match found for "${input}". Using default: "${defaultOption}"`);
    
    return returnDetails 
      ? { 
          match: defaultOption, 
          score: 0, 
          isExact: false, 
          isDefault: true, 
          reason: result.length === 0 ? 'no_matches' : 'low_confidence'
        } 
      : defaultOption;
  }
  
  // Process matches and apply weights if needed
  let bestMatch = result[0];
  let matchScore = 1 - bestMatch.score; // Convert Fuse score (0=perfect) to similarity score (1=perfect)
  let bestMatchIndex = optionStrings.indexOf(optionStrings[result[0].refIndex]);
  
  // Apply weights if using weighted options
  if (isWeightedOptions) {
    // Re-score results with weights
    const weightedResults = result.map(r => {
      const originalIndex = optionStrings.indexOf(optionStrings[r.refIndex]);
      const weight = validOptions[originalIndex].weight || 1;
      const weightedScore = (1 - r.score) * weight; // Apply weight to similarity score
      
      return {
        originalResult: r,
        originalIndex,
        weightedScore,
        value: validOptions[originalIndex].value
      };
    }).sort((a, b) => b.weightedScore - a.weightedScore); // Sort by weighted score
    
    if (weightedResults.length > 0) {
      bestMatch = weightedResults[0].originalResult;
      matchScore = weightedResults[0].weightedScore;
      bestMatchIndex = weightedResults[0].originalIndex;
    }
  }
  
  // Get the actual string value for the best match
  const matchValue = isWeightedOptions 
    ? validOptions[bestMatchIndex].value 
    : optionStrings[bestMatchIndex];
  
  logger(`🔍 Best match for "${input}": "${matchValue}" (confidence: ${Math.round(matchScore * 100)}%)`);
  
  // If the top few matches are close in score, log them
  if (result.length > 1) {
    const topAlternatives = result.slice(1, 3).map(r => {
      const idx = optionStrings.indexOf(optionStrings[r.refIndex]);
      const val = isWeightedOptions ? validOptions[idx].value : optionStrings[idx];
      return `${val} (${Math.round((1 - r.score) * 100)}%)`;
    }).join(', ');
    
    if (topAlternatives) {
      logger(`🔍 Alternative matches: ${topAlternatives}`);
    }
  }
  
  return returnDetails
    ? { 
        match: matchValue, 
        score: matchScore, 
        isExact: false,
        matchIndex: bestMatchIndex,
        allMatches: result.slice(0, 3).map(r => {
          const idx = optionStrings.indexOf(optionStrings[r.refIndex]);
          return { 
            value: isWeightedOptions ? validOptions[idx].value : optionStrings[idx], 
            score: 1 - r.score 
          };
        })
      }
    : matchValue;
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
      const categoryMatch = findClosestMatch(
        result.category,
        Object.keys(productCategories),
        { threshold: 0.3, returnDetails: true }
      );
      
      result.category = categoryMatch.match;
      
      if (categoryMatch.isExact) {
        console.log(`✓ Found exact category match: ${result.category}`);
      } else if (categoryMatch.isDefault) {
        console.log(`⚠️ No good match found, using default category: ${result.category}`);
      } else {
        console.log(`🔄 Adjusted category to: ${result.category} (confidence: ${Math.round(categoryMatch.score * 100)}%)`);
      }
    }
    
    if (!productCategories[result.category].includes(result.subcategory)) {
      console.log(`⚠️ Invalid subcategory "${result.subcategory}" for category "${result.category}". Finding closest match...`);
      
      const subcategoryMatch = findClosestMatch(
        result.subcategory,
        productCategories[result.category],
        { threshold: 0.3, minScore: 0.2, returnDetails: true }
      );
      
      result.subcategory = subcategoryMatch.match;
      
      if (subcategoryMatch.isExact) {
        console.log(`✓ Found exact subcategory match: ${result.subcategory}`);
      } else if (subcategoryMatch.isDefault) {
        console.log(`⚠️ No good match found, using default subcategory: ${result.subcategory}`);
      } else {
        console.log(`🔄 Adjusted subcategory to: ${result.subcategory} (confidence: ${Math.round(subcategoryMatch.score * 100)}%)`);
        if (subcategoryMatch.allMatches && subcategoryMatch.allMatches.length > 1) {
          console.log(`🔍 Top alternative matches: ${subcategoryMatch.allMatches.slice(1).map(m => `${m.value} (${Math.round(m.score * 100)}%)`).join(', ')}`);
        }
      }
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
2. You MUST ONLY use material classes EXACTLY as they appear in the list above.
3. Distribute the total weight (${weight} kg) proportionally across these materials.
4. Ensure the total weight of all materials adds up **exactly** to ${weight} kg.
5. Return the result **strictly as a valid JSON array** in the following format:

[
    {
        "materialClass": "<category>",
        "weight": <weight>
    }
]

### **CRITICAL RULES**:
- You MUST ONLY select materialClass values EXACTLY as they appear in the list above.
- DO NOT invent new materials or modify existing ones (e.g., do not use "Particleboard" if it's not in the list).
- For example, if you think a product contains "Particleboard" but it's not in the list, choose the closest match from the list (like "MDF").
- DO NOT add descriptive terms to materials - use exactly the terms as they appear in the list.
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
      const isValidMaterialClass = materialsDatabaseBasic.some(
        (material) => material.materialClass === item.materialClass
      );
      
      if (!isValidMaterialClass) {
        console.log(`⚠️ Material class "${item.materialClass}" not found in basic database. Finding closest match...`);
        
        // Get all valid material classes
        const validMaterialClasses = materialsDatabaseBasic.map(material => material.materialClass);
        
        const materialMatch = findClosestMatch(
          item.materialClass,
          validMaterialClasses,
          { 
            threshold: 0.3, 
            minScore: 0.2, 
            returnDetails: true,
            normalizeInput: true
          }
        );
        
        const originalMaterialClass = item.materialClass;
        item.materialClass = materialMatch.match;
        
        if (materialMatch.isExact) {
          console.log(`✓ Found exact match for "${originalMaterialClass}": "${item.materialClass}"`);
        } else if (materialMatch.isDefault) {
          console.log(`⚠️ No good match found for "${originalMaterialClass}". Using default: "${item.materialClass}"`);
        } else {
          console.log(`🔄 Adjusted material class from "${originalMaterialClass}" to "${item.materialClass}" (confidence: ${Math.round(materialMatch.score * 100)}%)`);
          
          // Log alternative matches
          if (materialMatch.allMatches && materialMatch.allMatches.length > 1) {
            console.log(`🔍 Alternative matches: ${materialMatch.allMatches.slice(1).map(m => 
              `${m.value} (${Math.round(m.score * 100)}%)`).join(', ')}`);
          }
        }
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
  try {
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
2. You MUST ONLY use material classes and specific materials EXACTLY as they appear in the list above.
3. Distribute the total weight (${weight} kg) proportionally across these materials.
4. Ensure the total weight of all materials adds up **exactly** to ${weight} kg.
5. Return the result **strictly as a valid JSON array** in the following format:

[
    {
        "materialClass": "<category>",
        "specificMaterial": "<material>",
        "weight": <weight>
    }
]

### **CRITICAL RULES**:
- You MUST ONLY select materialClass and specificMaterial values EXACTLY as they appear in the list above.
- DO NOT invent new materials or modify existing ones (e.g., do not use "Particleboard" if it's not in the list).
- For example, if you think a product contains "Particleboard" but it's not in the list, choose the closest match from the list (like "MDF").
- Every materialClass must be one of these exact categories: ${Object.keys(billOfMaterials).join(', ')}
- Every specificMaterial must appear exactly as listed under its category in the available materials list.
- DO NOT add descriptive terms like "Solid Oak" - use exactly "Oak" as it appears in the list.
- If an image is provided, use it to refine material classification.
- The total weight must match exactly **${weight} kg**.
- Do **not** include any explanation, extra text, or formatting outside the JSON array.
`;

  
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
        console.log(`⚠️ Material class "${item.materialClass}" not found in database. Finding closest match...`);
        
        const materialMatch = findClosestMatch(
          item.materialClass,
          Object.keys(billOfMaterials),
          { 
            threshold: 0.3, 
            minScore: 0.2, 
            returnDetails: true,
            normalizeInput: true
          }
        );
        
        const originalMaterialClass = item.materialClass;
        item.materialClass = materialMatch.match;
        
        if (materialMatch.isExact) {
          console.log(`✓ Found exact match for "${originalMaterialClass}": "${item.materialClass}"`);
        } else if (materialMatch.isDefault) {
          console.log(`⚠️ No good match found for "${originalMaterialClass}". Using default: "${item.materialClass}"`);
        } else {
          console.log(`🔄 Adjusted material class from "${originalMaterialClass}" to "${item.materialClass}" (confidence: ${Math.round(materialMatch.score * 100)}%)`);
          
          if (materialMatch.allMatches && materialMatch.allMatches.length > 1) {
            console.log(`🔍 Alternative matches: ${materialMatch.allMatches.slice(1).map(m => 
              `${m.value} (${Math.round(m.score * 100)}%)`).join(', ')}`);
          }
        }
      }
      
      // Verify specific material is valid for this material class
      if (item.specificMaterial && 
          billOfMaterials[item.materialClass] && 
          !billOfMaterials[item.materialClass].includes(item.specificMaterial)) {
        
        console.log(`⚠️ Specific material "${item.specificMaterial}" not found in "${item.materialClass}" category. Finding closest match...`);
        
        const specificMatch = findClosestMatch(
          item.specificMaterial,
          billOfMaterials[item.materialClass],
          { 
            threshold: 0.3, 
            minScore: 0.2, 
            returnDetails: true,
            normalizeInput: true
          }
        );
        
        const originalSpecificMaterial = item.specificMaterial;
        item.specificMaterial = specificMatch.match;
        
        if (specificMatch.isExact) {
          console.log(`✓ Found exact match for "${originalSpecificMaterial}": "${item.specificMaterial}"`);
        } else if (specificMatch.isDefault) {
          console.log(`⚠️ No good match found for "${originalSpecificMaterial}". Using default: "${item.specificMaterial}"`);
        } else {
          console.log(`🔄 Adjusted specific material from "${originalSpecificMaterial}" to "${item.specificMaterial}" (confidence: ${Math.round(specificMatch.score * 100)}%)`);
        }
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

module.exports = {
  classifyProduct,
  classifyBOM,
  classifyBOMBasic,
  classifyManufacturingProcess,
  classifyManufacturingProcessBasic,
  findClosestMatch, // Export the findClosestMatch function for use in other files
};
