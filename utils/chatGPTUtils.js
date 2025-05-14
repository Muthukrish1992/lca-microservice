const axios = require("axios");
require("dotenv").config();

const productCategories = require("../data/productCategories.json");
const materialsDatabase = require("../data/materials_database.json");
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

// Utility function to make OpenAI requests with retry logic for rate limits
async function makeOpenAIRequestWithRetry(requestFn, maxRetries = 3) {
  let retries = 0;
  while (true) {
    try {
      return await requestFn();
    } catch (error) {
      if (error.status === 429 && retries < maxRetries) {
        const waitTime = error.message.match(/try again in (\d+)ms/) 
          ? parseInt(error.message.match(/try again in (\d+)ms/)[1])
          : Math.pow(2, retries) * 1000;
        
        console.log(`Rate limited, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retries++;
      } else {
        throw error;
      }
    }
  }
}

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
  reasoning : z.string(),
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
      ([material, processes]) => {
        const processesStr = Object.keys(processes)
          .map(process => `${process} (${processes[process]} kWh/kg)`)
          .join(", ");
        return `- ${material}: ${processesStr || "No specific processes listed"}`;
      }
    )
    .join("\n");
};

// Format basic manufacturing processes as a string for the prompt
const formatManufacturingProcessesBasic = () => {
  return Object.entries(manufacturingProcessesBasic)
    .map(
      ([material, processes]) => {
        const processesStr = Object.keys(processes)
          .map(process => `${process} (${processes[process]} kWh/kg)`)
          .join(", ");
        return `- ${material}: ${processesStr || "No specific processes listed"}`;
      }
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
  
  // Map of common alternative material names to their standard names
  const commonAlternativeNames = {
    // Wood alternatives
    'fibreboard': 'mdf',
    'fiberboard': 'mdf',
    'medium density fibreboard': 'mdf',
    'medium density fiberboard': 'mdf',
    'particleboard': 'mdf',
    'chipboard': 'mdf',
    'plywood': 'mdf',
    'osb': 'mdf', // Oriented Strand Board
    'hardboard': 'mdf',
    // Metal alternatives
    'stainless': 'stainless steel',
    'inox': 'stainless steel',
    'ss': 'stainless steel',
    'aluminium': 'aluminum',
    'chrome': 'chromed steel',
    'iron': 'cast iron',
    // Plastic alternatives
    'abs': 'acrylonitrile butadiene styrene (abs)',
    'pmma': 'acrylic (pmma)',
    'acrylic': 'acrylic (pmma)',
    'polyethylene': 'high-density polyethylene (hdpe)', // Default to HDPE if not specified
    'polypropylene': 'polypropylene (pp)',
    'polyurethane': 'polyurethane (pu)',
    'pvc': 'polyvinyl chloride (pvc)',
    // Glass alternatives
    'tempered': 'tempered glass',
    'toughened': 'tempered glass',
    'safety glass': 'tempered glass',
    // Leather alternatives
    'genuine leather': 'full-grain leather',
    'faux leather': 'faux leather (pu)',
    'synthetic leather': 'faux leather (pu)',
    'pu leather': 'faux leather (pu)',
    'vegan leather': 'faux leather (pu)'
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
  
  // Check for common alternative names and map to standard names
  const mapCommonAlternatives = (input) => {
    const lowerInput = input.toLowerCase().trim();
    
    // Check for direct matches in our mapping
    if (commonAlternativeNames[lowerInput]) {
      return commonAlternativeNames[lowerInput];
    }
    
    // Check for partial matches (e.g., "fibreboard panel" should match "fibreboard")
    for (const [alt, standard] of Object.entries(commonAlternativeNames)) {
      // If the alternative name is found as a word in the input
      if (new RegExp(`\\b${alt}\\b`).test(lowerInput)) {
        return standard;
      }
    }
    
    return input;
  };
  
  // Normalize input if needed
  const cleanInput = normalize(input);
  const normalizedInput = ignoreCase ? cleanInput.toLowerCase() : cleanInput;
  
  // Try with common alternative names mapping (like "Fibreboard" -> "MDF")
  const mappedInput = mapCommonAlternatives(cleanInput);
  const normalizedMappedInput = ignoreCase ? mappedInput.toLowerCase() : mappedInput;
  
  // Also try with extracted key terms (for descriptive inputs like "Solid Oak" -> "Oak")
  const extractedInput = extractKeyTerms(cleanInput);
  const normalizedExtractedInput = ignoreCase ? extractedInput.toLowerCase() : extractedInput;
  
  // Log if we found a common alternative mapping
  if (mappedInput.toLowerCase() !== cleanInput.toLowerCase()) {
    logger(`🔄 Mapped alternative material name "${input}" to standard name "${mappedInput}"`);
  }
  
  // Check for exact match first (case-insensitive if ignoreCase is true)
  const exactMatchIndex = optionStrings.findIndex(option => {
    const normalizedOption = normalize(option);
    return ignoreCase 
      ? normalizedOption.toLowerCase() === normalizedInput 
      : normalizedOption === cleanInput;
  });
  
  // Check if mapped input (like "MDF" for "Fibreboard") matches exactly
  const mappedMatchIndex = exactMatchIndex === -1 ? optionStrings.findIndex(option => {
    const normalizedOption = normalize(option);
    return ignoreCase 
      ? normalizedOption.toLowerCase() === normalizedMappedInput 
      : normalizedOption === mappedInput;
  }) : -1;
  
  // Also check if any option contains the input exactly
  const containsMatchIndex = (exactMatchIndex === -1 && mappedMatchIndex === -1) ? 
    optionStrings.findIndex(option => {
      const normalizedOption = normalize(option).toLowerCase();
      return normalizedInput.length > 2 && normalizedOption.includes(normalizedInput);
    }) : -1;
  
  // Also check if our extracted key term matches exactly
  const keyTermMatchIndex = (exactMatchIndex === -1 && mappedMatchIndex === -1 && containsMatchIndex === -1) ? 
    optionStrings.findIndex(option => {
      const normalizedOption = normalize(option);
      return ignoreCase 
        ? normalizedOption.toLowerCase() === normalizedExtractedInput 
        : normalizedOption === extractedInput;
    }) : -1;
  
  // If we have any exact match or alternative match, use it
  if (exactMatchIndex !== -1 || mappedMatchIndex !== -1 || containsMatchIndex !== -1 || keyTermMatchIndex !== -1) {
    const matchIndex = exactMatchIndex !== -1 ? exactMatchIndex : 
                      (mappedMatchIndex !== -1 ? mappedMatchIndex :
                      (containsMatchIndex !== -1 ? containsMatchIndex : keyTermMatchIndex));
                      
    const matchValue = isWeightedOptions 
      ? validOptions[matchIndex].value 
      : optionStrings[matchIndex];
      
    const matchType = exactMatchIndex !== -1 ? "exact" : 
                     (mappedMatchIndex !== -1 ? "mapped" :
                     (containsMatchIndex !== -1 ? "contains" : "keyTerm"));
      
    const matchTypeDisplay = {
      'exact': 'exact',
      'mapped': 'mapped alternative',
      'contains': 'partial',
      'keyTerm': 'key term'
    };
      
    logger(`✓ Found ${matchTypeDisplay[matchType]} match for "${input}": "${matchValue}"`);
    
    return returnDetails 
      ? { 
          match: matchValue, 
          score: matchType === "exact" ? 1 : (matchType === "mapped" ? 0.98 : 0.95), 
          isExact: matchType === "exact", 
          matchIndex: matchIndex,
          matchType: matchType,
          originalInput: input,
          mappedInput: matchType === "mapped" ? mappedInput : undefined
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
  let usingMappedTerm = false;
  
  // Try multiple search strategies and pick the best one
  // 1. Start with original cleaned input
  const initialResult = fuse.search(cleanInput);
  
  // 2. Try with mapped alternative if available (e.g., "fibreboard" -> "mdf")
  let mappedResult = [];
  if (normalizedMappedInput !== normalizedInput) {
    mappedResult = fuse.search(mappedInput);
  }
  
  // 3. Try with extracted key term (e.g., "Solid Oak" -> "Oak")
  let extractedResult = [];
  if (normalizedExtractedInput !== normalizedInput) {
    extractedResult = fuse.search(extractedInput);
  }
  
  // Compare all results and pick the best one
  let bestScore = initialResult.length > 0 ? initialResult[0].score : 1;
  
  // Check if mapped term gives better results
  if (mappedResult.length > 0 && (initialResult.length === 0 || mappedResult[0].score < bestScore)) {
    searchTerm = mappedInput;
    bestScore = mappedResult[0].score;
    usingMappedTerm = true;
  }
  
  // Check if extracted term gives better results
  if (extractedResult.length > 0 && (bestScore === 1 || extractedResult[0].score < bestScore)) {
    searchTerm = extractedInput;
    bestScore = extractedResult[0].score;
    usingExtractedTerm = true;
    usingMappedTerm = false;
  }
  
  // Log which search term we're using
  if (usingMappedTerm) {
    logger(`🔍 Using mapped alternative "${mappedInput}" instead of "${cleanInput}" for better matching`);
  } else if (usingExtractedTerm) {
    logger(`🔍 Using extracted key term "${extractedInput}" instead of "${cleanInput}" for better matching`);
  }
  
  // Perform fuzzy search with the best search term
  const result = usingMappedTerm ? mappedResult : 
                usingExtractedTerm ? extractedResult : 
                initialResult;
  
  // Handle no matches
  if (result.length === 0 || (result[0].score && result[0].score > (1 - minScore))) {
    // Try all our fallback strategies
    
    // 1. Try mapped alternative as fallback if it wasn't already tried
    if (!usingMappedTerm && normalizedMappedInput !== normalizedInput) {
      const newMappedResult = mappedResult.length > 0 ? mappedResult : fuse.search(mappedInput);
      if (newMappedResult.length > 0 && newMappedResult[0].score < (1 - minScore)) {
        // We got a reasonable match with the mapped term
        logger(`🔍 Falling back to mapped alternative "${mappedInput}" - found match`);
        return findClosestMatch(mappedInput, validOptions, options);
      }
    }
    
    // 2. Try extracted term as fallback if it wasn't already tried
    if (!usingExtractedTerm && normalizedExtractedInput !== normalizedInput) {
      const newExtractedResult = extractedResult.length > 0 ? extractedResult : fuse.search(extractedInput);
      if (newExtractedResult.length > 0 && newExtractedResult[0].score < (1 - minScore)) {
        // We got a reasonable match with the extracted term
        logger(`🔍 Falling back to extracted key term "${extractedInput}" - found match`);
        return findClosestMatch(extractedInput, validOptions, options);
      }
    }
    
    // 3. Special handling for "Fibreboard" specifically
    if (normalizedInput.includes('fibreboard') || normalizedInput.includes('fiberboard') || 
        normalizedInput.includes('particleboard') || normalizedInput.includes('chipboard')) {
      // Look specifically for MDF in the options
      const mdfIndex = optionStrings.findIndex(opt => 
        normalize(opt).toLowerCase() === 'mdf');
      
      if (mdfIndex !== -1) {
        const mdfValue = isWeightedOptions ? validOptions[mdfIndex].value : optionStrings[mdfIndex];
        logger(`🔍 Found special case match for "${input}": "${mdfValue}" (fibreboard-type material)`);
        
        return returnDetails 
          ? { 
              match: mdfValue, 
              score: 0.9, 
              isExact: false, 
              isSpecialCase: true,
              originalInput: input
            } 
          : mdfValue;
      }
    }
    
    // 4. Try to find a default that might be reasonable
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
    
    // 5. No match found, use the first option as default
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

// Function to format the materials database as a string for the prompt
const formatBOMList = () => {
  // Group materials by materialClass
  const materialsByClass = {};
  
  materialsDatabase.forEach(material => {
    if (!materialsByClass[material.materialClass]) {
      materialsByClass[material.materialClass] = new Set();
    }
    materialsByClass[material.materialClass].add(material.specificMaterial);
  });
  
  // Convert to the required format
  return Object.entries(materialsByClass)
    .map(([materialClass, specificMaterials]) => 
      `- ${materialClass}: ${Array.from(specificMaterials).join(", ")}`)
    .join("\n");
};

async function classifyProduct(productCode, name, description, imageUrl, req) {
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
  
  CRITICAL RULES:
  1. You MUST ONLY select a category and subcategory EXACTLY as they appear in the list above.
  2. The category MUST be one of these exact values: ${Object.keys(productCategories).join(', ')}
  3. The subcategory MUST belong to the selected category.
  4. DO NOT invent or modify any categories or subcategories.
  5. DO NOT add any descriptive terms to categories or subcategories.
  6. If an image is provided, you MUST analyze it carefully to identify the product appearance, structure, and purpose.
  7. Prioritize the image's visual information if it provides clear evidence of the product's category.
  8. If no exact match is found, select the closest valid subcategory from the list.`;

  try {
    console.log(`🤖 Sending request to AI model for product: ${productCode}`);
    
    // Prepare messages with text and image if available
    const messages = [{ type: "text", text: prompt }];

    if (imageUrl) {
      try {
        // Validate image URL before adding to messages
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
          console.log(`⚠️ Invalid image URL format: ${imageUrl}`);
          throw new Error(`Invalid image URL format: ${imageUrl}`);
        }
        
        // Skip local/development URLs that OpenAI can't access
        if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1') || imageUrl.includes(':5000')) {
          console.log(`⚠️ Skipping local image URL: ${imageUrl}`);
          console.log(`Local images cannot be accessed by OpenAI API. Proceeding without image.`);
          // Don't add the image to messages
        } else {
          // Format URLs correctly based on whether they're absolute or relative
          const formattedUrl = imageUrl.startsWith('/') 
            ? `${process.env.BASE_URL || 'http://localhost:3000'}${imageUrl}`
            : imageUrl;
          
          console.log(`🖼️ Using image URL for classification: ${formattedUrl}`);
          messages.push({ type: "image_url", image_url: { url: formattedUrl } });
        }
      } catch (error) {
        console.error(`Failed to add image to classification request: ${error.message}`);
        // Continue without the image rather than failing completely
      }
    }
    
    const completion = await makeOpenAIRequestWithRetry(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o", // Using full GPT-4o for better image analysis
        messages: [{ role: "user", content: messages }],
        response_format: { type: "json_object" },
        temperature: 0,
      });
    });

    let result;
    try {
      result = JSON.parse(completion.choices[0].message.content);
      console.log(`✅ Received AI classification response: ${JSON.stringify(result)}`);
    } catch (parseError) {
      console.error(`❌ Failed to parse classification response: ${parseError.message}`);
      console.error(`Response content: ${completion.choices[0].message.content}`);
      throw new Error("Failed to parse classification response. Invalid JSON format.");
    }

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
    name,
    description,
    weight,
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
      try {
        // Validate image URL before adding to messages
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
          console.log(`⚠️ Invalid image URL format: ${imageUrl}`);
          throw new Error(`Invalid image URL format: ${imageUrl}`);
        }
        
        // Skip local/development URLs that OpenAI can't access
        if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1') || imageUrl.includes(':5000')) {
          console.log(`⚠️ Skipping local image URL: ${imageUrl}`);
          console.log(`Local images cannot be accessed by OpenAI API. Proceeding without image.`);
          // Don't add the image to messages
        } else {
          // Format URLs correctly based on whether they're absolute or relative
          const formattedUrl = imageUrl.startsWith('/') 
            ? `${process.env.BASE_URL || 'http://localhost:3000'}${imageUrl}`
            : imageUrl;
          
          console.log(`🖼️ Using image URL: ${formattedUrl}`);
          messages.push({ type: "image_url", image_url: { url: formattedUrl } });
        }
      } catch (error) {
        console.error(`Failed to add image to request: ${error.message}`);
        // Continue without the image rather than failing completely
      }
    }

    const response = await makeOpenAIRequestWithRetry(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o", // Supports text + image analysis
        messages: [{ role: "user", content: messages }],
        response_format: zodResponseFormat(BOMSchemaBasic, "bom"),
        temperature: 0,
      });
    });

    let result;
    try {
      result = JSON.parse(response.choices[0].message.content).bom;
      console.log(`✅ Successfully parsed BOM response`);
    } catch (parseError) {
      console.error(`❌ Failed to parse BOM response: ${parseError.message}`);
      console.error(`Response content: ${response.choices[0].message.content}`);
      throw new Error("Failed to parse BOM response from API. Invalid JSON format.");
    }
    
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

    // Combine duplicate materials (e.g., if both "Fibreboard" and "Particleboard" map to "MDF")
    console.log(`🔄 Checking for duplicate materials to combine...`);
    const combinedResult = [];
    const materialMap = new Map(); // Map to track unique material classes
    
    result.forEach(item => {
      if (materialMap.has(item.materialClass)) {
        // Combine weights for duplicate material classes
        const existingItem = materialMap.get(item.materialClass);
        existingItem.weight += item.weight;
        console.log(`✓ Combined duplicate material: ${item.materialClass} - new weight: ${existingItem.weight.toFixed(2)} kg`);
      } else {
        // First time seeing this material class
        materialMap.set(item.materialClass, item);
        combinedResult.push(item);
      }
    });
    
    if (result.length !== combinedResult.length) {
      console.log(`🔄 Combined ${result.length - combinedResult.length} duplicate materials.`);
    }

    // Validate total weight
    const totalWeight = combinedResult.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(totalWeight - weight) > 0.01) {
      throw new Error(
        `Total weight mismatch: expected ${weight} kg, but got ${totalWeight.toFixed(2)} kg.`
      );
    }

    cacheClassifyBOM.set(keyClassifyBOM, combinedResult);
    return combinedResult;
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
    name,
    description,
    weight,
    imageUrl,
  });

  if (cacheClassifyBOM.has(keyClassifyBOM)) {
    return cacheClassifyBOM.get(keyClassifyBOM);
  }

  const bomList = formatBOMList();
  description = description.replace(';',' ');
  const prompt = `
You are an assistant tasked with classifying products based on their description and analyzing an image to determine the composition of materials.

### **Product Details**:
- **Code**: ${productCode}
- **Name**: ${name}
- **Description**: ${description}
- **Total Weight**: ${weight} kg

### **Your Task**:
1. Analyze the text description and image (if provided) to determine relevant materials. If the image shows materials that are missing from the description, you MUST add them to the BOM and allocate weight using realistic engineering assumptions.
You MUST analyze the provided image alongside the text description to identify all visible materials used in the product. If the image shows materials that are not mentioned in the description, you MUST include them.
Prioritize what is visually confirmed in the image if there is a discrepancy between text and image.
2. Pay close attention to all parts of the product details, including the name, description, and material fields, as they may each indicate distinct materials. However, do not interpret color names or color fields as materials.
3. You MUST ONLY use material classes and specific materials EXACTLY as they appear in the list above.
4. Identify materials based on both explicit fields and any implied mentions in the product name or description only when they describe the material construction or composition, not decorative finishes or colors.
5. Distribute the total weight realistically across these materials, applying typical engineering assumptions where needed.
6. Where materials are not fully specified, apply logical assumptions based on standard industry practices (e.g., assume steel frames for shelving or racking system).
7. Ensure the total weight of all materials adds up **exactly** to ${weight} kg.
8. “For each material, provide a brief reasoning (1–2 sentences) explaining why the material was included and how its weight was estimated.”,
9. If a color field or description contains a term that matches a material name (e.g., "Maple," "Oak"), you MUST treat it as a color only and MUST NOT treat it as a material unless the description explicitly states it is a material or part of the product structure.
10. Return the result **strictly as a valid JSON array** in the following format:
[
    {
        "materialClass": "<category>",
        "specificMaterial": "<material>",
        "weight": <weight>,
        "reasoning": "<brief explanation>"
    }
]

### **CRITICAL RULES**:

- DO NOT invent new materials or modify existing ones (e.g., do not use "Particleboard" if it's not in the list).
- For example, if you think a product contains "Particleboard" but it's not in the list, choose the closest match from the list (like "MDF").
- Every materialClass must be one of these exact categories: ${bomList}
- You MUST ONLY select materialClass and specificMaterial values EXACTLY as they appear in the list above.
- Every specificMaterial must appear exactly as listed under its category in the available materials list.
- DO NOT add descriptive terms like "Solid Oak" - use exactly "Oak" as it appears in the list.
- If an image is provided, use it to refine material classification.
- The total weight must match exactly **${weight} kg**.
- Do **not** include any explanation, extra text, or formatting outside the JSON array.
 If a surface finish or lamination (e.g., melamine foil, powder coating, or plastic wrap) is mentioned, interpret it as a *process*, NOT a material. Do **not** include such coatings in the material breakdown unless the core material it is applied to is listed.
- For example, if a "melamine-coated particleboard" is described but "Melamine" is not in the list, classify the core only (e.g., MDF if it's the closest match), and **do not** list "Melamine."
If a surface finish or lamination (e.g., melamine foil, powder coating, plastic wrap) is mentioned, interpret it as a process, NOT a material. Only classify the structural material underneath (e.g., MDF for melamine-coated boards).
If the product description mentions melamine, melamine-coated, or melamine-faced, you MUST treat this as a surface treatment or process. Do NOT classify this as “Melamine-Formaldehyde.” Use MDF for the core material instead.
If a material name (e.g., Beech, Oak, Maple) appears only in a color field, tabletop color, or visual styling, you MUST treat it as a color only, NOT a material. Only use that wood type if the description explicitly states it is used in the product’s construction.
`;

console.log(prompt);

  
    const messages = [{ type: "text", text: prompt }];

    if (imageUrl) {
      try {
        // Validate image URL before adding to messages
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
          console.log(`⚠️ Invalid image URL format: ${imageUrl}`);
          throw new Error(`Invalid image URL format: ${imageUrl}`);
        }
        
        // Skip local/development URLs that OpenAI can't access
        if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1') || imageUrl.includes(':5000')) {
          console.log(`⚠️ Skipping local image URL: ${imageUrl}`);
          console.log(`Local images cannot be accessed by OpenAI API. Proceeding without image.`);
          // Don't add the image to messages
        } else {
          // Format URLs correctly based on whether they're absolute or relative
          const formattedUrl = imageUrl.startsWith('/') 
            ? `${process.env.BASE_URL || 'http://localhost:3000'}${imageUrl}`
            : imageUrl;
          
          console.log(`🖼️ Using image URL: ${formattedUrl}`);
          messages.push({ type: "image_url", image_url: { url: formattedUrl } });
        }
      } catch (error) {
        console.error(`Failed to add image to request: ${error.message}`);
        // Continue without the image rather than failing completely
      }
    }

    const response = await makeOpenAIRequestWithRetry(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o", // Supports text + image analysis
        messages: [{ role: "user", content: messages }],
        response_format: zodResponseFormat(BOMSchema, "bom"),
        temperature: 0,
      });
    });

    let result;
    try {
      result = JSON.parse(response.choices[0].message.content).bom;
      console.log(`✅ Received AI bill of materials response: ${JSON.stringify(result)}`);
    } catch (parseError) {
      console.error(`❌ Failed to parse BOM response: ${parseError.message}`);
      console.error(`Response content: ${response.choices[0].message.content}`);
      throw new Error("Failed to parse BOM response from API. Invalid JSON format.");
    }
    
    updateAITokens(req, response.usage.total_tokens);

    // Validate and adjust material categories
    result.forEach((item) => {
      // Get all unique material classes from the database
      const availableMaterialClasses = [...new Set(materialsDatabase.map(material => material.materialClass))];
      
      // Check if the material class exists in the database
      if (!availableMaterialClasses.includes(item.materialClass)) {
        console.log(`⚠️ Material class "${item.materialClass}" not found in database. Finding closest match...`);
        
        const materialMatch = findClosestMatch(
          item.materialClass,
          availableMaterialClasses,
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
      if (item.specificMaterial) {
        // Get all specific materials for this material class
        const availableSpecificMaterials = [
          ...new Set(
            materialsDatabase
              .filter(material => material.materialClass === item.materialClass)
              .map(material => material.specificMaterial)
          )
        ];
        
        if (!availableSpecificMaterials.includes(item.specificMaterial)) {
          console.log(`⚠️ Specific material "${item.specificMaterial}" not found in "${item.materialClass}" category. Finding closest match...`);
          
          const specificMatch = findClosestMatch(
            item.specificMaterial,
            availableSpecificMaterials,
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
      }
    });

    // Combine duplicate materials (e.g., if multiple "Fibreboard" all map to "MDF")
    console.log(`🔄 Checking for duplicate materials to combine...`);
    const combinedResult = [];
    const materialMap = new Map(); // Map to track unique material combinations
    
    result.forEach(item => {
      const key = `${item.materialClass}|${item.specificMaterial}`;
      
      if (materialMap.has(key)) {
        // Combine weights for duplicate materials
        const existingItem = materialMap.get(key);
        existingItem.weight += item.weight;
        console.log(`✓ Combined duplicate material: ${item.materialClass} (${item.specificMaterial}) - new weight: ${existingItem.weight.toFixed(2)} kg`);
      } else {
        // First time seeing this material combination
        materialMap.set(key, item);
        combinedResult.push(item);
      }
    });
    
    if (result.length !== combinedResult.length) {
      console.log(`🔄 Combined ${result.length - combinedResult.length} duplicate materials.`);
    }

    // Validate total weight
    const totalWeight = combinedResult.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(totalWeight - weight) > 0.01) {
      throw new Error(
        `Total weight mismatch: expected ${weight} kg, but got ${totalWeight.toFixed(2)} kg.`
      );
    }

    cacheClassifyBOM.set(keyClassifyBOM, combinedResult);
    return combinedResult;
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
Classify the following product into manufacturing processes strictly based on the materials provided in the Bill of Materials (BoM). Ensure that every material listed in the BoM is included in the response. Each material must have at least one manufacturing process.

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

CRITICAL RULES:
1. Every material in the BoM MUST be included in the response EXACTLY as provided, without modifications.
2. You MUST ONLY use the exact materialClass and specificMaterial values from the BoM — DO NOT modify them in any way.
3. Each material must have at least one manufacturing process.
4. You MUST ONLY use manufacturing categories and processes from the list above.
5. You MUST NOT invent new materials, processes, or categories that aren't in the provided list.
6. The manufacturing processes selected for each material MUST BE RELEVANT to the materialClass — for example:
   - Metal materials must only be assigned metal-related processes.
   - Plastic materials must only be assigned plastic-related processes.
   - Wood materials must only be assigned wood-related processes.
   - Do NOT assign manufacturing processes from an unrelated category (e.g., don’t assign wood processes to plastic materials).
7. You must follow industrial and logical manufacturing norms when mapping processes to material classes.
8. The output MUST be valid JSON only — no comments, no extra text.

Important:
- Output ONLY a valid JSON object.
- Ensure strict adherence to the rules and format above.
`;


  try {
    const response = await makeOpenAIRequestWithRetry(async () => {
      return await openai.beta.chat.completions.parse({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: zodResponseFormat(ManufacturingSchema, "processes"),
      });
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
Classify the following product into manufacturing processes strictly based on the materials provided in the Bill of Materials (BoM). Ensure that every material listed in the BoM is included in the response. Each material must have at least one manufacturing process.

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

CRITICAL RULES:
1. Every material in the BoM MUST be included in the response EXACTLY as provided, without modifications.
2. You MUST ONLY use the exact materialClass values from the BoM — DO NOT modify them in any way.
3. Each material must have at least one manufacturing process.
4. You MUST ONLY use manufacturing categories and processes from the list provided above.
5. You MUST NOT invent new materials, processes, or categories that aren't in the provided list.
6. The manufacturing processes selected for each material MUST BE RELEVANT to the materialClass — for example:
   - Metal materials must only be assigned metal-related processes.
   - Plastic materials must only be assigned plastic-related processes.
   - Wood materials must only be assigned wood-related processes.
   - DO NOT assign processes from unrelated categories (e.g., avoid using wood processes for plastic materials).
7. Follow standard manufacturing logic and real-world industrial relevance when mapping processes to material classes.
8. The output MUST be strictly valid JSON and conform exactly to the format below.

Important:
- Output ONLY the JSON object.
- Do NOT include any explanations or text outside of the JSON.
`;

  try {
    const response = await makeOpenAIRequestWithRetry(async () => {
      return await openai.beta.chat.completions.parse({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: zodResponseFormat(ManufacturingSchemaBasic, "processes"),
      });
    });

    const result = response.choices[0].message.parsed.processes;

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
