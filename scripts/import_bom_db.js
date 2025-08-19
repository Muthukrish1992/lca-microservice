const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { normalizeCountryCode } = require('../utils/countryMappings');

/**
 * Convert materials database CSV to JSON format similar to materials_database.json
 */
function convertFileToJson() {
  // Paths
  const dataDir = path.join(__dirname, '..', 'data');
  const csvFile = path.join(dataDir, 'materials_database.csv');
  const outputFile = path.join(dataDir, 'materials_database.json');

  if (!fs.existsSync(csvFile)) {
    throw new Error('materials_database.csv not found in data directory');
  }

  console.log('Found CSV file, using:', csvFile);

  try {
    // Read CSV file
    const csvContent = fs.readFileSync(csvFile, 'utf8');
    
    // Parse CSV using Papaparse for better handling of complex CSV structures
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';']
    });
    
    const rows = parsed.data;
    console.log(`Read ${rows.length} rows from CSV file`);
    
    if (rows.length === 0) {
      throw new Error('No data found in file');
    }
    
    // Display a sample row to debug
    console.log('Sample row:', JSON.stringify(rows[0], null, 2));
    
    // Process data to match materials_database.json format
    const results = rows
      .filter(row => {
        // Filter out rows without essential data
        const hasData = row['Country/Region'] && row['Material Category'] && row['Material Subtype'] && row['kg CO2e'];
        if (!hasData) {
          console.warn(`Skipping row with missing data: ${JSON.stringify(row)}`);
        }
        return hasData;
      })
      .map(row => {
        // Extract and normalize country code from region
        const regionName = row['Country/Region'] || '';
        const countryOfOrigin = normalizeCountryCode(regionName);
        
        // Create entry in the format of materials_database.json with additional fields
        return {
          "countryOfOrigin": countryOfOrigin,
          "materialClass": row['Material Category'] || '',
          "specificMaterial": (row['Material Subtype'] || '').replace(/-/g, ' '),
          "EmissionFactor": parseFloat(parseFloat(row['kg CO2e']).toFixed(2)) || 0,
          "EF_Source": row['EF Source'] || '',
          "Source_Dataset_Name": row['Source Dataset Name'] || '',
          "EF_Type": row['EF Type'] || '',
          "Type_Rationale": row['Type Rationale'] || '',
          "Use_Case": row['Use Case'] || ''
        };
      });
    
    // Write results to JSON file
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 4));
    
    console.log(`Conversion complete. ${results.length} materials processed.`);
    console.log(`Output saved to: ${outputFile}`);
    
    // Display summary by material class
    const summary = {};
    results.forEach(item => {
      if (!summary[item.materialClass]) {
        summary[item.materialClass] = 0;
      }
      summary[item.materialClass]++;
    });
    
    console.log('\nSummary by Material Class:');
    Object.entries(summary).forEach(([materialClass, count]) => {
      console.log(`${materialClass}: ${count} items`);
    });
    
    return results;
  } catch (error) {
    console.error('Error processing CSV:', error);
    throw error;
  }
}

// Run the script
try {
  convertFileToJson();
} catch (error) {
  console.error('Script failed:', error);
  process.exit(1);
}