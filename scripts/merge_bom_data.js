const fs = require('fs');
const path = require('path');

/**
 * Generate a formatted materials list from materials_database.json
 */
function generateMaterialsList() {
  // Paths
  const dataDir = path.join(__dirname, '..', 'data');
  const materialsDbPath = path.join(dataDir, 'materials_database.json');
  const outputPath = path.join(dataDir, 'formatted_materials.json');

  try {
    // Read source files
    const materialsDb = JSON.parse(fs.readFileSync(materialsDbPath, 'utf8'));
    
    // Group materials by materialClass
    const materialsByClass = {};
    
    materialsDb.forEach(material => {
      const materialClass = material.materialClass;
      const specificMaterial = material.specificMaterial;
      
      if (!materialClass || !specificMaterial) return;
      
      if (!materialsByClass[materialClass]) {
        materialsByClass[materialClass] = new Set();
      }
      
      materialsByClass[materialClass].add(specificMaterial);
    });
    
    // Convert Sets to sorted arrays
    const result = {};
    for (const [materialClass, materials] of Object.entries(materialsByClass)) {
      result[materialClass] = Array.from(materials).sort();
    }
    
    // Write result to a new file
    fs.writeFileSync(
      outputPath, 
      JSON.stringify(result, null, 2)
    );
    
    console.log(`Formatted materials list generated successfully.`);
    console.log(`Materials per category:`);
    
    // Print statistics
    let totalMaterials = 0;
    for (const [materialClass, materials] of Object.entries(result)) {
      console.log(`  ${materialClass}: ${materials.length} materials`);
      totalMaterials += materials.length;
    }
    
    console.log(`Total material categories: ${Object.keys(result).length}`);
    console.log(`Total materials: ${totalMaterials}`);
    console.log(`Output saved to: ${outputPath}`);
    
    return result;
  } catch (error) {
    console.error('Error generating materials list:', error);
    throw error;
  }
}

// Run the script
try {
  generateMaterialsList();
} catch (error) {
  console.error('Script failed:', error);
  process.exit(1);
}