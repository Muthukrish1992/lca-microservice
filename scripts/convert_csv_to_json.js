const fs = require('fs');
const path = require('path');

/**
 * Simple CSV parser
 * @param {string} text - CSV content
 * @param {object} options - Parsing options
 * @returns {Array} Parsed data as array of objects
 */
function parseCSV(text, options = {}) {
  const { delimiter = ',', skipLines = 0 } = options;
  
  // Split text into lines and skip specified number of lines
  let lines = text.split(/\r?\n/);
  lines = lines.slice(skipLines);
  
  // Remove empty lines
  lines = lines.filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return [];
  }
  
  // Extract headers from first line
  const headers = lines[0].split(delimiter).map(header => header.trim());
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i], delimiter);
    
    if (values.length !== headers.length) {
      console.warn(`Warning: Line ${i + skipLines} has ${values.length} fields, expected ${headers.length}`);
      // Skip lines with incorrect number of fields
      continue;
    }
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    
    data.push(row);
  }
  
  return data;
}

/**
 * Split CSV line handling quoted values
 * @param {string} line - CSV line
 * @param {string} delimiter - Field delimiter
 * @returns {Array} Array of field values
 */
function splitCSVLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Handle quotes
      if (inQuotes && i < line.length - 1 && line[i + 1] === '"') {
        // Escaped quote inside quotes
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      // Add character to current field
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
}

/**
 * Convert Eco Solutise CSV to JSON format similar to materials_database.json
 */
function convertCsvToJson() {
  // Paths
  const dataDir = path.join(__dirname, '..', 'data');
  const inputFile = path.join(dataDir, 'Eco Solutise Database - Ongoing V3 28.03.2025.xlsx - EF Database - V3.csv');
  const outputFile = path.join(dataDir, 'eco_solutise_materials.json');

  // Country codes mapping (example mapping - expand as needed)
  const regionToCountryCode = {
    'Rest-of-World (RoW)': 'RoW',
    'ROW': 'RoW',
    'Row': 'RoW',
    'Germany (DE)': 'DE',
    'Sweden (SE)': 'SE',
    'China (CN)': 'CN',
    'China': 'CN',
    'Global (GLO)': 'GLO',
    'Global Average': 'GLO',
    'Global': 'GLO'
    // Add more mappings as needed
  };

  try {
    // Read CSV file
    const csvContent = fs.readFileSync(inputFile, 'utf8');
    
    // Parse CSV
    const rows = parseCSV(csvContent, { skipLines: 2 });
    
    // Process data to match materials_database.json format
    const results = rows
      .filter(row => row['Region'] && row['Material Category'] && row['Material Subtype'])
      .map(row => {
        // Extract country code from region
        const regionName = row['Region'] || '';
        const countryOfOrigin = regionToCountryCode[regionName] || regionName.split(' ')[0].replace(/[()]/g, '');
        
        // Parse emission factor
        let emissionFactor = 0;
        try {
          emissionFactor = parseFloat(row['kg CO2-Eq']);
          if (isNaN(emissionFactor)) emissionFactor = 0;
        } catch (e) {
          console.warn(`Warning: Could not parse emission factor for ${row['Material Subtype']}`);
        }
        
        // Create entry in the format of materials_database.json
        return {
          "countryOfOrigin": countryOfOrigin,
          "materialClass": row['Material Category'] || '',
          "specificMaterial": row['Material Subtype'] || '',
          "EmissionFactor": emissionFactor
        };
      });
    
    // Write results to JSON file
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 4));
    
    console.log(`Conversion complete. ${results.length} materials processed.`);
    console.log(`Output saved to: ${outputFile}`);
    
    return results;
  } catch (error) {
    console.error('Error processing CSV:', error);
    throw error;
  }
}

// Run the script
try {
  convertCsvToJson();
} catch (error) {
  console.error('Script failed:', error);
  process.exit(1);
}