const fs = require('fs');
const path = require('path');
const inputFilePath = path.join(__dirname, '..', 'data', 'productCategories.json');
const outputFilePath = path.join(__dirname, '..', 'data', 'productCategories.json');

// Read the current JSON file
const data = require(inputFilePath);

// Clean up function
function cleanUpCategories(categories) {
  const result = {};
  
  // Process each category
  for (const [category, subcategories] of Object.entries(categories)) {
    // Skip ZZZ-GMC Deleted categories
    if (category.startsWith('ZZZ-GMC Deleted')) {
      continue;
    }
    
    // Filter out ToBeDeleted subcategories
    const cleanedSubcategories = subcategories.filter(sub => 
      !sub.includes('_ToBeDeleted') && 
      !sub.includes('ToDelete') &&
      sub !== category // Filter out duplicates where subcategory is identical to category
    );
    
    // Only add categories with subcategories
    if (cleanedSubcategories.length > 0) {
      result[category] = cleanedSubcategories;
    }
  }
  
  return result;
}

// Clean up the data
const cleanedData = cleanUpCategories(data);

// Write back to file
fs.writeFileSync(outputFilePath, JSON.stringify(cleanedData, null, 2));

// Count categories and subcategories
const categoryCount = Object.keys(cleanedData).length;
const subcategoryCount = Object.values(cleanedData).flat().length;

console.log(`Cleaned data: ${categoryCount} categories with ${subcategoryCount} subcategories.`);