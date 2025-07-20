const fs = require('fs');
const path = require('path');
const { normalizeCountryCode } = require('../utils/countryMappings');

/**
 * Converts manufacturing_ef.csv to JSON format with columns A-D and K
 */
function convertManufacturingEfToJson() {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    const inputFile = path.join(dataDir, 'manufacturing_ef.csv');
    const outputFile = path.join(dataDir, 'manufacturing_ef.json');
    
    // Read the CSV file
    const csvContent = fs.readFileSync(inputFile, 'utf8');
    
    // Parse CSV properly handling quoted fields with newlines
    const lines = parseCSVWithQuotes(csvContent);
    
    // Skip empty lines
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    
    if (nonEmptyLines.length === 0) {
      throw new Error('CSV file is empty');
    }
    
    // Parse header row
    const headers = nonEmptyLines[0].split(',').map(h => h.trim());
    console.log('Headers found:', headers);
    
    // Target columns: A-D and K
    // A: Country/Region, B: Material Class, C: Material Type, D: Process, K: EF (kgCO2) per 1 kg
    const targetColumns = [0, 1, 2, 3, 10]; // A=0, B=1, C=2, D=3, K=10
    const targetHeaders = ['countryOfOrigin', 'materialClass', 'specificMaterial', 'Process', 'EmissionFactor'];
    
    const jsonData = [];
    
    // Process data rows (skip header)
    for (let i = 1; i < nonEmptyLines.length; i++) {
      const line = nonEmptyLines[i];
      const columns = parseCSVLine(line);
      
      // Skip if not enough columns
      if (columns.length < 11) {
        continue;
      }
      
      const record = {};
      targetColumns.forEach((colIndex, index) => {
        const headerName = targetHeaders[index];
        let value = columns[colIndex] ? columns[colIndex].trim() : '';
        
        // Clean up the value
        if (value === '' || value === 'undefined' || value === 'null') {
          value = null;
        } else if (headerName === 'EmissionFactor') {
          // Try to parse as number for EF values
          const numValue = parseFloat(value);
          value = isNaN(numValue) ? null : numValue;
        } else if (headerName === 'Process') {
          // Replace commas with empty strings in Process field
          value = value.replace(/,/g, '');
        }
        
        // Apply country code normalization for countryOfOrigin field
        if (headerName === 'countryOfOrigin') {
          value = normalizeCountryCode(value);
        }
        
        record[headerName] = value;
      });
      
      // Only add records that have country, material info, and EF value
      if (record['countryOfOrigin'] && record['materialClass'] && record['EmissionFactor'] !== null) {
        jsonData.push(record);
      }
    }
    
    // Write to JSON file
    fs.writeFileSync(outputFile, JSON.stringify(jsonData, null, 2));
    
    console.log(`Successfully converted manufacturing_ef.csv to JSON`);
    console.log(`Total records processed: ${jsonData.length}`);
    console.log(`Output file: ${outputFile}`);
    
  } catch (error) {
    console.error(`Error converting CSV to JSON: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Parse CSV content properly handling quoted fields with newlines
 */
function parseCSVWithQuotes(csvContent) {
  const lines = [];
  let currentLine = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    
    if (char === '"') {
      if (inQuotes && csvContent[i + 1] === '"') {
        // Escaped quote
        currentLine += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of line outside quotes
      if (currentLine.trim() !== '') {
        lines.push(currentLine);
      }
      currentLine = '';
      // Skip \r\n combination
      if (char === '\r' && csvContent[i + 1] === '\n') {
        i++;
      }
    } else {
      currentLine += char;
    }
  }
  
  // Add the last line if it exists
  if (currentLine.trim() !== '') {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current);
  
  return result;
}

// Run the conversion
convertManufacturingEfToJson();