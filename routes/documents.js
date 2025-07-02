const express = require('express');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');
const { sendToNorshinAPI, processTextWithAI } = require('../services/norshinService');
const config = require('../config/env');

const router = express.Router();

// Process documents using queue system workflow
router.post('/process', async (req, res) => {
  console.log('🔄 [DEBUG] Process documents endpoint called');
  console.log('🔄 [DEBUG] Request body:', req.body);
  
  try {
    const { contract_id, limit = 50, auto_queue = true, concurrency = 5 } = req.body;
    console.log('🔄 [DEBUG] Parsed parameters:', { contract_id, limit, auto_queue, concurrency });

    // Step 1: Check if there are documents in queue or if we need to populate it
    const queueStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    queueStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    const queuedCount = statusCounts.queued || 0;
    const totalInQueue = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    console.log(`📊 [DEBUG] Current queue status: ${queuedCount} queued, ${totalInQueue} total`);

    // Step 2: If no documents in queue and auto_queue is enabled, populate the queue first
    if (queuedCount === 0 && auto_queue) {
      console.log('🔄 [DEBUG] No documents in queue, auto-populating from contracts...');
      
      // Get contracts with resourceLinks
      const contractsWithDocs = await prisma.contract.count({
        where: { resourceLinks: { not: null } }
      });
      console.log(`📄 [DEBUG] Found ${contractsWithDocs} contracts with document links`);

      if (contractsWithDocs === 0) {
        return res.json({
          success: false,
          message: 'No contracts with document links found. Please fetch contracts first.',
          processed_count: 0
        });
      }

      // Populate queue with documents
      const contracts = await prisma.contract.findMany({
        where: { 
          resourceLinks: { not: null },
          ...(contract_id ? { noticeId: contract_id } : {})
        },
        take: limit,
        select: {
          noticeId: true,
          title: true,
          resourceLinks: true,
          agency: true
        }
      });

      let queuedDocuments = 0;
      for (const contract of contracts) {
        const resourceLinks = contract.resourceLinks;
        if (!resourceLinks || !Array.isArray(resourceLinks)) continue;

        for (let i = 0; i < resourceLinks.length; i++) {
          const docUrl = resourceLinks[i];
          
          try {
            const urlParts = docUrl.split('/');
            const originalFilename = urlParts[urlParts.length - 1] || `document_${i + 1}`;
            // Note: filename will be updated with correct extension during processing
            const filename = `${contract.noticeId}_${originalFilename}`;

            // Check if already queued
            const existing = await prisma.documentProcessingQueue.findFirst({
              where: {
                contractNoticeId: contract.noticeId,
                documentUrl: docUrl
              }
            });

            if (existing) {
              console.log(`⚠️ [DEBUG] Document already queued: ${filename}`);
              continue;
            }

            // Add to queue (filename will be corrected during processing)
            await prisma.documentProcessingQueue.create({
              data: {
                contractNoticeId: contract.noticeId,
                documentUrl: docUrl,
                description: `${contract.title || 'Untitled'} - ${contract.agency || 'Unknown Agency'}`,
                filename: filename,
                status: 'queued'
              }
            });

            queuedDocuments++;
            console.log(`✅ [DEBUG] Queued document: ${filename}`);

          } catch (error) {
            console.error(`❌ [DEBUG] Error queueing document ${docUrl}:`, error.message);
          }
        }
      }

      console.log(`📊 [DEBUG] Queued ${queuedDocuments} documents for processing`);
    }

    // Step 3: Process the queue using parallel processing
    console.log('🔄 [DEBUG] Starting queue processing...');

    // Get queued documents
    const queuedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'queued' },
      take: limit,
      orderBy: { queuedAt: 'asc' }
    });

    if (queuedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No documents in queue to process',
        processed_count: 0,
        queue_status: statusCounts
      });
    }

    console.log(`🔄 [DEBUG] Found ${queuedDocs.length} documents to process`);

    // Create processing job
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'queue_processing',
        status: 'running',
        startDate: new Date()
      }
    });

    console.log(`✅ [DEBUG] Created processing job: ${job.id}`);

    // Use higher concurrency for auto-queue processing
    const autoConcurrency = Math.min(20, Math.max(10, Math.floor(queuedDocs.length / 10)));

    // Respond immediately and start background processing
    res.json({
      success: true,
      message: `Started processing ${queuedDocs.length} documents from queue with ${autoConcurrency} workers`,
      job_id: job.id,
      documents_count: queuedDocs.length,
      concurrency: autoConcurrency,
      processing_method: 'auto_queue_parallel'
    });

    // Process documents in background with higher concurrency
    processDocumentsInParallel(queuedDocs, autoConcurrency, job.id);

  } catch (error) {
    console.error('❌ [DEBUG] Document processing failed:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Download and index new documents from government sources
router.post('/download', async (req, res) => {
  try {
    const { contract_id, limit = 50 } = req.body;

    // Get contracts with valid resource links
    let whereClause = { resourceLinks: { not: null } };
    if (contract_id) {
      whereClause.noticeId = contract_id;
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      take: limit
    });

    if (contracts.length === 0) {
      return res.json({ message: 'No contracts with documents found', downloaded_count: 0 });
    }

    // Create indexing job
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'document_download',
        status: 'running'
      }
    });

    let downloadedCount = 0;
    let errorsCount = 0;
    let skippedCount = 0;

    for (const contract of contracts) {
      try {
        const resourceLinks = contract.resourceLinks;
        if (!resourceLinks || !Array.isArray(resourceLinks)) continue;

        // Process up to 3 documents per contract
        for (const docUrl of resourceLinks.slice(0, 3)) {
          try {
            const documentId = `${contract.noticeId}_${docUrl.split('/').pop()}`;
            
            // Check if document is already indexed in vector database
            const existingDocs = await vectorService.searchDocuments(documentId, 1);
            
            if (existingDocs.length > 0 && existingDocs[0].metadata.id === documentId) {
              console.log(`Document already indexed, skipping: ${documentId}`);
              skippedCount++;
              continue;
            }

            // Document not found in vector DB, download and process it
            console.log(`📥 [DEBUG] Downloading document from government: ${docUrl}`);
            try {
              const result = await sendToNorshinAPI(docUrl, `doc_${contract.noticeId}`, '', 'openai/gpt-4.1');
              
              if (result) {
                // Index the processed document in vector database
                await vectorService.indexDocument({
                  filename: `doc_${contract.noticeId}`,
                  content: result.content || result.text || JSON.stringify(result),
                  processedData: result
                }, contract.noticeId);
                
                downloadedCount++;
                console.log(`✅ [DEBUG] Downloaded and indexed document for contract: ${contract.noticeId}`);
              } else {
                errorsCount++;
              }
            } catch (docError) {
              if (docError.message.includes('ZIP files are not supported') || 
                  docError.message.includes('Unsupported document type')) {
                console.log(`⚠️ [DEBUG] Skipped unsupported document: ${docError.message}`);
                // Don't count as error, just skip
              } else {
                console.error(`❌ [DEBUG] Error downloading document: ${docError.message}`);
                errorsCount++;
              }
            }
          } catch (error) {
            console.error(`Error downloading document ${docUrl}:`, error);
            errorsCount++;
          }
        }
      } catch (error) {
        console.error(`Error downloading documents for contract ${contract.noticeId}:`, error);
        errorsCount++;
      }
    }

    // Update job status
    await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        recordsProcessed: downloadedCount,
        errorsCount,
        completedAt: new Date()
      }
    });

    res.json({
      success: true,
      job_id: job.id,
      downloaded_count: downloadedCount,
      errors_count: errorsCount,
      skipped_count: skippedCount,
      message: `Downloaded ${downloadedCount} new documents, skipped ${skippedCount} already indexed documents`
    });

  } catch (error) {
    console.error('Document download failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Queue documents for processing from all indexed contracts using parallel processing
router.post('/queue', async (req, res) => {
  try {
    const { limit = 1000, clear_existing = true, concurrency = 10 } = req.body;
    
    console.log('🔄 [DEBUG] Starting parallel document queue population...');
    console.log(`🔄 [DEBUG] Parameters: limit=${limit}, clear_existing=${clear_existing}, concurrency=${concurrency}`);

    // Clear existing queue if requested
    if (clear_existing) {
      const deletedCount = await prisma.documentProcessingQueue.deleteMany({});
      console.log(`🗑️ [DEBUG] Cleared ${deletedCount.count} existing queue entries`);
    }

    // Get ALL contracts with resourceLinks from database (no limit for scanning)
    const contracts = await prisma.contract.findMany({
      where: { 
        resourceLinks: { not: null }
      },
      select: {
        noticeId: true,
        title: true,
        resourceLinks: true,
        agency: true
      }
    });

    console.log(`📄 [DEBUG] Found ${contracts.length} contracts with resourceLinks to scan`);

    if (contracts.length === 0) {
      return res.json({
        success: true,
        message: 'No contracts with documents found to queue',
        queued_count: 0,
        contracts_checked: 0
      });
    }

    // Process contracts in parallel batches using Promise.all
    let queuedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let processedContracts = 0;

    // Process contracts in parallel batches
    const batchSize = Math.ceil(contracts.length / concurrency);
    const batches = [];
    
    for (let i = 0; i < contracts.length; i += batchSize) {
      batches.push(contracts.slice(i, i + batchSize));
    }

    console.log(`🔄 [DEBUG] Processing ${contracts.length} contracts in ${batches.length} parallel batches`);

    // Process each batch in parallel
    const processPromises = batches.map(async (batch, batchIndex) => {
      let batchQueued = 0;
      let batchSkipped = 0;
      let batchErrors = 0;

      for (const contract of batch) {
        try {
          const resourceLinks = contract.resourceLinks;
          
          if (!resourceLinks || !Array.isArray(resourceLinks) || resourceLinks.length === 0) {
            batchSkipped++;
            continue;
          }

          // Process each document URL in resourceLinks array
          console.log(`📄 [DEBUG] Contract ${contract.noticeId} has ${resourceLinks.length} documents in resourceLinks`);
          
          for (let i = 0; i < resourceLinks.length; i++) {
            const docUrl = resourceLinks[i];
            
            try {
              // Generate unique filename (will be updated with correct extension after analysis)
              const urlParts = docUrl.split('/');
              const originalFilename = urlParts[urlParts.length - 1] || `document_${i + 1}`;
              const filename = `${contract.noticeId}_${originalFilename}`;

              console.log(`📄 [DEBUG] Queueing document ${i + 1}/${resourceLinks.length}: ${docUrl}`);

              // Check if already queued
              const existing = await prisma.documentProcessingQueue.findFirst({
                where: {
                  contractNoticeId: contract.noticeId,
                  documentUrl: docUrl
                }
              });

              if (existing) {
                console.log(`⚠️ [DEBUG] Document already queued: ${filename}`);
                batchSkipped++;
                continue;
              }

              // Create queue entry for individual document (NOT the contract)
              await prisma.documentProcessingQueue.create({
                data: {
                  contractNoticeId: contract.noticeId,
                  documentUrl: docUrl, // This is the actual document URL from resourceLinks
                  description: `Document from: ${contract.title || 'Untitled'} - ${contract.agency || 'Unknown Agency'}`,
                  filename: filename, // Will be updated with correct extension during processing
                  status: 'queued'
                }
              });

              batchQueued++;
              console.log(`✅ [DEBUG] Queued individual document: ${filename} from contract ${contract.noticeId}`);

            } catch (docError) {
              console.error(`❌ [DEBUG] Error queueing document ${docUrl}:`, docError.message);
              batchErrors++;
            }
          }

          processedContracts++;
          
          // Log progress every 10 contracts
          if (processedContracts % 10 === 0) {
            console.log(`📊 [DEBUG] Progress: ${processedContracts}/${contracts.length} contracts processed`);
          }

        } catch (contractError) {
          console.error(`❌ [DEBUG] Error processing contract ${contract.noticeId}:`, contractError.message);
          batchErrors++;
        }
      }

      return { queued: batchQueued, skipped: batchSkipped, errors: batchErrors };
    });

    // Wait for all batches to complete
    const results = await Promise.allSettled(processPromises);
    
    // Aggregate results
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        queuedCount += result.value.queued;
        skippedCount += result.value.skipped;
        errorCount += result.value.errors;
      }
    });

    // Get final queue status
    const queueStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    queueStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    const totalInQueue = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    console.log(`📊 [DEBUG] Parallel queue population completed:`);
    console.log(`📊 [DEBUG] - Queued: ${queuedCount} new INDIVIDUAL DOCUMENTS (not contracts)`);
    console.log(`📊 [DEBUG] - Skipped: ${skippedCount} documents`);
    console.log(`📊 [DEBUG] - Errors: ${errorCount} documents`);
    console.log(`📊 [DEBUG] - Total in queue: ${totalInQueue} individual document URLs`);
    console.log(`📊 [DEBUG] - Contracts processed: ${processedContracts}/${contracts.length}`);
    console.log(`📊 [DEBUG] - Average documents per contract: ${(queuedCount / processedContracts).toFixed(1)}`);

    res.json({
      success: true,
      message: `Successfully queued ${queuedCount} individual documents from ${processedContracts} contracts using parallel processing`,
      queued_count: queuedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      contracts_processed: processedContracts,
      total_contracts: contracts.length,
      processing_method: 'promise_based_parallel',
      queue_status: {
        queued: statusCounts.queued || 0,
        processing: statusCounts.processing || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        total: totalInQueue,
        is_processing: (statusCounts.processing || 0) > 0
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error in parallel queueing:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get detailed queue status with real-time counters
router.get('/queue/status', async (req, res) => {
  try {
    // console.log('📊 [DEBUG] Getting queue status...');

    // Get status counts
    const queueStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    queueStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    // Get recent completed documents
    const recentCompleted = await prisma.documentProcessingQueue.findMany({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: {
        filename: true,
        completedAt: true,
        contractNoticeId: true,
        processedData: true
      }
    });

    // Get recent failed documents
    const recentFailed = await prisma.documentProcessingQueue.findMany({
      where: { status: 'failed' },
      orderBy: { failedAt: 'desc' },
      take: 5,
      select: {
        filename: true,
        failedAt: true,
        contractNoticeId: true,
        errorMessage: true
      }
    });

    // Get currently processing documents
    const currentlyProcessing = await prisma.documentProcessingQueue.findMany({
      where: { status: 'processing' },
      orderBy: { startedAt: 'asc' },
      select: {
        filename: true,
        startedAt: true,
        contractNoticeId: true
      }
    });

    // Get active processing jobs
    const activeJobs = await prisma.indexingJob.findMany({
      where: { 
        jobType: 'queue_processing',
        status: 'running'
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Calculate processing statistics
    const totalDocuments = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const completedCount = statusCounts.completed || 0;
    const failedCount = statusCounts.failed || 0;
    const processingCount = statusCounts.processing || 0;
    const queuedCount = statusCounts.queued || 0;
    
    const completionRate = totalDocuments > 0 ? Math.round((completedCount / totalDocuments) * 100) : 0;
    const failureRate = totalDocuments > 0 ? Math.round((failedCount / totalDocuments) * 100) : 0;

    // Get processing speed (documents per minute in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCompletions = await prisma.documentProcessingQueue.count({
      where: {
        status: 'completed',
        completedAt: { gte: oneHourAgo }
      }
    });

    const processingSpeed = Math.round(recentCompletions); // per hour

    // console.log(`📊 [DEBUG] Queue status: ${queuedCount} queued, ${processingCount} processing, ${completedCount} completed, ${failedCount} failed`);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      queue_status: {
        // Main counters
        queued: queuedCount,
        processing: processingCount,
        completed: completedCount,
        failed: failedCount,
        total: totalDocuments,
        
        // Processing state
        is_processing: processingCount > 0 || activeJobs.length > 0,
        active_jobs: activeJobs.length,
        
        // Statistics
        completion_rate: completionRate,
        failure_rate: failureRate,
        processing_speed_per_hour: processingSpeed,
        
        // Recent activity
        recent_completed: recentCompleted.map(doc => ({
          filename: doc.filename,
          completed_at: doc.completedAt?.toISOString(),
          contract_notice_id: doc.contractNoticeId,
          has_result: !!doc.processedData
        })),
        
        recent_failed: recentFailed.map(doc => ({
          filename: doc.filename,
          failed_at: doc.failedAt?.toISOString(),
          contract_notice_id: doc.contractNoticeId,
          error: doc.errorMessage
        })),
        
        currently_processing: currentlyProcessing.map(doc => ({
          filename: doc.filename,
          started_at: doc.startedAt?.toISOString(),
          contract_notice_id: doc.contractNoticeId,
          duration_minutes: doc.startedAt ? Math.round((Date.now() - doc.startedAt.getTime()) / 60000) : 0
        })),
        
        active_processing_jobs: activeJobs.map(job => ({
          id: job.id,
          started_at: job.createdAt.toISOString(),
          duration_minutes: Math.round((Date.now() - job.createdAt.getTime()) / 60000)
        }))
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error getting queue status:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Process queued documents with parallel processing and real-time updates
router.post('/queue/process', async (req, res) => {
  try {
    const { concurrency = 15, batch_size = 100 } = req.body; // Increased defaults
    
    console.log('🔄 [DEBUG] Starting parallel document processing...');
    console.log(`🔄 [DEBUG] Concurrency: ${concurrency}, Batch size: ${batch_size}`);

    // Check if there's already a running job
    const existingJob = await prisma.indexingJob.findFirst({
      where: { 
        status: 'running',
        jobType: { in: ['queue_processing', 'document_processing'] }
      }
    });

    if (existingJob) {
      return res.json({
        success: false,
        message: `Queue processing is already running (Job #${existingJob.id}). Please wait for it to complete or stop it first.`,
        existing_job_id: existingJob.id,
        started_at: existingJob.createdAt
      });
    }

    // Get queued documents
    const queuedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'queued' },
      take: batch_size,
      orderBy: { queuedAt: 'asc' }
    });

    if (queuedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No documents currently queued for processing',
        queued_count: 0
      });
    }

    console.log(`🔄 [DEBUG] Found ${queuedDocs.length} documents to process`);

    // Create processing job for tracking
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'queue_processing',
        status: 'running',
        startDate: new Date()
      }
    });

    console.log(`✅ [DEBUG] Created processing job: ${job.id}`);

    // Respond immediately with job info
    res.json({
      success: true,
      message: `Started processing ${queuedDocs.length} documents with ${concurrency} parallel workers`,
      job_id: job.id,
      documents_count: queuedDocs.length,
      concurrency: concurrency,
      processing_method: 'true_parallel_workers'
    });

    // Process documents in parallel (don't await - run in background)
    processDocumentsInParallel(queuedDocs, concurrency, job.id);

  } catch (error) {
    console.error('❌ [DEBUG] Error starting document processing:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Helper function to process documents in parallel with true concurrency
async function processDocumentsInParallel(documents, concurrency, jobId) {
  console.log(`🔄 [DEBUG] Processing ${documents.length} documents with concurrency ${concurrency}`);
  
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Create a semaphore to limit concurrency
  const semaphore = new Array(concurrency).fill(null);
  let documentIndex = 0;

  // Process single document
  const processDocument = async (doc) => {
    try {
      console.log(`🔄 [DEBUG] Starting processing: ${doc.filename}`);
      
      // Update status to processing immediately
      await prisma.documentProcessingQueue.update({
        where: { id: doc.id },
        data: { 
          status: 'processing',
          startedAt: new Date()
        }
      });

      const documentId = `${doc.contractNoticeId}_${doc.filename}`;
      
      // Check if document is already indexed in vector database
      const existingDocs = await vectorService.searchDocuments(documentId, 1);
      
      if (existingDocs.length > 0 && existingDocs[0].metadata.id === documentId) {
        console.log(`📄 [DEBUG] Document already indexed, using cached: ${documentId}`);
        
        // Update status to completed with cached data
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'completed',
            processedData: JSON.stringify({ 
              cached: true, 
              content: existingDocs[0].document,
              source: 'vector_database'
            }),
            completedAt: new Date()
          }
        });

        skippedCount++;
        return { success: true, filename: doc.filename, cached: true };
      }

      // Process document via Norshin API
      console.log(`📥 [DEBUG] Sending to Norshin API: ${doc.documentUrl}`);
      const result = await sendToNorshinAPI(
        doc.documentUrl,
        doc.filename || 'document',
        '',
        'openai/gpt-4.1'
      );

      if (result) {
        // The filename might have been updated with correct extension in sendToNorshinAPI
        const finalFilename = result.correctedFilename || doc.filename;
        
        // Update the queue entry with the corrected filename if it changed
        if (finalFilename !== doc.filename) {
          console.log(`📄 [DEBUG] Updating filename from ${doc.filename} to ${finalFilename}`);
          await prisma.documentProcessingQueue.update({
            where: { id: doc.id },
            data: { filename: finalFilename }
          });
        }

        // Index the processed document in vector database
        await vectorService.indexDocument({
          filename: finalFilename,
          content: result.content || result.text || JSON.stringify(result),
          processedData: result
        }, doc.contractNoticeId);

        // Update status to completed
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'completed',
            processedData: JSON.stringify(result),
            completedAt: new Date()
          }
        });

        successCount++;
        console.log(`✅ [DEBUG] Successfully processed: ${finalFilename}`);
        return { success: true, filename: finalFilename, cached: false };
      } else {
        throw new Error('No result from Norshin API');
      }

    } catch (error) {
      console.error(`❌ [DEBUG] Error processing ${doc.filename}:`, error.message);
      
      // Update status to failed
      await prisma.documentProcessingQueue.update({
        where: { id: doc.id },
        data: {
          status: 'failed',
          errorMessage: error.message,
          failedAt: new Date()
        }
      });

      errorCount++;
      return { success: false, filename: doc.filename, error: error.message };
    } finally {
      processedCount++;
      
      // Log progress every 10 documents
      if (processedCount % 10 === 0 || processedCount === documents.length) {
        console.log(`📊 [DEBUG] Progress: ${processedCount}/${documents.length} (${Math.round(processedCount/documents.length*100)}%) - Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);
      }
    }
  };

  // Worker function that processes documents from the queue
  const worker = async () => {
    while (documentIndex < documents.length) {
      const currentIndex = documentIndex++;
      if (currentIndex < documents.length) {
        await processDocument(documents[currentIndex]);
      }
    }
  };

  // Start all workers in parallel
  console.log(`🚀 [DEBUG] Starting ${concurrency} parallel workers...`);
  const workers = Array(concurrency).fill(null).map(() => worker());
  
  // Wait for all workers to complete
  await Promise.allSettled(workers);

  // Update job status
  try {
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        recordsProcessed: successCount,
        errorsCount: errorCount,
        completedAt: new Date()
      }
    });

    console.log(`🎉 [DEBUG] Parallel processing completed!`);
    console.log(`📊 [DEBUG] Final stats: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`);
  } catch (updateError) {
    console.error('❌ [DEBUG] Error updating job status:', updateError);
  }
}

// Search documents in vector database
router.post('/search', async (req, res) => {
  try {
    const { query, limit = 10, contract_id } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Search documents in vector database
    const vectorResults = await vectorService.searchDocuments(query, limit);

    // Filter by contract_id if provided
    let filteredResults = vectorResults;
    if (contract_id) {
      filteredResults = vectorResults.filter(result => 
        result.metadata.contractId === contract_id
      );
    }

    res.json({
      success: true,
      query,
      results: {
        documents: filteredResults.map(result => ({
          id: result.metadata.id,
          contract_id: result.metadata.contractId,
          filename: result.metadata.filename,
          processed_at: result.metadata.processedAt,
          relevance_score: result.score,
          content_preview: result.document.substring(0, 500) + '...'
        })),
        total_results: filteredResults.length,
        source: 'vector_database'
      },
      response_time: Date.now()
    });

  } catch (error) {
    console.error('Document search failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear queue (remove completed/failed documents)
router.post('/queue/clear', async (req, res) => {
  try {
    const { clear_completed = true, clear_failed = true, clear_all = false } = req.body;
    
    console.log('🗑️ [DEBUG] Clearing queue...');
    
    let deletedCount = 0;
    
    if (clear_all) {
      const result = await prisma.documentProcessingQueue.deleteMany({});
      deletedCount = result.count;
      console.log(`🗑️ [DEBUG] Cleared all ${deletedCount} queue entries`);
    } else {
      const conditions = [];
      if (clear_completed) conditions.push('completed');
      if (clear_failed) conditions.push('failed');
      
      if (conditions.length > 0) {
        const result = await prisma.documentProcessingQueue.deleteMany({
          where: { status: { in: conditions } }
        });
        deletedCount = result.count;
        console.log(`🗑️ [DEBUG] Cleared ${deletedCount} ${conditions.join(' and ')} queue entries`);
      }
    }
    
    // Get updated status
    const queueStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    queueStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    res.json({
      success: true,
      message: `Cleared ${deletedCount} queue entries`,
      deleted_count: deletedCount,
      remaining_queue_status: {
        queued: statusCounts.queued || 0,
        processing: statusCounts.processing || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0)
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error clearing queue:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Reset entire queue system (documents + jobs)
router.post('/queue/reset', async (req, res) => {
  try {
    console.log('🔄 [DEBUG] Resetting entire queue system...');
    
    // 1. Stop all running jobs by marking them as failed
    const runningJobs = await prisma.indexingJob.updateMany({
      where: { 
        status: 'running',
        jobType: { in: ['queue_processing', 'document_processing'] }
      },
      data: {
        status: 'failed',
        errorDetails: 'Manually reset by admin',
        completedAt: new Date()
      }
    });
    
    console.log(`🛑 [DEBUG] Stopped ${runningJobs.count} running jobs`);
    
    // 2. Reset all processing documents to queued
    const processingDocs = await prisma.documentProcessingQueue.updateMany({
      where: { status: 'processing' },
      data: {
        status: 'queued',
        startedAt: null,
        errorMessage: null
      }
    });
    
    console.log(`🔄 [DEBUG] Reset ${processingDocs.count} processing documents to queued`);
    
    // 3. Clear ALL documents from queue (including queued ones)
    const clearedDocs = await prisma.documentProcessingQueue.deleteMany({});
    
    console.log(`🗑️ [DEBUG] Cleared ${clearedDocs.count} documents from queue (all statuses)`);
    
    // 4. Get final status
    const queueStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    queueStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    const totalInQueue = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    
    console.log(`✅ [DEBUG] Queue system reset completed`);
    console.log(`📊 [DEBUG] Final queue status: ${totalInQueue} total documents`);

    res.json({
      success: true,
      message: 'Queue system has been completely reset',
      actions_taken: {
        stopped_jobs: runningJobs.count,
        reset_processing_docs: processingDocs.count,
        cleared_completed_failed: clearedDocs.count
      },
      final_queue_status: {
        queued: statusCounts.queued || 0,
        processing: statusCounts.processing || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        total: totalInQueue,
        is_processing: false
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error resetting queue system:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Stop all running queue processing jobs
router.post('/queue/stop', async (req, res) => {
  try {
    console.log('🛑 [DEBUG] Stopping all queue processing...');
    
    // Stop all running jobs
    const stoppedJobs = await prisma.indexingJob.updateMany({
      where: { 
        status: 'running',
        jobType: { in: ['queue_processing', 'document_processing'] }
      },
      data: {
        status: 'failed',
        errorDetails: 'Manually stopped by admin',
        completedAt: new Date()
      }
    });
    
    // Reset processing documents to queued
    const resetDocs = await prisma.documentProcessingQueue.updateMany({
      where: { status: 'processing' },
      data: {
        status: 'queued',
        startedAt: null
      }
    });
    
    console.log(`🛑 [DEBUG] Stopped ${stoppedJobs.count} jobs and reset ${resetDocs.count} documents`);

    res.json({
      success: true,
      message: `Stopped ${stoppedJobs.count} running jobs and reset ${resetDocs.count} processing documents`,
      stopped_jobs: stoppedJobs.count,
      reset_documents: resetDocs.count
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error stopping queue processing:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get queue analytics and detailed statistics
router.get('/queue/analytics', async (req, res) => {
  try {
    console.log('📈 [DEBUG] Getting queue analytics...');

    // Get processing statistics by time periods
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Documents processed in different time periods
    const [lastHour, lastDay, lastWeek] = await Promise.all([
      prisma.documentProcessingQueue.count({
        where: { status: 'completed', completedAt: { gte: oneHourAgo } }
      }),
      prisma.documentProcessingQueue.count({
        where: { status: 'completed', completedAt: { gte: oneDayAgo } }
      }),
      prisma.documentProcessingQueue.count({
        where: { status: 'completed', completedAt: { gte: oneWeekAgo } }
      })
    ]);

    // Average processing time
    const completedDocs = await prisma.documentProcessingQueue.findMany({
      where: { 
        status: 'completed',
        startedAt: { not: null },
        completedAt: { not: null }
      },
      select: {
        startedAt: true,
        completedAt: true
      },
      take: 100,
      orderBy: { completedAt: 'desc' }
    });

    const processingTimes = completedDocs
      .filter(doc => doc.startedAt && doc.completedAt)
      .map(doc => doc.completedAt.getTime() - doc.startedAt.getTime());

    const avgProcessingTime = processingTimes.length > 0 
      ? Math.round(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length / 1000)
      : 0;

    // Documents by contract
    const docsByContract = await prisma.documentProcessingQueue.groupBy({
      by: ['contractNoticeId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    });

    // Error analysis
    const errorAnalysis = await prisma.documentProcessingQueue.groupBy({
      by: ['errorMessage'],
      where: { status: 'failed' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      analytics: {
        processing_speed: {
          last_hour: lastHour,
          last_day: lastDay,
          last_week: lastWeek,
          per_hour_avg: Math.round(lastDay / 24),
          per_minute_avg: Math.round(lastHour / 60)
        },
        performance: {
          avg_processing_time_seconds: avgProcessingTime,
          total_processed: completedDocs.length,
          sample_size: processingTimes.length
        },
        top_contracts: docsByContract.map(item => ({
          contract_id: item.contractNoticeId,
          document_count: item._count.id
        })),
        error_analysis: errorAnalysis.map(item => ({
          error_message: item.errorMessage,
          occurrence_count: item._count.id
        }))
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error getting queue analytics:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;
