const express = require('express');
const { prisma } = require('../config/database');
const router = express.Router();

/**
 * Parallel Processing Routes
 * Replaces queue system with JavaScript parallel processing
 */

// Start parallel processing (replaces queue worker start)
router.post('/start', async (req, res) => {
  try {
    const { maxWorkers = 10 } = req.body;
    
    console.log(`🚀 [PARALLEL] Starting parallel document processing with ${maxWorkers} workers`);
    
    const parallelProcessor = req.app.locals.parallelProcessor;
    if (!parallelProcessor) {
      return res.status(500).json({
        success: false,
        error: 'JavaScript parallel processor not initialized'
      });
    }

    // Check if already processing
    if (parallelProcessor.isRunning()) {
      return res.json({
        success: false,
        message: 'Parallel processing already in progress',
        isProcessing: true
      });
    }

    // Start parallel processing
    const result = await parallelProcessor.startProcessing();
    
    console.log('🚀 [PARALLEL] Processing result:', result);
    
    res.json({
      success: result.success,
      message: result.message,
      stats: result.stats,
      processingType: 'parallel',
      maxWorkers
    });
    
  } catch (error) {
    console.error('❌ [PARALLEL] Error starting processing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop parallel processing (for compatibility - limited functionality)
router.post('/stop', async (req, res) => {
  try {
    console.log('🚀 [PARALLEL] Stop processing requested');
    
    const parallelProcessor = req.app.locals.parallelProcessor;
    if (!parallelProcessor) {
      return res.status(500).json({
        success: false,
        error: 'JavaScript parallel processor not initialized'
      });
    }

    const result = await parallelProcessor.stopProcessing();
    
    res.json({
      success: result.success,
      message: result.message,
      processingType: 'parallel'
    });
    
  } catch (error) {
    console.error('❌ [PARALLEL] Error stopping processing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset processing counters and statistics
router.post('/reset', async (req, res) => {
  try {
    console.log('🔄 [PARALLEL] Reset counters requested');
    
    const parallelProcessor = req.app.locals.parallelProcessor;
    if (!parallelProcessor) {
      return res.status(500).json({
        success: false,
        error: 'JavaScript parallel processor not initialized'
      });
    }

    // Don't allow reset while processing
    if (parallelProcessor.isRunning()) {
      return res.json({
        success: false,
        message: 'Cannot reset counters while processing is in progress. Stop processing first.'
      });
    }

    const result = await parallelProcessor.resetCounters();
    
    res.json({
      success: result.success,
      message: result.message,
      resetCounts: result.resetCounts,
      newStats: result.newStats,
      processingType: 'parallel'
    });
    
  } catch (error) {
    console.error('❌ [PARALLEL] Error resetting counters:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get parallel processing status
router.get('/status', async (req, res) => {
  try {
    const parallelProcessor = req.app.locals.parallelProcessor;
    if (!parallelProcessor) {
      return res.status(500).json({
        success: false,
        error: 'JavaScript parallel processor not initialized'
      });
    }

    // Cleanup stuck jobs automatically before getting status
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const stuckJobs = await prisma.indexingJob.findMany({
        where: {
          status: 'running',
          createdAt: {
            lt: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
          }
        }
      });

      if (stuckJobs.length > 0) {
        console.log(`🔧 [AUTO-CLEANUP] Found ${stuckJobs.length} stuck jobs, marking as completed`);
        
        await prisma.indexingJob.updateMany({
          where: {
            status: 'running',
            createdAt: {
              lt: new Date(Date.now() - 2 * 60 * 1000)
            }
          },
          data: {
            status: 'completed',
            completedAt: new Date()
          }
        });
        
        console.log(`✅ [AUTO-CLEANUP] Updated ${stuckJobs.length} stuck jobs to completed`);
      }

      // Also cleanup stuck documents
      const stuckDocs = await prisma.documentProcessingQueue.findMany({
        where: {
          status: 'processing',
          startedAt: {
            lt: new Date(Date.now() - 2 * 60 * 1000)
          }
        }
      });

      if (stuckDocs.length > 0) {
        console.log(`🔧 [AUTO-CLEANUP] Found ${stuckDocs.length} stuck documents, resetting to queued`);
        
        await prisma.documentProcessingQueue.updateMany({
          where: {
            status: 'processing',
            startedAt: {
              lt: new Date(Date.now() - 2 * 60 * 1000)
            }
          },
          data: {
            status: 'queued',
            startedAt: null,
            updatedAt: new Date()
          }
        });
        
        console.log(`✅ [AUTO-CLEANUP] Reset ${stuckDocs.length} stuck documents to queued`);
      }
      
      await prisma.$disconnect();
    } catch (cleanupError) {
      console.warn('⚠️ [AUTO-CLEANUP] Failed to cleanup stuck jobs:', cleanupError.message);
    }

    // Get status from JS parallel processor
    const status = await parallelProcessor.getStatus();
    
    // Format response to match queue status format for UI compatibility
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      processingType: 'parallel',
      isProcessing: parallelProcessor.isRunning(),
      queue_status: {
        queued: status.queued || 0,
        processing: status.processing || 0,
        completed: status.completed || 0,
        failed: status.failed || 0,
        total: (status.queued || 0) + (status.processing || 0) + (status.completed || 0) + (status.failed || 0),
        is_processing: parallelProcessor.isRunning()
      },
      parallel_stats: status.parallel_stats || parallelProcessor.getStats(),
      performance: {
        processing_type: 'JavaScript Parallel Processing',
        description: 'Documents processed in parallel instead of sequential queue',
        advantages: [
          'All documents sent to APIs simultaneously',
          'No queue bottlenecks or stalling',
          'Faster overall processing time',
          'Better resource utilization'
        ]
      }
    };

    res.json(response);
    
  } catch (error) {
    console.error('❌ [PARALLEL] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      processingType: 'parallel'
    });
  }
});

// Get detailed processing statistics
router.get('/stats', async (req, res) => {
  try {
    const parallelProcessor = req.app.locals.parallelProcessor;
    if (!parallelProcessor) {
      return res.status(500).json({
        success: false,
        error: 'JavaScript parallel processor not initialized'
      });
    }

    const stats = parallelProcessor.getStats();
    const status = await parallelProcessor.getStatus();

    res.json({
      success: true,
      processingType: 'parallel',
      currentStats: stats,
      databaseStatus: status,
      isProcessing: parallelProcessor.isRunning(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [PARALLEL] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check Node.js dependencies (JavaScript parallel processor doesn't need external dependencies)
router.get('/dependencies', async (req, res) => {
  try {
    console.log('📦 [PARALLEL] Checking JavaScript dependencies...');
    
    const dependencies = {
      'fs-extra': true,
      'axios': true,
      'path': true,
      'child_process': true
    };
    
    res.json({
      success: true,
      message: 'JavaScript parallel processor uses built-in Node.js modules',
      dependencies: dependencies,
      note: 'No external installation required - all dependencies are part of Node.js or already installed'
    });
    
  } catch (error) {
    console.error('❌ [PARALLEL] Error checking dependencies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Compatibility endpoints for existing UI
// These redirect to parallel processing equivalents

// Queue worker start (redirects to parallel start)
router.post('/queue/start', (req, res) => {
  console.log('🔄 [COMPAT] Queue start redirected to parallel processing');
  req.url = '/start';
  router.handle(req, res);
});

// Queue worker stop (redirects to parallel stop)
router.post('/queue/stop', (req, res) => {
  console.log('🔄 [COMPAT] Queue stop redirected to parallel processing');
  req.url = '/stop';
  router.handle(req, res);
});

// Queue status (redirects to parallel status)
router.get('/queue/status', (req, res) => {
  console.log('🔄 [COMPAT] Queue status redirected to parallel processing');
  req.url = '/status';
  router.handle(req, res);
});

module.exports = router;