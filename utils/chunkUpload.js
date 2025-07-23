const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

/**
 * Chunk Upload Utility
 * Handles chunked file uploads with assembly and validation
 */
class ChunkUploadManager {
  constructor(baseDir = path.join(__dirname, '../temp/chunks')) {
    this.baseDir = baseDir;
    this.chunkTimeout = 30 * 60 * 1000; // 30 minutes timeout for chunks
    fs.ensureDirSync(this.baseDir);
  }

  /**
   * Get chunk directory for a specific upload session
   */
  getChunkDir(uploadId, account) {
    return path.join(this.baseDir, account, uploadId);
  }

  /**
   * Get file info path for storing metadata
   */
  getFileInfoPath(uploadId, account) {
    return path.join(this.getChunkDir(uploadId, account), 'fileinfo.json');
  }

  /**
   * Initialize a new chunked upload session
   */
  async initializeUpload(uploadId, account, filename, totalSize, totalChunks, fileHash = null) {
    const chunkDir = this.getChunkDir(uploadId, account);
    await fs.ensureDir(chunkDir);

    const fileInfo = {
      uploadId,
      account,
      filename,
      totalSize,
      totalChunks,
      fileHash,
      receivedChunks: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    await fs.writeJson(this.getFileInfoPath(uploadId, account), fileInfo);
    logger.info(`📤 Initialized chunk upload: ${uploadId} for ${filename} (${totalChunks} chunks, ${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

    return fileInfo;
  }

  /**
   * Store a chunk
   */
  async storeChunk(uploadId, account, chunkIndex, chunkBuffer) {
    const chunkDir = this.getChunkDir(uploadId, account);
    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex.toString().padStart(6, '0')}`);
    const fileInfoPath = this.getFileInfoPath(uploadId, account);

    // Store the chunk
    await fs.writeFile(chunkPath, chunkBuffer);

    // Update file info
    const fileInfo = await fs.readJson(fileInfoPath);
    if (!fileInfo.receivedChunks.includes(chunkIndex)) {
      fileInfo.receivedChunks.push(chunkIndex);
      fileInfo.receivedChunks.sort((a, b) => a - b);
    }
    fileInfo.lastActivity = new Date();

    await fs.writeJson(fileInfoPath, fileInfo);

    logger.info(`📦 Stored chunk ${chunkIndex + 1}/${fileInfo.totalChunks} for upload ${uploadId}`);

    return {
      chunkIndex,
      receivedChunks: fileInfo.receivedChunks.length,
      totalChunks: fileInfo.totalChunks,
      isComplete: fileInfo.receivedChunks.length === fileInfo.totalChunks
    };
  }

  /**
   * Check if upload is complete
   */
  async isUploadComplete(uploadId, account) {
    try {
      const fileInfoPath = this.getFileInfoPath(uploadId, account);
      const fileInfo = await fs.readJson(fileInfoPath);
      return fileInfo.receivedChunks.length === fileInfo.totalChunks;
    } catch (error) {
      return false;
    }
  }

  /**
   * Assemble chunks into final file
   */
  async assembleFile(uploadId, account, outputPath = null) {
    const fileInfoPath = this.getFileInfoPath(uploadId, account);
    const fileInfo = await fs.readJson(fileInfoPath);
    const chunkDir = this.getChunkDir(uploadId, account);

    if (fileInfo.receivedChunks.length !== fileInfo.totalChunks) {
      throw new Error(`Upload incomplete: ${fileInfo.receivedChunks.length}/${fileInfo.totalChunks} chunks received`);
    }

    // Default output path
    if (!outputPath) {
      outputPath = path.join(this.baseDir, account, `assembled_${uploadId}_${fileInfo.filename}`);
    }

    await fs.ensureDir(path.dirname(outputPath));

    // Create write stream for assembled file
    const writeStream = fs.createWriteStream(outputPath);

    try {
      // Assemble chunks in order
      for (let i = 0; i < fileInfo.totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk_${i.toString().padStart(6, '0')}`);
        
        if (!await fs.pathExists(chunkPath)) {
          throw new Error(`Missing chunk ${i} at ${chunkPath}`);
        }

        const chunkData = await fs.readFile(chunkPath);
        writeStream.write(chunkData);
      }

      writeStream.end();

      // Wait for write to complete
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Verify file size
      const assembledStats = await fs.stat(outputPath);
      if (assembledStats.size !== fileInfo.totalSize) {
        throw new Error(`File size mismatch: expected ${fileInfo.totalSize}, got ${assembledStats.size}`);
      }

      // Verify file hash if provided
      if (fileInfo.fileHash) {
        const assembledHash = await this.calculateFileHash(outputPath);
        if (assembledHash !== fileInfo.fileHash) {
          throw new Error(`File hash mismatch: expected ${fileInfo.fileHash}, got ${assembledHash}`);
        }
      }

      logger.info(`✅ Successfully assembled file: ${outputPath} (${(assembledStats.size / 1024 / 1024).toFixed(2)} MB)`);

      return {
        filePath: outputPath,
        filename: fileInfo.filename,
        size: assembledStats.size,
        uploadId: uploadId
      };

    } catch (error) {
      // Clean up failed assembly
      if (await fs.pathExists(outputPath)) {
        await fs.unlink(outputPath);
      }
      throw error;
    }
  }

  /**
   * Calculate SHA-256 hash of a file
   */
  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Clean up chunks for a specific upload
   */
  async cleanupUpload(uploadId, account) {
    const chunkDir = this.getChunkDir(uploadId, account);
    
    if (await fs.pathExists(chunkDir)) {
      await fs.remove(chunkDir);
      logger.info(`🧹 Cleaned up chunks for upload: ${uploadId}`);
    }
  }

  /**
   * Clean up expired uploads
   */
  async cleanupExpiredUploads() {
    try {
      const accounts = await fs.readdir(this.baseDir);
      const now = new Date();

      for (const account of accounts) {
        const accountDir = path.join(this.baseDir, account);
        if (!(await fs.stat(accountDir)).isDirectory()) continue;

        const uploads = await fs.readdir(accountDir);
        
        for (const uploadId of uploads) {
          const uploadDir = path.join(accountDir, uploadId);
          if (!(await fs.stat(uploadDir)).isDirectory()) continue;

          const fileInfoPath = path.join(uploadDir, 'fileinfo.json');
          
          if (await fs.pathExists(fileInfoPath)) {
            const fileInfo = await fs.readJson(fileInfoPath);
            const lastActivity = new Date(fileInfo.lastActivity);
            
            if (now - lastActivity > this.chunkTimeout) {
              await fs.remove(uploadDir);
              logger.info(`🧹 Cleaned up expired upload: ${uploadId} (account: ${account})`);
            }
          } else {
            // Remove directories without fileinfo.json
            await fs.remove(uploadDir);
          }
        }
      }
    } catch (error) {
      logger.error('Error cleaning up expired uploads:', error);
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(uploadId, account) {
    try {
      const fileInfoPath = this.getFileInfoPath(uploadId, account);
      
      if (!await fs.pathExists(fileInfoPath)) {
        return { exists: false };
      }

      const fileInfo = await fs.readJson(fileInfoPath);
      
      return {
        exists: true,
        uploadId: fileInfo.uploadId,
        filename: fileInfo.filename,
        totalSize: fileInfo.totalSize,
        totalChunks: fileInfo.totalChunks,
        receivedChunks: fileInfo.receivedChunks.length,
        isComplete: fileInfo.receivedChunks.length === fileInfo.totalChunks,
        createdAt: fileInfo.createdAt,
        lastActivity: fileInfo.lastActivity
      };
    } catch (error) {
      logger.error(`Error getting upload status for ${uploadId}:`, error);
      return { exists: false, error: error.message };
    }
  }
}

// Export singleton instance
const chunkUploadManager = new ChunkUploadManager();

// Clean up expired uploads every hour
setInterval(() => {
  chunkUploadManager.cleanupExpiredUploads();
}, 60 * 60 * 1000);

module.exports = chunkUploadManager;