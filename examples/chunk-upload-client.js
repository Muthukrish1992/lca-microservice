/**
 * Chunk Upload Client Example
 * 
 * This example shows how to implement chunked file upload on the client side
 * Compatible with browser JavaScript and React/Vue/Angular applications
 */

class ChunkUploader {
  constructor(baseUrl, accountHeader, chunkSize = 20 * 1024 * 1024) { // 20MB chunks
    this.baseUrl = baseUrl;
    this.accountHeader = accountHeader;
    this.chunkSize = chunkSize;
  }

  /**
   * Calculate file hash for integrity verification (optional)
   */
  async calculateFileHash(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        resolve(hashHex);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Initialize chunk upload session
   */
  async initializeUpload(file, includeHash = false) {
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const fileHash = includeHash ? await this.calculateFileHash(file) : null;

    const response = await fetch(`${this.baseUrl}/api/products/chunk-upload/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-iviva-account': this.accountHeader
      },
      body: JSON.stringify({
        filename: file.name,
        totalSize: file.size,
        totalChunks: totalChunks,
        fileHash: fileHash
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize upload: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Upload a single chunk
   */
  async uploadChunk(uploadId, chunkIndex, chunkBlob) {
    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('chunk', chunkBlob, `chunk_${chunkIndex}`);

    const response = await fetch(`${this.baseUrl}/api/products/chunk-upload/chunk`, {
      method: 'POST',
      headers: {
        'x-iviva-account': this.accountHeader
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${chunkIndex}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Complete bulk product upload
   */
  async completeBulkUpload(uploadId, fieldMappings) {
    const response = await fetch(`${this.baseUrl}/api/products/chunk-upload/complete-bulk-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-iviva-account': this.accountHeader
      },
      body: JSON.stringify({
        uploadId: uploadId,
        ...fieldMappings // Include field mappings like codeField, nameField, etc.
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to complete bulk upload: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Complete bulk image upload
   */
  async completeImageUpload(uploadId) {
    const response = await fetch(`${this.baseUrl}/api/products/chunk-upload/complete-image-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-iviva-account': this.accountHeader
      },
      body: JSON.stringify({
        uploadId: uploadId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to complete image upload: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId) {
    const response = await fetch(`${this.baseUrl}/api/products/chunk-upload/status/${uploadId}`, {
      headers: {
        'x-iviva-account': this.accountHeader
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload status: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Cancel upload
   */
  async cancelUpload(uploadId) {
    await fetch(`${this.baseUrl}/api/products/chunk-upload/${uploadId}`, {
      method: 'DELETE',
      headers: {
        'x-iviva-account': this.accountHeader
      }
    });
  }

  /**
   * Upload file with progress tracking
   */
  async uploadFile(file, options = {}) {
    const {
      onProgress = () => {},
      onChunkUploaded = () => {},
      concurrency = 3, // Number of concurrent chunk uploads
      isImageUpload = false,
      fieldMappings = {}
    } = options;

    try {
      // Step 1: Initialize upload
      console.log(`🚀 Initializing upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      const initResult = await this.initializeUpload(file, true);
      const { uploadId, totalChunks } = initResult;

      console.log(`📤 Upload ID: ${uploadId}, Total chunks: ${totalChunks}`);

      // Step 2: Upload chunks with concurrency control
      const chunkPromises = [];
      const uploadedChunks = new Set();
      let completedChunks = 0;

      // Create semaphore for concurrency control
      const semaphore = new Array(concurrency).fill(null).map(() => Promise.resolve());
      let semaphoreIndex = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * this.chunkSize;
        const end = Math.min(start + this.chunkSize, file.size);
        const chunkBlob = file.slice(start, end);

        // Wait for available semaphore slot
        const currentSemaphore = semaphoreIndex % concurrency;
        semaphoreIndex++;

        const chunkPromise = semaphore[currentSemaphore].then(async () => {
          try {
            console.log(`📦 Uploading chunk ${chunkIndex + 1}/${totalChunks}`);
            const result = await this.uploadChunk(uploadId, chunkIndex, chunkBlob);
            
            uploadedChunks.add(chunkIndex);
            completedChunks++;

            const progress = Math.round((completedChunks / totalChunks) * 100);
            onProgress(progress, completedChunks, totalChunks);
            onChunkUploaded(chunkIndex, result);

            return result;
          } catch (error) {
            console.error(`❌ Failed to upload chunk ${chunkIndex}:`, error);
            throw error;
          }
        });

        semaphore[currentSemaphore] = chunkPromise;
        chunkPromises.push(chunkPromise);
      }

      // Wait for all chunks to complete
      console.log(`⏳ Waiting for ${totalChunks} chunks to complete...`);
      await Promise.all(chunkPromises);

      console.log(`✅ All chunks uploaded successfully`);

      // Step 3: Complete the upload
      console.log(`🔧 Assembling file and processing...`);
      let finalResult;
      
      if (isImageUpload) {
        finalResult = await this.completeImageUpload(uploadId);
      } else {
        finalResult = await this.completeBulkUpload(uploadId, fieldMappings);
      }

      console.log(`🎉 Upload completed successfully!`);
      return finalResult;

    } catch (error) {
      console.error(`💥 Upload failed:`, error);
      
      // Try to cleanup on error
      try {
        await this.cancelUpload(uploadId);
      } catch (cleanupError) {
        console.error('Failed to cleanup after error:', cleanupError);
      }
      
      throw error;
    }
  }
}

// Usage Examples:

/**
 * Example 1: Bulk Product Upload
 */
async function uploadProductFile(file) {
  const uploader = new ChunkUploader('http://localhost:5009', 'your-account-id');
  
  try {
    const result = await uploader.uploadFile(file, {
      onProgress: (progress, completed, total) => {
        console.log(`Progress: ${progress}% (${completed}/${total} chunks)`);
        // Update UI progress bar here
      },
      onChunkUploaded: (chunkIndex, result) => {
        console.log(`Chunk ${chunkIndex} uploaded:`, result);
      },
      concurrency: 3,
      isImageUpload: false,
      fieldMappings: {
        codeField: 'Product Code',
        nameField: 'Product Name',
        descriptionField: 'Description',
        weightField: 'Weight'
      }
    });
    
    console.log('Products uploaded successfully:', result);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

/**
 * Example 2: Bulk Image Upload
 */
async function uploadImageFile(file) {
  const uploader = new ChunkUploader('http://localhost:5009', 'your-account-id');
  
  try {
    const result = await uploader.uploadFile(file, {
      onProgress: (progress, completed, total) => {
        console.log(`Image upload progress: ${progress}%`);
        // Update UI progress bar here
      },
      concurrency: 5, // Higher concurrency for images
      isImageUpload: true
    });
    
    console.log('Images uploaded successfully:', result);
  } catch (error) {
    console.error('Image upload failed:', error);
  }
}

/**
 * Example 3: React Hook for Chunk Upload
 */
function useChunkUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const uploadFile = async (file, options = {}) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const uploader = new ChunkUploader('http://localhost:5009', 'your-account-id');

    try {
      const result = await uploader.uploadFile(file, {
        ...options,
        onProgress: (progress) => {
          setUploadProgress(progress);
        }
      });

      setIsUploading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setIsUploading(false);
      throw err;
    }
  };

  return { uploadFile, uploadProgress, isUploading, error };
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChunkUploader;
}