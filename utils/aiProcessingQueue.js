const logger = require("./logger");
const { classifyProduct, classifyBOM, classifyManufacturingProcess, makeOpenAIRequestWithRetry } = require("./chatGPTUtils");
const productService = require("../services/product.service");
const { 
  batchClassifyProducts, 
  batchClassifyBOM, 
  batchClassifyManufacturingProcesses,
  calculateOptimalBatchSize 
} = require("./batchAIProcessor");
const productCategories = require("../data/productCategories.json");
const materialsDatabaseEnhanced = require("../data/esgnow.json");
const manufacturingProcesses = require("../data/manufacturing_ef.json");

/**
 * AI Processing Queue with Rate Limiting and Batch Processing
 * 
 * OpenAI Rate Limits:
 * - 5,000 RPM (requests per minute)
 * - 450,000 TPM (tokens per minute)
 * 
 * Our Strategy:
 * - Batch size: 500 requests max per minute (safety margin)
 * - Process products in batches with delay between batches
 * - Support both single and multi-product processing
 * - Handle image analysis appropriately
 */

class AIProcessingQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.batchSize = 500; // Safety margin under 5000 RPM limit
    this.batchDelayMs = 60000; // 1 minute delay between batches
    this.maxConcurrentRequests = 10; // Concurrent requests within a batch
    this.processedCount = 0;
    this.failedCount = 0;
    this.currentBatchStartTime = null;
  }

  /**
   * Add products to the processing queue
   * @param {Array} products - Array of product objects to process
   * @param {Object} req - Request object for account context
   */
  async addToQueue(products, req) {
    const queueItems = products.map(product => ({
      product,
      req,
      attempts: 0,
      maxAttempts: 3,
      addedAt: new Date()
    }));

    this.queue.push(...queueItems);
    logger.info(`📝 Added ${products.length} products to AI processing queue. Queue size: ${this.queue.length}`);

    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }
  }

  /**
   * Start processing the queue
   */
  async startProcessing() {
    if (this.processing) {
      logger.info("🔄 AI processing already in progress");
      return;
    }

    this.processing = true;
    this.processedCount = 0;
    this.failedCount = 0;

    logger.info(`🚀 Starting AI processing queue. Total items: ${this.queue.length}`);

    try {
      while (this.queue.length > 0) {
        await this.processBatch();
        
        // Wait before next batch if there are more items
        if (this.queue.length > 0) {
          logger.info(`⏳ Waiting ${this.batchDelayMs / 1000}s before next batch to respect rate limits`);
          await this.sleep(this.batchDelayMs);
        }
      }

      logger.info(`✅ AI processing queue completed. Processed: ${this.processedCount}, Failed: ${this.failedCount}`);
    } catch (error) {
      logger.error("❌ Error in AI processing queue:", error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a batch of products
   */
  async processBatch() {
    const batchItems = this.queue.splice(0, this.batchSize);
    this.currentBatchStartTime = new Date();

    logger.info(`🔄 Processing batch of ${batchItems.length} products`);

    // Group products by whether they have images or not
    const productsWithImages = [];
    const productsWithoutImages = [];

    for (const item of batchItems) {
      if (item.product.imageUrl) {
        productsWithImages.push(item);
      } else {
        productsWithoutImages.push(item);
      }
    }

    // Process products without images in multi-product batches
    if (productsWithoutImages.length > 0) {
      await this.processMultiProductBatch(productsWithoutImages);
    }

    // Process products with images individually (since image analysis is important)
    if (productsWithImages.length > 0) {
      await this.processSingleProductBatch(productsWithImages);
    }

    const batchDuration = (new Date() - this.currentBatchStartTime) / 1000;
    logger.info(`✅ Batch completed in ${batchDuration}s`);
  }

  /**
   * Process multiple products without images in a single request
   * This optimizes for products that don't need individual image analysis
   */
  async processMultiProductBatch(items) {
    logger.info(`🔄 Processing ${items.length} products without images in multi-product batches`);

    // Calculate optimal batch size based on token limits and product data
    const products = items.map(item => ({
      code: item.product.code,
      name: item.product.name,
      description: item.product.description,
      weight: item.product.weight
    }));

    const optimalBatchSize = calculateOptimalBatchSize(products, 80000); // Conservative token limit
    logger.info(`📊 Using optimal batch size of ${optimalBatchSize} products per batch`);

    // Split into optimally sized groups
    const groups = [];
    for (let i = 0; i < items.length; i += optimalBatchSize) {
      groups.push(items.slice(i, i + optimalBatchSize));
    }

    logger.info(`📦 Split ${items.length} products into ${groups.length} optimized batches`);

    // Process groups concurrently but limited
    const promises = groups.map((group, index) => 
      this.processProductGroup(group, index)
    );

    await this.processConcurrently(promises, this.maxConcurrentRequests);
  }

  /**
   * Process products with images individually
   */
  async processSingleProductBatch(items) {
    logger.info(`🔄 Processing ${items.length} products with images individually`);

    const promises = items.map((item, index) => 
      this.processSingleProduct(item, index)
    );

    await this.processConcurrently(promises, this.maxConcurrentRequests);
  }

  /**
   * Process a group of products using advanced batch processing
   */
  async processProductGroup(groupItems, groupIndex) {
    try {
      logger.info(`🔄 Processing group ${groupIndex + 1} with ${groupItems.length} products using batch AI processing`);

      // Update all products to processing status
      const Product = await productService.getProductModel(groupItems[0].req);
      const productIds = groupItems.map(item => item.product._id);
      
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: { aiProcessingStatus: 'processing' } }
      );

      // Prepare batch data for AI processing
      const batchData = groupItems.map(item => ({
        code: item.product.code,
        name: item.product.name,
        description: item.product.description,
        weight: item.product.weight,
        countryOfOrigin: item.product.countryOfOrigin
      }));

      // Step 1: Batch classify products
      const classificationResult = await batchClassifyProducts(batchData, productCategories, groupItems[0].req);
      
      if (!classificationResult.success) {
        throw new Error(`Batch classification failed: ${classificationResult.error}`);
      }

      // Step 2: Batch classify BOM
      const bomResult = await batchClassifyBOM(batchData, materialsDatabaseEnhanced, groupItems[0].req);
      
      if (!bomResult.success) {
        throw new Error(`Batch BOM classification failed: ${bomResult.error}`);
      }

      // Step 3: Prepare data for manufacturing process classification
      const productsWithBOM = batchData.map((product, index) => {
        const bomData = bomResult.results.find(r => r.productCode === product.code);
        return {
          ...product,
          bom: bomData ? bomData.bom : []
        };
      });

      const manufacturingResult = await batchClassifyManufacturingProcesses(
        productsWithBOM, 
        manufacturingProcesses, 
        groupItems[0].req
      );
      
      if (!manufacturingResult.success) {
        throw new Error(`Batch manufacturing classification failed: ${manufacturingResult.error}`);
      }

      // Step 4: Update products with results
      for (let i = 0; i < groupItems.length; i++) {
        const item = groupItems[i];
        const productCode = item.product.code;

        try {
          // Find results for this product
          const classification = classificationResult.results.find(r => r.productCode === productCode);
          const bom = bomResult.results.find(r => r.productCode === productCode);
          const manufacturing = manufacturingResult.results.find(r => r.productCode === productCode);

          if (!classification || !bom || !manufacturing) {
            throw new Error(`Missing results for product ${productCode}`);
          }

          // Calculate emissions
          const co2EmissionRawMaterials = productService.calculateRawMaterialEmissions(
            bom.bom,
            item.product.countryOfOrigin
          );
          const co2EmissionFromProcesses = productService.calculateProcessEmissions(
            manufacturing.processes
          );

          const co2Emission = co2EmissionRawMaterials + co2EmissionFromProcesses;

          // Update product in database
          await Product.updateOne(
            { _id: item.product._id },
            {
              $set: {
                category: classification.category,
                subCategory: classification.subcategory,
                materials: bom.bom,
                productManufacturingProcess: manufacturing.processes,
                co2Emission,
                co2EmissionRawMaterials,
                co2EmissionFromProcesses,
                aiProcessingStatus: 'completed',
                modifiedDate: Date.now(),
                lastProcessed: new Date()
              }
            }
          );

          this.processedCount++;
          logger.info(`✅ Successfully batch processed product ${productCode}`);

        } catch (productError) {
          logger.error(`❌ Error updating product ${productCode}:`, productError);
          await this.handleProductFailure(item, productError);
        }
      }

      // Log batch processing statistics
      const totalUsage = {
        total_tokens: (classificationResult.usage?.total_tokens || 0) + 
                      (bomResult.usage?.total_tokens || 0) + 
                      (manufacturingResult.usage?.total_tokens || 0)
      };

      logger.info(`📊 Batch processing completed. Tokens used: ${totalUsage.total_tokens}`);

    } catch (error) {
      logger.error(`❌ Error processing batch group ${groupIndex + 1}:`, error);
      
      // Mark all products in group as failed
      for (const item of groupItems) {
        await this.handleProductFailure(item, error);
      }
    }
  }

  /**
   * Process a single product (typically with image)
   */
  async processSingleProduct(item, index) {
    try {
      logger.info(`🔄 Processing single product ${index + 1}: ${item.product.code}`);

      const Product = await productService.getProductModel(item.req);
      
      // Update status to processing
      await Product.updateOne(
        { _id: item.product._id },
        { $set: { aiProcessingStatus: 'processing' } }
      );

      // Process AI classification
      const classifyResult = await classifyProduct(
        item.product.code,
        item.product.name,
        item.product.description,
        item.product.imageUrl,
        item.req
      );

      const classifyBOMResult = await classifyBOM(
        item.product.code,
        item.product.name,
        item.product.description,
        item.product.weight,
        item.product.imageUrl,
        item.req
      );

      const classifyManufacturingProcessResult = await classifyManufacturingProcess(
        item.product.code,
        item.product.name,
        item.product.description,
        classifyBOMResult,
        item.req
      );

      // Calculate emissions
      const co2EmissionRawMaterials = productService.calculateRawMaterialEmissions(
        classifyBOMResult,
        item.product.countryOfOrigin
      );
      const co2EmissionFromProcesses = productService.calculateProcessEmissions(
        classifyManufacturingProcessResult
      );

      const co2Emission = co2EmissionRawMaterials + co2EmissionFromProcesses;

      // Update product with results
      await Product.updateOne(
        { _id: item.product._id },
        {
          $set: {
            category: classifyResult.category,
            subcategory: classifyResult.subcategory,
            bom: classifyBOMResult,
            manufacturingProcesses: classifyManufacturingProcessResult,
            co2Emission,
            co2EmissionRawMaterials,
            co2EmissionFromProcesses,
            aiProcessingStatus: 'completed',
            lastProcessed: new Date()
          }
        }
      );

      this.processedCount++;
      logger.info(`✅ Successfully processed product with image: ${item.product.code}`);

    } catch (error) {
      logger.error(`❌ Error processing single product ${item.product.code}:`, error);
      await this.handleProductFailure(item, error);
    }
  }


  /**
   * Handle product processing failure
   */
  async handleProductFailure(item, error) {
    item.attempts++;
    
    if (item.attempts < item.maxAttempts) {
      // Retry: add back to queue
      this.queue.unshift(item);
      logger.warn(`⚠️ Retrying product ${item.product.code} (attempt ${item.attempts}/${item.maxAttempts})`);
    } else {
      // Mark as failed
      try {
        const Product = await productService.getProductModel(item.req);
        await Product.updateOne(
          { _id: item.product._id },
          {
            $set: {
              aiProcessingStatus: 'failed',
              lastProcessed: new Date(),
              processingError: error.message || 'Unknown error'
            }
          }
        );
        
        this.failedCount++;
        logger.error(`❌ Product ${item.product.code} failed after ${item.maxAttempts} attempts: ${error.message}`);
      } catch (updateError) {
        logger.error(`❌ Failed to update product status for ${item.product.code}:`, updateError);
      }
    }
  }

  /**
   * Process promises concurrently with limit
   */
  async processConcurrently(promises, concurrencyLimit) {
    const results = [];
    
    for (let i = 0; i < promises.length; i += concurrencyLimit) {
      const batch = promises.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
      
      // Small delay between concurrent batches
      if (i + concurrencyLimit < promises.length) {
        await this.sleep(1000); // 1 second delay
      }
    }
    
    return results;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
      batchSize: this.batchSize,
      currentBatchStartTime: this.currentBatchStartTime
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop processing (graceful shutdown)
   */
  stop() {
    logger.info("🛑 Stopping AI processing queue");
    this.processing = false;
  }
}

// Create singleton instance
const aiProcessingQueue = new AIProcessingQueue();

module.exports = aiProcessingQueue;