/**
 * Image Processing Status Tracker
 * Tracks the status of background image processing tasks
 */

const processingJobs = new Map();

/**
 * Create a new processing job
 */
function createProcessingJob(jobId, totalFolders) {
  const job = {
    id: jobId,
    status: 'processing',
    totalFolders: totalFolders,
    processedFolders: 0,
    totalImages: 0,
    processedImages: 0,
    errors: [],
    startTime: new Date(),
    lastUpdate: new Date()
  };
  
  processingJobs.set(jobId, job);
  return job;
}

/**
 * Update folder processing progress
 */
function updateFolderProgress(jobId, folderName, imageCount) {
  const job = processingJobs.get(jobId);
  if (job) {
    job.processedFolders++;
    job.totalImages += imageCount;
    job.lastUpdate = new Date();
    
    // Clean up completed jobs after 1 hour
    if (job.processedFolders >= job.totalFolders) {
      setTimeout(() => {
        processingJobs.delete(jobId);
      }, 60 * 60 * 1000);
    }
  }
}

/**
 * Update image processing progress
 */
function updateImageProgress(jobId, success = true, error = null) {
  const job = processingJobs.get(jobId);
  if (job) {
    job.processedImages++;
    job.lastUpdate = new Date();
    
    if (!success && error) {
      job.errors.push({
        error: error,
        timestamp: new Date()
      });
    }
    
    if (job.processedImages >= job.totalImages && job.processedFolders >= job.totalFolders) {
      job.status = 'completed';
    }
  }
}

/**
 * Mark job as failed
 */
function markJobFailed(jobId, error) {
  const job = processingJobs.get(jobId);
  if (job) {
    job.status = 'failed';
    job.lastUpdate = new Date();
    job.errors.push({
      error: error,
      timestamp: new Date()
    });
  }
}

/**
 * Get job status
 */
function getJobStatus(jobId) {
  return processingJobs.get(jobId);
}

/**
 * Get all job statuses
 */
function getAllJobStatuses() {
  return Array.from(processingJobs.values());
}

module.exports = {
  createProcessingJob,
  updateFolderProgress,
  updateImageProgress,
  markJobFailed,
  getJobStatus,
  getAllJobStatuses
};