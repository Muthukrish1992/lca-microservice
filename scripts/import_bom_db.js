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

  // Country codes mapping
  const regionToCountryCode = {
    'RoW': 'RoW',
    'ROW': 'RoW',
    'Row': 'RoW',
    'Rest-of-World': 'RoW',
    'Rest of World': 'RoW',
    'Germany': 'DE',
    'Sweden': 'SE',
    'China': 'CN',
    'Global (GLO)': 'GLO',
    'Global Average': 'GLO',
    'Global': 'GLO',
    'GLO': 'GLO',
    'Belgium' : 'BE',
    'Brazil' : 'BR',
    'Canada' : 'CA',
    'Egypt' : 'EG',
    'Thailand' : 'EG',
    'Italy' : 'IT',
    'Turkey' : 'TR',
    'Italy-Europe-Central' : 'IT-EC',
    'IAI Area, EU27 & EFTA' : 'IAI-EU',
    'IAI Area, North America' : 'IAI-NA',
    'Europe without Switzerland' : 'EU-CH',
  };

  try {
    // Read CSV file
    const csvContent = fs.readFileSync(inputFile, 'utf8');
    
    // Parse CSV - no need to skip lines since format changed
    const rows = parseCSV(csvContent, { skipLines: 0 });
    
    console.log(`Read ${rows.length} rows from CSV`);
    
    if (rows.length === 0) {
      throw new Error('No data found in CSV file');
    }
    
    // Display a sample row to debug
    console.log('Sample row:', JSON.stringify(rows[0], null, 2));
    
    // Process data to match materials_database.json format
    const results = rows
      .filter(row => {
        // Filter out rows without essential data
        const hasData = row['Region'] && row['Material Category'] && row['Material Subtype'] && row['kg CO2e'];
        if (!hasData) {
          console.warn(`Skipping row with missing data: ${JSON.stringify(row)}`);
        }
        return hasData;
      })
      .map(row => {
        // Extract country code from region
        const regionName = row['Region'] || '';
        
        // Clean up the region name to handle different formats
        let countryOfOrigin;
        
        // Check if it's in our mapping
        if (regionToCountryCode[regionName]) {
          countryOfOrigin = regionToCountryCode[regionName];
        } else {
          // Try to extract from patterns like "Global (GLO)" or "China (CN)"
          const matches = regionName.match(/\(([^)]+)\)/);
          if (matches && matches[1]) {
            countryOfOrigin = matches[1];
          } else {
            // Default to first word
            countryOfOrigin = regionName.split(' ')[0].replace(/[()]/g, '');
          }
        }
        
        // Normalize country code
        if (countryOfOrigin.toLowerCase() === 'global') countryOfOrigin = 'GLO';
        if (countryOfOrigin.toLowerCase() === 'row' || countryOfOrigin.toLowerCase() === 'rest') countryOfOrigin = 'RoW';
        
        // Parse emission factor
        let emissionFactor = 0;
        try {
          emissionFactor = parseFloat(row['kg CO2e']);
          if (isNaN(emissionFactor)) emissionFactor = 0;
        } catch (e) {
          console.warn(`Warning: Could not parse emission factor for ${row['Material Subtype']}: ${row['kg CO2e']}`);
        }
        
        // Create entry in the format of materials_database.json with additional fields
        return {
          "countryOfOrigin": countryOfOrigin,
          "materialClass": row['Material Category'] || '',
          "specificMaterial": row['Material Subtype'] || '',
          "EmissionFactor": emissionFactor,
          "EF_Source": row['EF Source'] || '',
          "Source_Dataset_Name": row['Source Dataset Name'] || '',
          "EF_Type": row['EF Type'] || '',
          "Type_Rationale": row['Type Rationale'] || ''
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