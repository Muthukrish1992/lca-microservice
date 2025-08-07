const fs = require('fs');
const path = require('path');

const csvFilePath = path.join(__dirname, '..', 'data', 'category.csv');
const outputFilePath = path.join(__dirname, '..', 'data', 'productCategories.json');

try {
  // Check if CSV file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`CSV file not found at: ${csvFilePath}`);
    process.exit(1);
  }

  // Read CSV file
  const csvData = fs.readFileSync(csvFilePath, 'utf8');
  console.log(`Read CSV file: ${csvData.length} characters`);

  // Parse CSV data
  const lines = csvData.split('\n').filter(line => line.trim() !== ''); // Filter out empty lines
  console.log(`Found ${lines.length} lines in CSV`);

  if (lines.length === 0) {
    console.error('CSV file appears to be empty');
    process.exit(1);
  }

  // Log the header to verify structure
  console.log('Header:', lines[0]);

  // Skip header and start processing from line 1
  const categories = {};

  // Process each line of the CSV
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    // Simple CSV parsing - split by comma and handle basic quoted fields
    let columns = [];
    let column = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(column.trim());
        column = '';
      } else {
        column += char;
      }
    }
    columns.push(column.trim()); // Don't forget the last column
    
    // Debug: log first few rows
    if (i <= 3) {
      console.log(`Row ${i}:`, columns);
    }
    
    if (columns.length < 2) {
      console.warn(`Skipping row ${i}: insufficient columns (${columns.length})`);
      continue;
    }
    
    // Clean up quotes and whitespace
    let category = columns[0].replace(/^"|"$/g, '').trim(); // Remove surrounding quotes only
    let subCategory = columns[1].replace(/^"|"$/g, '').trim();
    
    // Skip empty values or header rows
    if (!category || !subCategory || 
        category.toLowerCase() === 'category' || 
        subCategory.toLowerCase() === 'sub category') {
      console.log(`Skipping row ${i}: category="${category}", subCategory="${subCategory}"`);
      continue;
    }
    
    // Add to categories
    if (!categories[category]) {
      categories[category] = new Set();
    }
    categories[category].add(subCategory);
  }

  // Convert Sets to Arrays
  const result = {};
  for (const [key, values] of Object.entries(categories)) {
    result[key] = Array.from(values).sort();
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputFilePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to JSON file
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));

  console.log(`✅ Successfully processed ${Object.keys(result).length} categories with a total of ${Object.values(result).flat().length} subcategories.`);
  console.log(`Output written to: ${outputFilePath}`);
  
  // Show sample of the result
  console.log('\nSample categories:');
  Object.keys(result).slice(0, 3).forEach(cat => {
    console.log(`${cat}: ${result[cat].slice(0, 3).join(', ')}${result[cat].length > 3 ? '...' : ''}`);
  });

} catch (error) {
  console.error('Error processing CSV:', error.message);
  console.error('Full error:', error);
}