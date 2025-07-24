const express = require('express');
const { prisma } = require('../config/database');
const { processTestDocumentsSequentially } = require('../services/testModeProcessor');
const { processRegularMode } = require('../services/regularModeProcessor');
const { processDocumentsInParallel } = require('../services/parallelDocumentProcessor');

const router = express.Router();

// Process documents using queue system workflow
router.post('/', async (req, res) => {
  console.log('🔄 [DEBUG] Process documents endpoint called');
  console.log('🔄 [DEBUG] Request body:', req.body);
  
  try {
    const { contract_id, limit = 50, auto_queue = true, concurrency = 5, test_mode = false } = req.body;
    console.log('🔄 [DEBUG] Parsed parameters:', { contract_id, limit, auto_queue, concurrency, test_mode });

    // If limit is small (≤ 5), automatically enable test mode for cost-effectiveness
    const shouldUseTestMode = test_mode || limit <= 5;
    
    if (shouldUseTestMode) {
      console.log('🧪 [DEBUG] Using TEST MODE for cost-effective processing (limit ≤ 5 or test_mode enabled)');
      
      // Clear existing queue if in test mode
      const deletedCount = await prisma.documentProcessingQueue.deleteMany({});
      console.log(`🗑️ [DEBUG] Cleared ${deletedCount.count} existing queue entries for test mode`);

      // Get queued test documents
      const testDocuments = await prisma.documentProcessingQueue.findMany({
        where: { 
          status: 'queued',
          filename: { startsWith: 'TEST_' }
        },
        orderBy: { queuedAt: 'asc' }
      });

      // Create processing job for tracking
      const job = await prisma.indexingJob.create({
        data: {
          jobType: 'parallel_processing',
          status: 'running',
          startDate: new Date()
        }
      });

      console.log(`✅ [DEBUG] Created TEST processing job: ${job.id}`);

      // Respond immediately with job info
      res.json({
        success: true,
        message: `🧪 TEST MODE: Started processing ${testDocuments.length} test documents (cost-effective mode)`,
        job_id: job.id,
        documents_count: testDocuments.length,
        test_mode: true,
        cost_impact: 'MINIMAL',
        processing_method: 'test_mode_sequential'
      });

      // Process test documents using extracted module
      processTestDocumentsSequentially(testDocuments, job.id);

      return; // Exit early for test mode
    }

    // REGULAR PROCESSING MODE (for larger limits)
    const result = await processRegularMode(contract_id, limit, auto_queue);

    if (!result.success) {
      return res.json(result);
    }

    // Start the parallel processor to automatically process documents
    console.log('🚀 [DEBUG] Starting parallel processor for automatic processing...');
    const parallelProcessor = req.app.locals.parallelProcessor || req.app.locals.queueWorker;
    if (parallelProcessor) {
      // Don't await this - let it run in background
      parallelProcessor.startProcessing().then(result => {
        console.log('✅ [DEBUG] Parallel processor completed:', result);
      }).catch(error => {
        console.error('❌ [DEBUG] Parallel processor error:', error.message);
      });
      console.log('✅ [DEBUG] Parallel processor started - will process all documents in parallel');
    } else {
      console.log('⚠️ [DEBUG] Parallel processor not found in app context');
    }

    // Respond immediately 
    res.json({
      success: result.success,
      message: result.message,
      job_id: result.job_id,
      documents_count: result.documents_count,
      concurrency: result.concurrency,
      processing_method: 'queue_worker_managed',
      queue_worker_status: 'started'
    });

  } catch (error) {
    console.error('❌ [DEBUG] Document processing failed:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

console.log('🔄 [DEBUG] Document processing router module loaded successfully');
module.exports = router;
