const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { normalizeCountryCode } = require('../utils/countryMappings');

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
 * Read Excel file and convert to JSON array
 * @param {string} filePath - Path to Excel file
 * @returns {Array} Array of objects representing rows
 */
function readExcelFile(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Use first sheet
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}

/**
 * Convert Eco Solutise CSV/Excel to JSON format similar to materials_database.json
 */
function convertFileToJson() {
  // Paths
  const dataDir = path.join(__dirname, '..', 'data');
  
  // Check for both CSV and Excel files
  const csvFile = path.join(dataDir, 'ESGNOW.csv');
  const excelFile = path.join(dataDir, 'ESGNOW.xlsx');
  
  let inputFile;
  let isExcel = false;
  
  if (fs.existsSync(excelFile)) {
    inputFile = excelFile;
    isExcel = true;
    console.log('Found Excel file, using:', excelFile);
  } else if (fs.existsSync(csvFile)) {
    inputFile = csvFile;
    console.log('Found CSV file, using:', csvFile);
  } else {
    throw new Error('Neither ESGNOW.csv nor ESGNOW.xlsx found in data directory');
  }
  
  const outputFile = path.join(dataDir, 'esgnow.json');

  // Country codes mapping - now using common utility

  try {
    let rows;
    
    if (isExcel) {
      // Read Excel file
      rows = readExcelFile(inputFile);
      console.log(`Read ${rows.length} rows from Excel file`);
    } else {
      // Read CSV file
      const csvContent = fs.readFileSync(inputFile, 'utf8');
      
      // Parse CSV - no need to skip lines since format changed
      rows = parseCSV(csvContent, { skipLines: 0 });
      console.log(`Read ${rows.length} rows from CSV file`);
    }
    
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
          "specificMaterial": row['Material Subtype'] || '',
          "EmissionFactor": parseFloat(row['kg CO2e']) || 0,
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