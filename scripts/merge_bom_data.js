const fs = require('fs');
const path = require('path');

/**
 * Merge billOfMaterials.json with data from materials_database.json
 */
function mergeBomData() {
  // Paths
  const dataDir = path.join(__dirname, '..', 'data');
  const materialsDbPath = path.join(dataDir, 'materials_database.json');
  const ecoSolutiseDbPath = path.join(dataDir, 'eco_solutise_materials.json');
  const existingBomPath = path.join(dataDir, 'billOfMaterials.json');
  const outputPath = path.join(dataDir, 'billOfMaterials_updated.json');

  try {
    // Read source files
    const materialsDb = JSON.parse(fs.readFileSync(materialsDbPath, 'utf8'));
    let ecoSolutiseDb = [];
    try {
      ecoSolutiseDb = JSON.parse(fs.readFileSync(ecoSolutiseDbPath, 'utf8'));
    } catch (error) {
      console.warn('Eco Solutise database not found, continuing without it');
    }
    
    const existingBom = JSON.parse(fs.readFileSync(existingBomPath, 'utf8'));
    
    // Combine both material sources
    const allMaterials = [...materialsDb, ...ecoSolutiseDb];
    
    // Group materials by materialClass
    const materialsByClass = {};
    
    allMaterials.forEach(material => {
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
    
    // Merge with existing data
    // Keep existing categories not in the materials database
    for (const [materialClass, materials] of Object.entries(existingBom)) {
      if (!result[materialClass]) {
        result[materialClass] = materials;
      } else {
        // Add existing materials not in the database
        const existingSet = new Set(result[materialClass]);
        materials.forEach(material => existingSet.add(material));
        result[materialClass] = Array.from(existingSet).sort();
      }
    }
    
    // Write result to a new file
    fs.writeFileSync(
      outputPath, 
      JSON.stringify(result, null, 2)
    );
    
    console.log(`Bill of Materials updated successfully.`);
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
    console.error('Error merging BOM data:', error);
    throw error;
  }
}

// Run the script
try {
  mergeBomData();
} catch (error) {
  console.error('Script failed:', error);
  process.exit(1);
}