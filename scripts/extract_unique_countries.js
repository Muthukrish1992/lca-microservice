const fs = require('fs');
const path = require('path');

// Path to the JSON file
const jsonPath = path.join(__dirname, '..', 'data', 'eco_solutise_materials.json');

// Read and parse the JSON file
try {
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  // Get unique countryOfOrigin values
  const uniqueCountries = [...new Set(jsonData.map(item => item.countryOfOrigin))].sort();
  
  // Print the unique countries
  console.log('Unique countryOfOrigin values:');
  uniqueCountries.forEach((country, index) => {
    console.log(`${index + 1}. ${country}`);
  });
  
  console.log(`\nTotal unique countries: ${uniqueCountries.length}`);
} catch (error) {
  console.error('Error:', error.message);
}