const fs = require('fs');
const path = require('path');

/**
 * Converts a JSON file to CSV format
 * @param {string} inputPath - Path to the JSON file
 * @param {string} outputPath - Path for the output CSV file
 */
function convertJsonToCsv(inputPath, outputPath) {
  try {
    // Read and parse the JSON file
    const jsonData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    if (!Array.isArray(jsonData)) {
      throw new Error('JSON file must contain an array of objects');
    }
    
    if (jsonData.length === 0) {
      throw new Error('JSON array is empty');
    }
    
    // Get headers from the first object
    const headers = Object.keys(jsonData[0]);
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    // Add data rows
    jsonData.forEach(item => {
      const row = headers.map(header => {
        const value = item[header];
        
        // Handle different data types
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'string') {
          // Escape quotes and wrap in quotes if the value contains commas or quotes
          const escaped = value.replace(/"/g, '""');
          return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') 
            ? `"${escaped}"` 
            : escaped;
        } else {
          return value;
        }
      });
      
      csvContent += row.join(',') + '\n';
    });
    
    // Write to output file
    fs.writeFileSync(outputPath, csvContent);
    
    console.log(`Successfully converted ${inputPath} to ${outputPath}`);
    console.log(`Total records processed: ${jsonData.length}`);
    
  } catch (error) {
    console.error(`Error converting JSON to CSV: ${error.message}`);
    process.exit(1);
  }
}

// Define paths
const dataDir = path.join(__dirname, '..', 'data');
const inputFile = path.join(dataDir, 'processing_database.json');
const outputFile = path.join(dataDir, 'processing_database.csv');

// Run the conversion
convertJsonToCsv(inputFile, outputFile);