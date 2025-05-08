const fs = require('fs');
const path = require('path');
const csvFilePath = path.join(__dirname, '..', 'data', 'category.csv');
const outputFilePath = path.join(__dirname, '..', 'data', 'productCategories.json');

// Read CSV file
const csvData = fs.readFileSync(csvFilePath, 'utf8');

// Parse CSV data
const lines = csvData.split('\n');

// Skip header and start processing from line 1
const categories = {};

// Process each line of the CSV
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue; // Skip empty lines
  
  // Split by comma, but respect quotes
  let columns = [];
  let column = '';
  let inQuotes = false;
  
  for (let j = 0; j < lines[i].length; j++) {
    const char = lines[i][j];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      columns.push(column);
      column = '';
    } else {
      column += char;
    }
  }
  columns.push(column); // Don't forget the last column
  
  if (columns.length < 4) {
    continue; // Skip lines with insufficient columns
  }
  
  // Clean up quotes and whitespace
  let gmLevel2 = columns[1].replace(/"/g, '').trim();
  let gmLevel4 = columns[3].replace(/"/g, '').trim();
  
  // Skip empty values
  if (!gmLevel2 || !gmLevel4 || gmLevel2 === 'GMC Level 2' || gmLevel4 === 'GMC Level 4') {
    continue;
  }
  
  // Add to categories
  if (!categories[gmLevel2]) {
    categories[gmLevel2] = new Set();
  }
  categories[gmLevel2].add(gmLevel4);
}

// Convert Sets to Arrays
const result = {};
for (const [key, values] of Object.entries(categories)) {
  result[key] = Array.from(values).sort();
}

// Write to JSON file
fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));

console.log(`Processed ${Object.keys(result).length} categories with a total of ${Object.values(result).flat().length} subcategories.`);