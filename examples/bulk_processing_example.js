/**
 * Example: Bulk Product Processing with AI Queue
 * 
 * This example demonstrates how to use the new AI processing queue system
 * for efficient bulk product processing while respecting OpenAI rate limits.
 */

const express = require('express');
const aiProcessingQueue = require('../utils/aiProcessingQueue');

// Example usage functions
async function exampleBulkProcessing() {
  console.log('🚀 Starting bulk processing example...');

  // Simulate bulk uploaded products (normally from database)
  const mockProducts = [
    {
      _id: '1',
      code: 'CHAIR001',
      name: 'Ergonomic Office Chair',
      description: 'Modern ergonomic office chair with lumbar support, made from black leather and steel frame',
      weight: 15.5,
      countryOfOrigin: 'CN',
      imageUrl: null, // No image - will be batch processed
      aiProcessingStatus: 'pending'
    },
    {
      _id: '2', 
      code: 'DESK002',
      name: 'Standing Desk',
      description: 'Adjustable height standing desk made from oak wood with metal legs',
      weight: 25.0,
      countryOfOrigin: 'US',
      imageUrl: 'https://example.com/desk.jpg', // Has image - will be processed individually
      aiProcessingStatus: 'pending'
    },
    {
      _id: '3',
      code: 'LAMP003', 
      name: 'LED Table Lamp',
      description: 'Energy efficient LED table lamp with aluminum base and fabric shade',
      weight: 2.5,
      countryOfOrigin: 'DE',
      imageUrl: null, // No image - will be batch processed
      aiProcessingStatus: 'pending'
    }
  ];

  // Mock request object (normally from Express)
  const mockReq = {
    get: (header) => header === 'x-iviva-account' ? 'example-account' : null
  };

  try {
    // Add products to queue
    await aiProcessingQueue.addToQueue(mockProducts, mockReq);
    
    // Monitor processing
    const initialStatus = aiProcessingQueue.getStatus();
    console.log('📊 Initial queue status:', initialStatus);

    // Wait for processing to complete (in real app, you'd poll status endpoint)
    console.log('⏳ Processing will continue in background...');
    console.log('💡 In production, monitor via GET /api/products/queue-status');
    
  } catch (error) {
    console.error('❌ Error in bulk processing:', error);
  }
}

// Example queue management functions
async function exampleQueueManagement() {
  console.log('\n🔧 Queue Management Examples:');

  // Check current status
  const status = aiProcessingQueue.getStatus();
  console.log('📊 Current status:', status);

  // Update configuration for higher volume processing
  aiProcessingQueue.batchSize = 300; // Reduce batch size for better stability
  aiProcessingQueue.batchDelayMs = 45000; // 45 second delays instead of 60
  
  console.log('✅ Updated configuration:');
  console.log('  - Batch size: 300 products');
  console.log('  - Batch delay: 45 seconds');
  
  // Stop processing (graceful shutdown)
  aiProcessingQueue.stop();
  console.log('🛑 Processing stopped');
}

// Example error handling
function exampleErrorHandling() {
  console.log('\n🚨 Error Handling Examples:');
  
  console.log('📋 Common scenarios:');
  console.log('1. Rate Limiting (429 errors):');
  console.log('   → Increase batch delays or reduce batch size');
  console.log('   → System automatically retries with exponential backoff');
  
  console.log('\n2. Token Limit Exceeded:');
  console.log('   → System automatically calculates optimal batch sizes');
  console.log('   → Batch size adapts based on product description length');
  
  console.log('\n3. Processing Failures:');
  console.log('   → Products retry up to 3 times automatically');
  console.log('   → Failed products marked as "failed" after max retries');
  console.log('   → Use reset-failed endpoint to retry failed products');
  
  console.log('\n4. Queue Management:');
  console.log('   → Monitor via /api/products/queue-status');
  console.log('   → Control via /api/products/start-queue, /api/products/stop-queue');
  console.log('   → Configure via /api/products/queue-config');
}

// Performance optimization examples
function examplePerformanceOptimization() {
  console.log('\n⚡ Performance Optimization:');
  
  console.log('📈 Optimal Settings for Different Scenarios:');
  
  console.log('\n🏭 High Volume Processing (1000+ products):');
  console.log('  - batchSize: 300');
  console.log('  - batchDelayMs: 45000 (45 seconds)');
  console.log('  - maxConcurrentRequests: 8');
  console.log('  - Expected rate: ~400 products/hour');
  
  console.log('\n🖼️ Image-Heavy Processing (many products with images):');
  console.log('  - batchSize: 200 (more individual processing)');
  console.log('  - batchDelayMs: 60000 (1 minute)');
  console.log('  - maxConcurrentRequests: 6');
  console.log('  - Expected rate: ~180 products/hour');
  
  console.log('\n🔄 Mixed Processing (some images, some without):');
  console.log('  - batchSize: 400 (default works well)');
  console.log('  - batchDelayMs: 50000 (50 seconds)');
  console.log('  - maxConcurrentRequests: 10');
  console.log('  - Expected rate: ~350 products/hour');
}

// Example API integration
function exampleAPIIntegration() {
  console.log('\n🌐 API Integration Examples:');
  
  console.log('📝 After bulk upload, check processing:');
  console.log(`
// JavaScript fetch example
const response = await fetch('/api/products/queue-status');
const status = await response.json();
console.log('Queue length:', status.data.queue.queueLength);
console.log('Processing:', status.data.queue.processing);
  `);

  console.log('\n🔄 Start processing manually:');
  console.log(`
// Start queue processing
await fetch('/api/products/start-queue', { method: 'POST' });
  `);

  console.log('\n⚙️ Update configuration:');
  console.log(`
// Update batch size for high-volume processing
await fetch('/api/products/queue-config', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    batchSize: 300,
    batchDelayMs: 45000
  })
});
  `);

  console.log('\n🔄 Handle failed products:');
  console.log(`
// Reset failed products and restart
await fetch('/api/products/reset-failed', { method: 'POST' });
await fetch('/api/products/start-queue', { method: 'POST' });
  `);
}

// Run examples
async function runExamples() {
  console.log('🎯 AI Processing Queue System Examples\n');
  console.log('=====================================\n');
  
  // Note: Uncomment to run actual processing (requires OpenAI API key)
  // await exampleBulkProcessing();
  
  exampleQueueManagement();
  exampleErrorHandling();
  examplePerformanceOptimization();
  exampleAPIIntegration();
  
  console.log('\n✅ Examples completed!');
  console.log('\n📚 For full documentation, see: docs/AI_PROCESSING_QUEUE.md');
}

// Export for use in other files
module.exports = {
  exampleBulkProcessing,
  exampleQueueManagement,
  exampleErrorHandling,
  examplePerformanceOptimization,
  exampleAPIIntegration
};

// Run examples if called directly
if (require.main === module) {
  runExamples().catch(console.error);
}