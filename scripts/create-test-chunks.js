const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Script to split a file into chunks for Postman testing
 * Usage: node create-test-chunks.js <inputFile> [chunkSize]
 */

function splitFileIntoChunks(inputFilePath, chunkSize = 20 * 1024 * 1024) {
  if (!fs.existsSync(inputFilePath)) {
    console.error('❌ Input file does not exist:', inputFilePath);
    process.exit(1);
  }

  const stats = fs.statSync(inputFilePath);
  const fileSize = stats.size;
  const filename = path.basename(inputFilePath);
  const outputDir = path.join(__dirname, 'chunks', path.parse(filename).name);

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`📁 Input file: ${filename}`);
  console.log(`📊 File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📦 Chunk size: ${(chunkSize / 1024 / 1024).toFixed(2)} MB`);

  const totalChunks = Math.ceil(fileSize / chunkSize);
  console.log(`🔢 Total chunks: ${totalChunks}`);

  // Calculate file hash
  const hash = crypto.createHash('sha256');
  const fileData = fs.readFileSync(inputFilePath);
  hash.update(fileData);
  const fileHash = hash.digest('hex');

  // Split file into chunks
  const chunks = [];
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, fileSize);
    const chunkBuffer = fileData.slice(start, end);
    
    const chunkFilename = `chunk_${chunkIndex.toString().padStart(3, '0')}.bin`;
    const chunkPath = path.join(outputDir, chunkFilename);
    
    fs.writeFileSync(chunkPath, chunkBuffer);
    
    chunks.push({
      index: chunkIndex,
      filename: chunkFilename,
      path: chunkPath,
      size: chunkBuffer.length
    });
    
    console.log(`✅ Created ${chunkFilename} (${(chunkBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  }

  // Create metadata file for Postman testing
  const metadata = {
    originalFile: {
      filename: filename,
      size: fileSize,
      hash: fileHash
    },
    chunks: {
      total: totalChunks,
      chunkSize: chunkSize,
      list: chunks
    },
    postmanInit: {
      filename: filename,
      totalSize: fileSize,
      totalChunks: totalChunks,
      fileHash: fileHash
    }
  };

  const metadataPath = path.join(outputDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  console.log('\n🎉 Chunks created successfully!');
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`📋 Metadata file: ${metadataPath}`);
  
  console.log('\n📝 For Postman Init Request:');
  console.log(JSON.stringify(metadata.postmanInit, null, 2));

  console.log('\n📦 Chunk files for upload:');
  chunks.forEach(chunk => {
    console.log(`  - ${chunk.filename} (${(chunk.size / 1024 / 1024).toFixed(2)} MB)`);
  });
}

// Command line usage
if (require.main === module) {
  const inputFile = process.argv[2];
  const chunkSize = process.argv[3] ? parseInt(process.argv[3]) : 20 * 1024 * 1024;

  if (!inputFile) {
    console.log('Usage: node create-test-chunks.js <inputFile> [chunkSize]');
    console.log('Example: node create-test-chunks.js products.xlsx');
    console.log('Example: node create-test-chunks.js images.zip 10485760');
    process.exit(1);
  }

  splitFileIntoChunks(inputFile, chunkSize);
}

module.exports = { splitFileIntoChunks };