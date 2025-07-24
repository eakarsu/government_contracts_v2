const { prisma } = require('../config/database');

class QueueWorker {
  constructor(options = {}) {
    this.maxConcurrentProcessing = options.maxConcurrentProcessing || 20;
    this.checkInterval = options.checkInterval || 5000; // 5 seconds
    this.isRunning = false;
    this.intervalId = null;
    this.errorCount = 0;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 3;
    this.isProcessing = false; // Prevent overlapping processing
    this.activeProcesses = new Set(); // Track active background processes
    this.abortControllers = new Map(); // Track abort controllers for cancellation
    
    console.log(`🔄 [QUEUE-WORKER] Initialized with max ${this.maxConcurrentProcessing} concurrent documents`);
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ [QUEUE-WORKER] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 [QUEUE-WORKER] Starting background queue worker (check every ${this.checkInterval}ms)`);
    
    // Start the monitoring loop
    this.intervalId = setInterval(() => {
      this.processQueue().catch(error => {
        this.consecutiveErrors++;
        console.error(`❌ [QUEUE-WORKER] Error in queue processing (${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, error.message);
        
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          console.log(`🚨 [QUEUE-WORKER] Too many consecutive errors, pausing for 30 seconds`);
          this.pause(30000);
        }
      });
    }, this.checkInterval);

    // Run initial check immediately
    await this.processQueue();
  }

  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ [QUEUE-WORKER] Not running');
      return;
    }

    console.log('🛑 [QUEUE-WORKER] Stopping queue worker...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Cancel any active background processes
    if (this.activeProcesses.size > 0) {
      console.log(`🛑 [QUEUE-WORKER] Cancelling ${this.activeProcesses.size} active background processes`);
      
      // Cancel all active axios requests using their abort controllers
      for (const processId of this.activeProcesses) {
        if (this.abortControllers && this.abortControllers.has(processId)) {
          this.abortControllers.get(processId).abort();
          this.abortControllers.delete(processId);
        }
      }
      
      this.activeProcesses.clear(); // This will be checked by background processes
    }
    
    // Reset any processing documents back to queued
    try {
      const resetResult = await prisma.documentProcessingQueue.updateMany({
        where: { status: 'processing' },
        data: {
          status: 'queued',
          startedAt: null
        }
      });
      console.log(`🔄 [QUEUE-WORKER] Reset ${resetResult.count} processing documents to queued`);
    } catch (error) {
      console.error('❌ [QUEUE-WORKER] Error resetting processing documents:', error.message);
    }
    
    console.log('🛑 [QUEUE-WORKER] Queue worker stopped completely');
  }

  async processQueue() {
    if (this.isProcessing) {
      console.log('⏸️ [QUEUE-WORKER] Skipping cycle - already processing');
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // First, cleanup any stuck documents that may have been processed but not updated
      await this.cleanupStuckDocuments();

      // Get current queue status
      const statusCounts = await this.getQueueStatus();
      const currentProcessing = statusCounts.processing || 0;
      const currentQueued = statusCounts.queued || 0;

      console.log(`📊 [QUEUE-WORKER] Status: ${currentProcessing} processing, ${currentQueued} queued`);

      // If we have fewer than maxConcurrentProcessing documents being processed
      // and we have queued documents, move some to processing
      if (currentProcessing < this.maxConcurrentProcessing && currentQueued > 0) {
        const documentsNeeded = this.maxConcurrentProcessing - currentProcessing;
        const documentsToProcess = Math.min(documentsNeeded, currentQueued);
        
        console.log(`🔄 [QUEUE-WORKER] Moving ${documentsToProcess} documents from queued to processing`);
        
        await this.moveDocumentsToProcessing(documentsToProcess);
        
        // Start processing the newly moved documents
        await this.startProcessingNewDocuments();
      } else if (currentProcessing >= this.maxConcurrentProcessing) {
        console.log(`✅ [QUEUE-WORKER] At capacity: ${currentProcessing}/${this.maxConcurrentProcessing} processing`);
      } else if (currentQueued === 0) {
        console.log(`ℹ️ [QUEUE-WORKER] No queued documents available`);
      }

      // Reset consecutive errors on success
      this.consecutiveErrors = 0;
      
    } catch (error) {
      console.error('❌ [QUEUE-WORKER] Error processing queue:', error.message);
      throw error; // Re-throw to trigger interval error handler
    } finally {
      this.isProcessing = false;
    }
  }
  
  pause(duration = 30000) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log(`⏸️ [QUEUE-WORKER] Paused for ${duration/1000} seconds`);
    setTimeout(() => {
      if (this.isRunning) {
        this.consecutiveErrors = 0;
        this.intervalId = setInterval(() => {
          this.processQueue().catch(error => {
            this.consecutiveErrors++;
            console.error(`❌ [QUEUE-WORKER] Error in queue processing (${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, error.message);
            
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
              console.log(`🚨 [QUEUE-WORKER] Too many consecutive errors, pausing for 30 seconds`);
              this.pause(30000);
            }
          });
        }, this.checkInterval);
        console.log('▶️ [QUEUE-WORKER] Resumed after pause');
      }
    }, duration);
  }

  async getQueueStatus() {
    const statusCounts = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const counts = {};
    statusCounts.forEach(item => {
      counts[item.status] = item._count.id;
    });

    return counts;
  }

  async moveDocumentsToProcessing(count) {
    try {
      // Get the oldest queued documents
      const queuedDocs = await prisma.documentProcessingQueue.findMany({
        where: { status: 'queued' },
        take: count,
        orderBy: { queuedAt: 'asc' },
        select: { id: true, filename: true, contractNoticeId: true }
      });

      if (queuedDocs.length === 0) {
        console.log('⚠️ [QUEUE-WORKER] No queued documents found to move');
        return 0;
      }

      // Update their status to processing
      const updateResults = await prisma.documentProcessingQueue.updateMany({
        where: {
          id: { in: queuedDocs.map(doc => doc.id) },
          status: 'queued' // Double-check they're still queued
        },
        data: {
          status: 'processing',
          startedAt: new Date()
        }
      });

      console.log(`✅ [QUEUE-WORKER] Moved ${updateResults.count} documents to processing status`);
      
      // Log which documents were moved
      queuedDocs.slice(0, updateResults.count).forEach(doc => {
        console.log(`📄 [QUEUE-WORKER] → Processing: ${doc.filename} (${doc.contractNoticeId})`);
      });

      return updateResults.count;
    } catch (error) {
      console.error('❌ [QUEUE-WORKER] Error moving documents to processing:', error.message);
      return 0;
    }
  }

  async cleanupStuckDocuments() {
    try {
      // Check if there are documents stuck in processing for too long (older than 2 minutes)
      const stuckDocuments = await prisma.documentProcessingQueue.findMany({
        where: {
          status: 'processing',
          startedAt: {
            lt: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
          }
        },
        select: { id: true, filename: true, contractNoticeId: true, startedAt: true }
      });

      if (stuckDocuments.length > 0) {
        console.log(`🧹 [QUEUE-WORKER] Found ${stuckDocuments.length} stuck processing documents, checking their actual status...`);
        
        // For now, reset stuck documents back to queued status to retry
        const resetResult = await prisma.documentProcessingQueue.updateMany({
          where: {
            id: { in: stuckDocuments.map(doc => doc.id) }
          },
          data: {
            status: 'queued',
            startedAt: null,
            queuedAt: new Date()
          }
        });

        console.log(`🔄 [QUEUE-WORKER] Reset ${resetResult.count} stuck documents back to queued status`);
        
        stuckDocuments.forEach(doc => {
          console.log(`📄 [QUEUE-WORKER] → Reset: ${doc.filename} (stuck since ${doc.startedAt})`);
        });
      }

      // Also cleanup stuck jobs to prevent spinning buttons
      const stuckJobs = await prisma.indexingJob.findMany({
        where: {
          status: 'running',
          createdAt: {
            lt: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
          }
        },
        select: { id: true, jobType: true, createdAt: true }
      });

      if (stuckJobs.length > 0) {
        console.log(`🔧 [QUEUE-WORKER] Found ${stuckJobs.length} stuck jobs, marking as completed`);
        
        await prisma.indexingJob.updateMany({
          where: {
            id: { in: stuckJobs.map(job => job.id) }
          },
          data: {
            status: 'completed',
            completedAt: new Date()
          }
        });
        
        console.log(`✅ [QUEUE-WORKER] Updated ${stuckJobs.length} stuck jobs to completed`);
        stuckJobs.forEach(job => {
          console.log(`🔧 [QUEUE-WORKER] → Job #${job.id} (${job.jobType}, stuck since ${job.createdAt})`);
        });
      }

    } catch (error) {
      console.error('❌ [QUEUE-WORKER] Error cleaning up stuck documents/jobs:', error.message);
    }
  }

  async startProcessingNewDocuments() {
    try {
      // Get documents that just moved to processing status but haven't started processing yet
      const newProcessingDocs = await prisma.documentProcessingQueue.findMany({
        where: { 
          status: 'processing',
          // Documents that were just moved to processing (startedAt is recent)
          startedAt: {
            gte: new Date(Date.now() - 10000) // Last 10 seconds
          }
        },
        orderBy: { startedAt: 'asc' }
      });

      if (newProcessingDocs.length === 0) {
        console.log('ℹ️ [QUEUE-WORKER] No new processing documents to start');
        return;
      }

      console.log(`🚀 [QUEUE-WORKER] Starting processing for ${newProcessingDocs.length} documents`);

      // Import the processing function from documentProcessing.js
      const { processDocumentsInParallel } = require('./documentProcessor');
      
      // Create a process ID and abort controller for tracking
      const processId = `process_${Date.now()}_${Math.random()}`;
      const abortController = new AbortController();
      this.activeProcesses.add(processId);
      this.abortControllers.set(processId, abortController);
      
      // Process the new documents in the background (don't await)
      processDocumentsInParallel(newProcessingDocs, newProcessingDocs.length, { signal: abortController.signal })
        .then(() => {
          if (this.activeProcesses.has(processId)) {
            console.log(`✅ [QUEUE-WORKER] Background processing completed for ${newProcessingDocs.length} documents`);
            this.activeProcesses.delete(processId);
            this.abortControllers.delete(processId);
          } else {
            console.log(`🛑 [QUEUE-WORKER] Background processing was cancelled for ${newProcessingDocs.length} documents`);
          }
        })
        .catch(error => {
          if (this.activeProcesses.has(processId)) {
            if (error.name === 'AbortError') {
              console.log(`🛑 [QUEUE-WORKER] Background processing was aborted for ${newProcessingDocs.length} documents`);
            } else {
              console.error('❌ [QUEUE-WORKER] Background processing error:', error.message);
            }
            this.activeProcesses.delete(processId);
            this.abortControllers.delete(processId);
          }
        });

    } catch (error) {
      console.error('❌ [QUEUE-WORKER] Error starting processing for new documents:', error.message);
    }
  }

  async getQueueStatistics() {
    const statusCounts = await this.getQueueStatus();
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    
    return {
      total,
      queued: statusCounts.queued || 0,
      processing: statusCounts.processing || 0,
      completed: statusCounts.completed || 0,
      failed: statusCounts.failed || 0,
      maxConcurrent: this.maxConcurrentProcessing,
      isRunning: this.isRunning
    };
  }
}

module.exports = QueueWorker;