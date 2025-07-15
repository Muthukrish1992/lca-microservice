const fs = require('fs');
const path = require('path');

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
    const lines = csvContent.split('\n');
    
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
    const targetHeaders = ['Country/Region', 'Material Class', 'Material Type', 'Process', 'EF (kgCO2) per 1 kg'];
    
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
        } else if (headerName === 'EF (kgCO2) per 1 kg') {
          // Try to parse as number for EF values
          const numValue = parseFloat(value);
          value = isNaN(numValue) ? null : numValue;
        }
        
        record[headerName] = value;
      });
      
      // Only add records that have country, material info, and EF value
      if (record['Country/Region'] && record['Material Class'] && record['EF (kgCO2) per 1 kg'] !== null) {
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