const express = require('express');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');
const { sendToNorshinAPI, processTextWithAI } = require('../services/norshinService');
const config = require('../config/env');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const documentAnalyzer = require('../utils/documentAnalyzer');

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

    // Use much higher concurrency for auto-queue processing
    const autoConcurrency = Math.min(100, Math.max(50, Math.floor(queuedDocs.length / 2)));

    // Respond immediately and start background processing
    res.json({
      success: true,
      message: `Started processing ALL ${queuedDocs.length} documents from queue with ${autoConcurrency} workers`,
      job_id: job.id,
      documents_count: queuedDocs.length,
      concurrency: autoConcurrency,
      processing_method: 'maximum_auto_parallel'
    });

    // Process documents in background with much higher concurrency
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
    const { concurrency = 50, batch_size = 1000, process_all = true } = req.body; // Much higher defaults
    
    console.log('🔄 [DEBUG] Starting parallel document processing...');
    console.log(`🔄 [DEBUG] Concurrency: ${concurrency}, Batch size: ${batch_size}, Process all: ${process_all}`);

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

    // Get ALL queued documents if process_all is true
    const queuedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'queued' },
      ...(process_all ? {} : { take: batch_size }), // No limit if process_all is true
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

    // Process ALL documents simultaneously (no concurrency limit)
    let finalConcurrency = queuedDocs.length; // Set concurrency to total number of documents
    console.log(`🔄 [DEBUG] Processing ALL ${queuedDocs.length} documents simultaneously (no concurrency limit)`);

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
      message: `Started processing ALL ${queuedDocs.length} documents SIMULTANEOUSLY (no limits)`,
      job_id: job.id,
      documents_count: queuedDocs.length,
      concurrency: finalConcurrency,
      processing_method: 'unlimited_simultaneous_processing',
      process_all: process_all
    });

    // Process documents in parallel (don't await - run in background)
    processDocumentsInParallel(queuedDocs, finalConcurrency, job.id);

  } catch (error) {
    console.error('❌ [DEBUG] Error starting document processing:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Helper function to process ALL documents simultaneously (no concurrency limits)
async function processDocumentsInParallel(documents, concurrency, jobId) {
  console.log(`🔄 [DEBUG] Processing ALL ${documents.length} documents SIMULTANEOUSLY (no concurrency limits)`);
  
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process single document
  const processDocument = async (doc) => {
    try {
      console.log(`🔄 [DEBUG] Starting processing: ${doc.filename}`);
      
      // Update status to processing immediately with existence check
      try {
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: { 
            status: 'processing',
            startedAt: new Date()
          }
        });
      } catch (updateError) {
        if (updateError.code === 'P2025') {
          console.log(`⚠️ [DEBUG] Document record ${doc.id} no longer exists, skipping processing`);
          return { success: false, filename: doc.filename, error: 'Record not found at start' };
        }
        throw updateError;
      }

      const documentId = `${doc.contractNoticeId}_${doc.filename}`;
      
      // Check if document is already indexed in vector database
      const existingDocs = await vectorService.searchDocuments(documentId, 1);
      
      if (existingDocs.length > 0 && existingDocs[0].metadata.id === documentId) {
        console.log(`📄 [DEBUG] Document already indexed, using cached: ${documentId}`);
        
        // Update status to completed with cached data
        try {
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
        } catch (updateError) {
          if (updateError.code === 'P2025') {
            console.log(`⚠️ [DEBUG] Document record ${doc.id} was deleted, cannot mark as cached`);
            return { success: false, filename: doc.filename, error: 'Record deleted during caching' };
          }
          throw updateError;
        }

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
        
        // Check if record still exists before updating
        const existingRecord = await prisma.documentProcessingQueue.findUnique({
          where: { id: doc.id }
        });

        if (!existingRecord) {
          console.log(`⚠️ [DEBUG] Document record ${doc.id} no longer exists, skipping update`);
          return { success: false, filename: doc.filename, error: 'Record not found' };
        }

        // Update the queue entry with the corrected filename if it changed
        if (finalFilename !== doc.filename) {
          console.log(`📄 [DEBUG] Updating filename from ${doc.filename} to ${finalFilename}`);
          try {
            await prisma.documentProcessingQueue.update({
              where: { id: doc.id },
              data: { filename: finalFilename }
            });
          } catch (updateError) {
            console.log(`⚠️ [DEBUG] Failed to update filename for ${doc.id}: ${updateError.message}`);
            // Continue processing even if filename update fails
          }
        }

        // Index the processed document in vector database
        await vectorService.indexDocument({
          filename: finalFilename,
          content: result.content || result.text || JSON.stringify(result),
          processedData: result
        }, doc.contractNoticeId);

        // Update status to completed with existence check
        try {
          await prisma.documentProcessingQueue.update({
            where: { id: doc.id },
            data: {
              status: 'completed',
              processedData: JSON.stringify(result),
              completedAt: new Date()
            }
          });
        } catch (updateError) {
          if (updateError.code === 'P2025') {
            console.log(`⚠️ [DEBUG] Document record ${doc.id} was deleted during processing`);
            return { success: false, filename: doc.filename, error: 'Record deleted during processing' };
          }
          throw updateError;
        }

        successCount++;
        console.log(`✅ [DEBUG] Successfully processed: ${finalFilename}`);
        return { success: true, filename: finalFilename, cached: false };
      } else {
        throw new Error('No result from Norshin API');
      }

    } catch (error) {
      console.error(`❌ [DEBUG] Error processing ${doc.filename}:`, error.message);
      
      // Update status to failed with existence check
      try {
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            failedAt: new Date()
          }
        });
      } catch (updateError) {
        if (updateError.code === 'P2025') {
          console.log(`⚠️ [DEBUG] Document record ${doc.id} was deleted, cannot mark as failed`);
        } else {
          console.error(`❌ [DEBUG] Error updating failed status for ${doc.id}:`, updateError.message);
        }
      }

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

  // Process ALL documents simultaneously (no worker pattern)
  console.log(`🚀 [DEBUG] Starting ALL ${documents.length} documents simultaneously...`);
  
  // Create a promise for each document and run them ALL in parallel
  const allPromises = documents.map(doc => processDocument(doc));
  
  // Wait for ALL documents to complete
  await Promise.allSettled(allPromises);

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

// Reset all documents to processing state at once
router.post('/queue/reset-to-processing', async (req, res) => {
  try {
    console.log('🔄 [DEBUG] Resetting ALL documents to processing state...');
    
    // Get current queue status before reset
    const beforeStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const beforeCounts = {};
    beforeStatus.forEach(item => {
      beforeCounts[item.status] = item._count.id;
    });

    const totalDocuments = Object.values(beforeCounts).reduce((sum, count) => sum + count, 0);
    
    console.log(`📊 [DEBUG] Before reset: ${beforeCounts.queued || 0} queued, ${beforeCounts.processing || 0} processing, ${beforeCounts.completed || 0} completed, ${beforeCounts.failed || 0} failed (${totalDocuments} total)`);

    // Reset ALL documents to processing state regardless of current status
    const resetResult = await prisma.documentProcessingQueue.updateMany({
      where: {}, // No where clause = update ALL documents
      data: {
        status: 'processing',
        startedAt: new Date(),
        completedAt: null,
        failedAt: null,
        errorMessage: null,
        processedData: null
      }
    });

    console.log(`🔄 [DEBUG] Reset ${resetResult.count} documents to processing state`);

    // Create a new processing job to track this batch
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'queue_processing',
        status: 'running',
        startDate: new Date()
      }
    });

    console.log(`✅ [DEBUG] Created new processing job: ${job.id}`);

    // Get updated status
    const afterStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const afterCounts = {};
    afterStatus.forEach(item => {
      afterCounts[item.status] = item._count.id;
    });

    console.log(`📊 [DEBUG] After reset: ${afterCounts.processing || 0} processing documents`);

    res.json({
      success: true,
      message: `Reset ALL ${resetResult.count} documents to processing state simultaneously`,
      job_id: job.id,
      before_status: {
        queued: beforeCounts.queued || 0,
        processing: beforeCounts.processing || 0,
        completed: beforeCounts.completed || 0,
        failed: beforeCounts.failed || 0,
        total: totalDocuments
      },
      after_status: {
        queued: afterCounts.queued || 0,
        processing: afterCounts.processing || 0,
        completed: afterCounts.completed || 0,
        failed: afterCounts.failed || 0,
        total: Object.values(afterCounts).reduce((sum, count) => sum + count, 0)
      },
      documents_reset: resetResult.count,
      processing_method: 'all_documents_simultaneous_processing'
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error resetting documents to processing:', error);
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

// Download all documents to local folder (no AI processing)
router.post('/download-all', async (req, res) => {
  try {
    const { 
      limit = 1000, 
      download_folder = 'downloaded_documents',
      concurrency = 10,
      contract_id 
    } = req.body;
    
    console.log('📥 [DEBUG] Starting bulk document download...');
    console.log(`📥 [DEBUG] Parameters: limit=${limit}, folder=${download_folder}, concurrency=${concurrency}`);

    // Create download directory
    const downloadPath = path.join(process.cwd(), download_folder);
    await fs.ensureDir(downloadPath);
    
    // Verify directory was created and is writable
    const dirExists = await fs.pathExists(downloadPath);
    if (!dirExists) {
      throw new Error(`Failed to create download directory: ${downloadPath}`);
    }
    
    // Test write permissions
    const testFile = path.join(downloadPath, 'test_write.tmp');
    try {
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      console.log(`📁 [DEBUG] Download directory verified: ${downloadPath}`);
    } catch (permError) {
      throw new Error(`Download directory is not writable: ${downloadPath} - ${permError.message}`);
    }

    // Get contracts with resourceLinks
    let whereClause = { resourceLinks: { not: null } };
    if (contract_id) {
      whereClause.noticeId = contract_id;
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      take: limit,
      select: {
        noticeId: true,
        title: true,
        resourceLinks: true,
        agency: true
      }
    });

    if (contracts.length === 0) {
      return res.json({
        success: false,
        message: 'No contracts with documents found to download',
        downloaded_count: 0
      });
    }

    console.log(`📄 [DEBUG] Found ${contracts.length} contracts with documents`);

    // Create download job for tracking
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'document_download',
        status: 'running',
        startDate: new Date()
      }
    });

    // Respond immediately and start background downloading
    res.json({
      success: true,
      message: `Started downloading documents from ${contracts.length} contracts to folder: ${download_folder}`,
      job_id: job.id,
      contracts_count: contracts.length,
      download_folder: download_folder,
      download_path: downloadPath
    });

    // Start background download process
    console.log(`🚀 [DEBUG] Starting background download process for job ${job.id}`);
    downloadDocumentsInParallel(contracts, downloadPath, concurrency, job.id);

  } catch (error) {
    console.error('❌ [DEBUG] Error starting document download:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get download status and statistics
router.get('/download/status', async (req, res) => {
  try {
    const downloadJobs = await prisma.indexingJob.findMany({
      where: { jobType: 'document_download' },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Get download folder info if it exists
    const downloadPath = path.join(process.cwd(), 'downloaded_documents');
    let folderStats = null;
    
    if (await fs.pathExists(downloadPath)) {
      const files = await fs.readdir(downloadPath);
      const stats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(downloadPath, file);
          const stat = await fs.stat(filePath);
          return { name: file, size: stat.size, modified: stat.mtime };
        })
      );
      
      folderStats = {
        total_files: files.length,
        total_size_bytes: stats.reduce((sum, file) => sum + file.size, 0),
        files: stats.slice(0, 20) // Show first 20 files
      };
    }

    res.json({
      success: true,
      download_jobs: downloadJobs.map(job => ({
        id: job.id,
        status: job.status,
        started_at: job.createdAt,
        completed_at: job.completedAt,
        records_processed: job.recordsProcessed,
        errors_count: job.errorsCount,
        duration_minutes: job.completedAt 
          ? Math.round((job.completedAt.getTime() - job.createdAt.getTime()) / 60000)
          : Math.round((Date.now() - job.createdAt.getTime()) / 60000)
      })),
      folder_stats: folderStats,
      download_path: downloadPath
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error getting download status:', error);
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

// Helper function to download documents in parallel
async function downloadDocumentsInParallel(contracts, downloadPath, concurrency, jobId) {
  console.log(`🚀 [DEBUG] ========================================`);
  console.log(`🚀 [DEBUG] STARTING DOCUMENT DOWNLOAD PROCESS`);
  console.log(`🚀 [DEBUG] Job ID: ${jobId}`);
  console.log(`🚀 [DEBUG] Contracts to process: ${contracts.length}`);
  console.log(`🚀 [DEBUG] Download path: ${downloadPath}`);
  console.log(`🚀 [DEBUG] Concurrency: ${concurrency}`);
  console.log(`🚀 [DEBUG] ========================================`);
  
  let downloadedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  let totalDocuments = 0;

  // Count total documents first
  console.log(`📊 [DEBUG] Analyzing contracts for document links...`);
  contracts.forEach((contract, index) => {
    console.log(`📄 [DEBUG] Contract ${index + 1}/${contracts.length}: ${contract.noticeId}`);
    console.log(`📄 [DEBUG]   Title: ${contract.title || 'No title'}`);
    console.log(`📄 [DEBUG]   Agency: ${contract.agency || 'No agency'}`);
    
    if (contract.resourceLinks && Array.isArray(contract.resourceLinks)) {
      console.log(`📄 [DEBUG]   ✅ Has ${contract.resourceLinks.length} document URLs:`);
      contract.resourceLinks.forEach((url, urlIndex) => {
        console.log(`📄 [DEBUG]     ${urlIndex + 1}. ${url}`);
      });
      totalDocuments += contract.resourceLinks.length;
    } else if (contract.resourceLinks) {
      console.log(`⚠️ [DEBUG]   ❌ resourceLinks exists but is not an array: ${typeof contract.resourceLinks}`);
      console.log(`📄 [DEBUG]   resourceLinks value: ${JSON.stringify(contract.resourceLinks)}`);
    } else {
      console.log(`⚠️ [DEBUG]   ❌ NO resourceLinks found`);
    }
  });

  console.log(`📊 [DEBUG] TOTAL DOCUMENTS TO DOWNLOAD: ${totalDocuments}`);
  console.log(`📊 [DEBUG] Starting download process in 3 seconds...`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  if (totalDocuments === 0) {
    console.log(`⚠️ [DEBUG] No documents found to download`);
    
    // Update job status
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        recordsProcessed: 0,
        errorsCount: 0,
        completedAt: new Date()
      }
    });
    
    return;
  }

  // Download single document with better error handling
  const downloadDocument = async (contract, docUrl, docIndex) => {
    const documentId = `${contract.noticeId}_doc${docIndex}`;
    
    try {
      console.log(`📥 [DEBUG] [${documentId}] Starting download: ${docUrl}`);
      
      // Get original filename from URL
      const originalFilename = docUrl.split('/').pop() || `document_${docIndex}`;
      
      // Don't check for existing files since we'll use timestamps to make them unique
      console.log(`📥 [DEBUG] [${documentId}] Processing: ${originalFilename}`);
      
      // Download the file with retries
      let response;
      let retries = 3;
      
      while (retries > 0) {
        try {
          console.log(`📥 [DEBUG] [${documentId}] Attempting download (${4 - retries}/3): ${docUrl}`);
          response = await axios.get(docUrl, {
            responseType: 'arraybuffer',
            timeout: 120000, // 2 minute timeout per attempt
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)',
              'Accept': '*/*'
            }
          });
          console.log(`✅ [DEBUG] [${documentId}] Download successful on attempt ${4 - retries}`);
          break; // Success, exit retry loop
        } catch (downloadError) {
          retries--;
          console.log(`❌ [DEBUG] [${documentId}] Download attempt ${4 - retries} failed: ${downloadError.message}`);
          
          if (retries === 0) {
            console.log(`💥 [DEBUG] [${documentId}] All download attempts failed`);
            throw downloadError;
          }
          
          console.log(`⚠️ [DEBUG] [${documentId}] Retrying in 2 seconds... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        }
      }

      const fileBuffer = Buffer.from(response.data);
      console.log(`📥 [DEBUG] [${documentId}] Downloaded ${fileBuffer.length} bytes`);

      // Analyze the document to get proper extension
      const contentType = response.headers['content-type'] || '';
      const analysis = documentAnalyzer.analyzeDocument(fileBuffer, originalFilename, contentType);
      
      // Skip ZIP files and unsupported types
      if (analysis.isZipFile) {
        console.log(`⚠️ [DEBUG] [${documentId}] SKIPPED - ZIP file: ${originalFilename}`);
        console.log(`⚠️ [DEBUG] [${documentId}] Document type detected: ${analysis.documentType}`);
        skippedCount++;
        return { success: false, reason: 'ZIP file' };
      }

      if (!analysis.isSupported) {
        console.log(`⚠️ [DEBUG] [${documentId}] SKIPPED - Unsupported document type: ${analysis.documentType}`);
        console.log(`⚠️ [DEBUG] [${documentId}] Content-Type: ${contentType}`);
        console.log(`⚠️ [DEBUG] [${documentId}] File extension: ${analysis.extension}`);
        skippedCount++;
        return { success: false, reason: 'Unsupported type' };
      }

      // Generate proper filename with correct extension and timestamp to ensure uniqueness
      const correctExtension = documentAnalyzer.getCorrectExtension(analysis.documentType, analysis.extension);
      const timestamp = Date.now();
      const baseFilename = originalFilename.replace(/\.[^/.]+$/, '');
      const properFilename = `${contract.noticeId}_${baseFilename}_${timestamp}${correctExtension}`;
      
      // Save to download folder
      const filePath = path.join(downloadPath, properFilename);
      
      try {
        await fs.writeFile(filePath, fileBuffer);
        
        // Verify file was actually written
        const fileExists = await fs.pathExists(filePath);
        if (!fileExists) {
          throw new Error(`File was not created: ${filePath}`);
        }
        
        const fileStats = await fs.stat(filePath);
        if (fileStats.size !== fileBuffer.length) {
          throw new Error(`File size mismatch: expected ${fileBuffer.length}, got ${fileStats.size}`);
        }
        
        downloadedCount++;
        console.log(`✅ [DEBUG] [${documentId}] Downloaded: ${properFilename} (${analysis.documentType}, ${fileBuffer.length} bytes, ~${analysis.estimatedPages} pages)`);
        console.log(`📁 [DEBUG] [${documentId}] Saved to: ${filePath}`);
        console.log(`📁 [DEBUG] [${documentId}] File verified: exists=${fileExists}, size=${fileStats.size}`);
        
      } catch (writeError) {
        console.error(`❌ [DEBUG] [${documentId}] Error writing file to ${filePath}:`, writeError.message);
        throw new Error(`Failed to save file: ${writeError.message}`);
      }
      
      return { 
        success: true, 
        filename: properFilename, 
        size: fileBuffer.length,
        type: analysis.documentType,
        pages: analysis.estimatedPages
      };

    } catch (error) {
      console.error(`❌ [DEBUG] [${documentId}] FAILED - Error downloading document ${docUrl}:`);
      console.error(`❌ [DEBUG] [${documentId}] Error message: ${error.message}`);
      console.error(`❌ [DEBUG] [${documentId}] Error type: ${error.constructor.name}`);
      if (error.response) {
        console.error(`❌ [DEBUG] [${documentId}] HTTP Status: ${error.response.status}`);
        console.error(`❌ [DEBUG] [${documentId}] HTTP Status Text: ${error.response.statusText}`);
      }
      errorCount++;
      return { success: false, error: error.message, documentId };
    }
  };

  // Create download tasks for all documents
  console.log(`🔧 [DEBUG] Creating download tasks...`);
  const downloadTasks = [];
  let taskIndex = 0;
  let contractsWithDocs = 0;
  
  contracts.forEach((contract, contractIndex) => {
    console.log(`🔍 [DEBUG] Processing contract ${contractIndex + 1}/${contracts.length}: ${contract.noticeId}`);
    
    if (contract.resourceLinks && Array.isArray(contract.resourceLinks) && contract.resourceLinks.length > 0) {
      contractsWithDocs++;
      console.log(`📄 [DEBUG] ✅ Contract ${contract.noticeId} has ${contract.resourceLinks.length} documents`);
      
      contract.resourceLinks.forEach((docUrl, index) => {
        console.log(`📋 [DEBUG]   Checking URL ${index + 1}/${contract.resourceLinks.length}: ${docUrl}`);
        
        if (docUrl && docUrl.trim()) { // Ensure URL is not empty
          taskIndex++;
          console.log(`📋 [DEBUG]   ✅ Valid URL - Creating task ${taskIndex}: ${docUrl}`);
          downloadTasks.push(() => downloadDocument(contract, docUrl, taskIndex));
        } else {
          console.log(`⚠️ [DEBUG]   ❌ Skipping empty/invalid URL for contract ${contract.noticeId}: "${docUrl}"`);
        }
      });
    } else if (contract.resourceLinks) {
      console.log(`❌ [DEBUG] Contract ${contract.noticeId} has invalid resourceLinks:`);
      console.log(`❌ [DEBUG]   Type: ${typeof contract.resourceLinks}`);
      console.log(`❌ [DEBUG]   Is Array: ${Array.isArray(contract.resourceLinks)}`);
      console.log(`❌ [DEBUG]   Length: ${contract.resourceLinks.length}`);
      console.log(`❌ [DEBUG]   Value: ${JSON.stringify(contract.resourceLinks)}`);
    } else {
      console.log(`❌ [DEBUG] Contract ${contract.noticeId} has NO resourceLinks property`);
    }
  });
  
  console.log(`📊 [DEBUG] TASK CREATION COMPLETE:`);
  console.log(`📊 [DEBUG] - Created ${downloadTasks.length} download tasks`);
  console.log(`📊 [DEBUG] - From ${contractsWithDocs}/${contracts.length} contracts with documents`);

  if (downloadTasks.length === 0) {
    console.log(`⚠️ [DEBUG] No download tasks created - no documents to download`);
    
    // Update job status
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        recordsProcessed: 0,
        errorsCount: 0,
        completedAt: new Date()
      }
    });
    
    return;
  }

  // Process downloads with proper concurrency control
  console.log(`⚙️ [DEBUG] Setting up batch processing...`);
  const batchSize = concurrency; // Each batch processes 'concurrency' number of downloads
  const batches = [];
  
  for (let i = 0; i < downloadTasks.length; i += batchSize) {
    batches.push(downloadTasks.slice(i, i + batchSize));
  }

  console.log(`📊 [DEBUG] BATCH SETUP COMPLETE:`);
  console.log(`📊 [DEBUG] - Total downloads: ${downloadTasks.length}`);
  console.log(`📊 [DEBUG] - Batch size: ${batchSize}`);
  console.log(`📊 [DEBUG] - Number of batches: ${batches.length}`);
  console.log(`📊 [DEBUG] - Starting batch processing...`);

  // Process each batch in parallel
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`🚀 [DEBUG] ========================================`);
    console.log(`🚀 [DEBUG] STARTING BATCH ${batchIndex + 1}/${batches.length}`);
    console.log(`🚀 [DEBUG] Batch contains ${batch.length} downloads`);
    console.log(`🚀 [DEBUG] ========================================`);
    
    const batchStartTime = Date.now();
    const batchPromises = batch.map((task, taskIndex) => {
      console.log(`🔄 [DEBUG] Starting task ${taskIndex + 1}/${batch.length} in batch ${batchIndex + 1}`);
      return task();
    });
    
    console.log(`⏳ [DEBUG] Waiting for batch ${batchIndex + 1} to complete...`);
    const batchResults = await Promise.allSettled(batchPromises);
    const batchDuration = Math.round((Date.now() - batchStartTime) / 1000);
    
    // Process batch results and update counters
    let batchSuccess = 0;
    let batchErrors = 0;
    let batchSkipped = 0;
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const value = result.value;
        if (value?.success) {
          batchSuccess++;
        } else {
          if (value?.reason === 'Already exists' || value?.reason === 'ZIP file' || value?.reason === 'Unsupported type') {
            batchSkipped++;
          } else {
            batchErrors++;
          }
        }
      } else {
        console.error(`❌ [DEBUG] Batch ${batchIndex + 1} task ${index + 1} rejected:`, result.reason);
        batchErrors++;
      }
    });
    
    console.log(`✅ [DEBUG] ========================================`);
    console.log(`✅ [DEBUG] BATCH ${batchIndex + 1} COMPLETED in ${batchDuration}s`);
    console.log(`✅ [DEBUG] Batch results: ${batchSuccess} success, ${batchErrors} errors, ${batchSkipped} skipped`);
    console.log(`✅ [DEBUG] ========================================`);
    
    // Log overall progress
    const completed = downloadedCount + errorCount + skippedCount;
    const progress = Math.round((completed / totalDocuments) * 100);
    console.log(`📊 [DEBUG] 🎯 OVERALL PROGRESS: ${completed}/${totalDocuments} (${progress}%)`);
    console.log(`📊 [DEBUG] 📥 Downloaded: ${downloadedCount}`);
    console.log(`📊 [DEBUG] ❌ Errors: ${errorCount}`);
    console.log(`📊 [DEBUG] ⏭️  Skipped: ${skippedCount}`);
    
    // Small delay between batches to avoid overwhelming the server
    if (batchIndex < batches.length - 1) {
      console.log(`⏸️ [DEBUG] Waiting 1 second before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Verify final file count in directory
  let actualFileCount = 0;
  try {
    if (await fs.pathExists(downloadPath)) {
      const files = await fs.readdir(downloadPath);
      actualFileCount = files.length;
      console.log(`📁 [DEBUG] Actual files in directory: ${actualFileCount}`);
      
      if (actualFileCount !== downloadedCount) {
        console.error(`❌ [DEBUG] File count mismatch! Expected: ${downloadedCount}, Actual: ${actualFileCount}`);
        
        // List first 10 files for debugging
        const fileList = files.slice(0, 10);
        console.log(`📁 [DEBUG] Files found: ${fileList.join(', ')}`);
      }
    }
  } catch (dirError) {
    console.error(`❌ [DEBUG] Error checking download directory: ${dirError.message}`);
  }

  // Update job status
  try {
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        recordsProcessed: actualFileCount, // Use actual file count
        errorsCount: errorCount,
        completedAt: new Date()
      }
    });

    console.log(`🎉 [DEBUG] ========================================`);
    console.log(`🎉 [DEBUG] DOWNLOAD PROCESS COMPLETED!`);
    console.log(`🎉 [DEBUG] ========================================`);
    console.log(`📊 [DEBUG] 📥 Downloads attempted: ${downloadedCount}`);
    console.log(`📊 [DEBUG] 💾 Files actually saved: ${actualFileCount}`);
    console.log(`📊 [DEBUG] ❌ Errors encountered: ${errorCount}`);
    console.log(`📊 [DEBUG] ⏭️  Files skipped: ${skippedCount}`);
    console.log(`📊 [DEBUG] 📁 Download directory: ${downloadPath}`);
    console.log(`🎉 [DEBUG] ========================================`);
  } catch (updateError) {
    console.error('❌ [DEBUG] Error updating job status:', updateError);
  }
}

module.exports = router;
