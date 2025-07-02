const express = require('express');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');
const { sendToNorshinAPI, processTextWithAI } = require('../services/norshinService');
const config = require('../config/env');

const router = express.Router();

// Process documents already in vector database (AI analysis/processing)
router.post('/process', async (req, res) => {
  console.log('🔄 [DEBUG] Process documents endpoint called');
  console.log('🔄 [DEBUG] Request body:', req.body);
  
  try {
    const { contract_id, limit = 50, analysis_type = 'summary' } = req.body;
    console.log('🔄 [DEBUG] Parsed parameters:', { contract_id, limit, analysis_type });

    // Get all documents from vector database
    console.log('🔄 [DEBUG] Getting vector database stats...');
    const vectorStats = await vectorService.getCollectionStats();
    console.log('🔄 [DEBUG] Vector stats:', vectorStats);
    console.log('🔄 [DEBUG] Note: contracts are different from documents. You have contracts indexed but need to download/index the actual document files.');
    
    // Check if there are contracts with document links available for download
    const contractsWithDocs = await prisma.contract.count({
      where: { resourceLinks: { not: null } }
    });
    console.log(`🔄 [DEBUG] Contracts with document links available: ${contractsWithDocs}`);
    
    if (vectorStats.documents === 0) {
      console.log('⚠️ [DEBUG] No documents in vector database, will download from contracts with resourceLinks');
      
      // Get contracts with resourceLinks from vector database
      console.log('🔍 [DEBUG] Searching for contracts with resourceLinks in vector database...');
      const contractsInVector = await vectorService.searchContracts("contract", 200); // Get more contracts
      console.log(`🔍 [DEBUG] Found ${contractsInVector.length} contracts in vector database`);
      
      // Get full contract data from PostgreSQL to access resourceLinks
      const contractIds = contractsInVector.map(c => c.id);
      const contractsWithLinks = await prisma.contract.findMany({
        where: {
          noticeId: { in: contractIds },
          resourceLinks: { not: null }
        },
        take: limit
      });
      
      console.log(`📄 [DEBUG] Found ${contractsWithLinks.length} contracts with resourceLinks`);
      
      if (contractsWithLinks.length === 0) {
        return res.json({ 
          message: 'No contracts with document links found to download', 
          processed_count: 0 
        });
      }
      
      // Download and index documents from these contracts
      console.log('📥 [DEBUG] Starting document download and indexing...');
      let downloadedCount = 0;
      let errorsCount = 0;
      
      for (const contract of contractsWithLinks) {
        try {
          const resourceLinks = contract.resourceLinks;
          if (!resourceLinks || !Array.isArray(resourceLinks)) continue;

          console.log(`📄 [DEBUG] Processing ${resourceLinks.length} documents for contract ${contract.noticeId}`);
          
          // Process up to 3 documents per contract
          for (const docUrl of resourceLinks.slice(0, 3)) {
            try {
              const documentId = `${contract.noticeId}_${docUrl.split('/').pop()}`;
              
              // Check if document is already indexed
              const existingDocs = await vectorService.searchDocuments(documentId, 1);
              if (existingDocs.length > 0 && existingDocs[0].metadata.id === documentId) {
                console.log(`📄 [DEBUG] Document already indexed, skipping: ${documentId}`);
                continue;
              }

              // Download and process document
              console.log(`📥 [DEBUG] Downloading document from: ${docUrl}`);
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
                  console.error(`❌ [DEBUG] Error processing document: ${docError.message}`);
                  errorsCount++;
                }
              }
            } catch (error) {
              console.error(`❌ [DEBUG] Error downloading document ${docUrl}:`, error);
              errorsCount++;
            }
          }
        } catch (error) {
          console.error(`❌ [DEBUG] Error processing contract ${contract.noticeId}:`, error);
          errorsCount++;
        }
      }
      
      // Update vector stats after downloading
      const updatedVectorStats = await vectorService.getCollectionStats();
      console.log(`📊 [DEBUG] Updated vector stats after download:`, updatedVectorStats);
      
      if (updatedVectorStats.documents === 0) {
        return res.json({
          success: true,
          message: `Downloaded ${downloadedCount} documents but none were successfully indexed. Check logs for errors.`,
          downloaded_count: downloadedCount,
          errors_count: errorsCount,
          documents_indexed: updatedVectorStats.documents
        });
      }
      
      // Continue with document processing now that we have documents
      console.log(`🔄 [DEBUG] Now processing ${updatedVectorStats.documents} downloaded documents...`);
    }

    // Create processing job
    console.log('🔄 [DEBUG] Creating indexing job...');
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'document_processing',
        status: 'running'
      }
    });
    console.log('✅ [DEBUG] Created job with ID:', job.id);

    let processedCount = 0;
    let errorsCount = 0;

    try {
      // Search for documents in vector database
      let searchQuery = contract_id ? contract_id : "contract document";
      console.log('🔍 [DEBUG] Searching vector database with query:', searchQuery);
      const vectorDocs = await vectorService.searchDocuments(searchQuery, limit);
      console.log('🔍 [DEBUG] Found vector documents:', vectorDocs.length);

      if (vectorDocs.length === 0) {
        console.log('⚠️ [DEBUG] No documents found matching criteria after download attempt');
        return res.json({ 
          message: 'No documents found in vector database matching criteria even after attempting to download', 
          processed_count: 0 
        });
      }

      console.log(`🔄 [DEBUG] Processing ${vectorDocs.length} documents from vector database...`);

      for (const doc of vectorDocs) {
        try {
          console.log(`🔄 [DEBUG] Processing document: ${doc.id}`);
          
          // Process document content with AI analysis
          const documentContent = doc.document;
          const contractId = doc.metadata.contractId;
          
          console.log(`📄 [DEBUG] Document content length: ${documentContent?.length || 0}`);
          console.log(`📄 [DEBUG] Contract ID: ${contractId}`);
          
          if (!documentContent || documentContent.length < 100) {
            console.log(`⚠️ [DEBUG] Skipping document ${doc.id} - insufficient content (${documentContent?.length || 0} chars)`);
            continue;
          }

          // Process document content with AI analysis (no downloading)
          console.log(`🤖 [DEBUG] Calling processTextWithAI for document ${doc.id}...`);
          const analysisResult = await processTextWithAI(
            documentContent.substring(0, 4000), // Limit content size
            analysis_type,
            'openai/gpt-4.1'
          );
          console.log(`🤖 [DEBUG] AI analysis result:`, analysisResult ? 'Success' : 'Failed');

          if (analysisResult) {
            // Store the analysis result
            console.log(`💾 [DEBUG] Storing analysis result for document ${doc.id}...`);
            await prisma.documentAnalysis.upsert({
              where: { 
                documentId: doc.id 
              },
              update: {
                analysisType: analysis_type,
                analysisResult: JSON.stringify(analysisResult),
                processedAt: new Date()
              },
              create: {
                documentId: doc.id,
                contractNoticeId: contractId,
                analysisType: analysis_type,
                analysisResult: JSON.stringify(analysisResult),
                processedAt: new Date()
              }
            });

            processedCount++;
            console.log(`✅ [DEBUG] Processed analysis for document: ${doc.id}`);
          } else {
            console.log(`❌ [DEBUG] No analysis result for document: ${doc.id}`);
            errorsCount++;
          }

        } catch (error) {
          console.error(`❌ [DEBUG] Error processing document ${doc.id}:`, error);
          errorsCount++;
        }
      }

    } catch (error) {
      console.error('❌ [DEBUG] Vector database search failed:', error);
      errorsCount++;
    }

    // Update job status
    console.log('🔄 [DEBUG] Updating job status...');
    await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        recordsProcessed: processedCount,
        errorsCount,
        completedAt: new Date()
      }
    });
    console.log('✅ [DEBUG] Job status updated');

    const response = {
      success: true,
      job_id: job.id,
      processed_count: processedCount,
      errors_count: errorsCount,
      message: `Processed AI analysis for ${processedCount} documents from vector database`,
      source: 'vector_database'
    };
    
    console.log('📤 [DEBUG] Sending response:', response);
    res.json(response);

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

// Queue documents for processing from all indexed contracts
router.post('/queue', async (req, res) => {
  try {
    const { limit = 100, clear_existing = true } = req.body;
    
    console.log('🔄 [DEBUG] Starting document queue population...');
    console.log(`🔄 [DEBUG] Parameters: limit=${limit}, clear_existing=${clear_existing}`);

    // Clear existing queue if requested
    if (clear_existing) {
      const deletedCount = await prisma.documentProcessingQueue.deleteMany({});
      console.log(`🗑️ [DEBUG] Cleared ${deletedCount.count} existing queue entries`);
    }

    // Get all contracts with resourceLinks from database
    const contracts = await prisma.contract.findMany({
      where: { 
        resourceLinks: { not: null }
      },
      take: limit,
      select: {
        noticeId: true,
        title: true,
        resourceLinks: true,
        agency: true
      }
    });

    console.log(`📄 [DEBUG] Found ${contracts.length} contracts with resourceLinks`);

    if (contracts.length === 0) {
      return res.json({
        success: true,
        message: 'No contracts with documents found to queue',
        queued_count: 0,
        contracts_checked: 0
      });
    }

    let queuedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each contract and queue its documents
    for (const contract of contracts) {
      try {
        const resourceLinks = contract.resourceLinks;
        
        if (!resourceLinks || !Array.isArray(resourceLinks) || resourceLinks.length === 0) {
          console.log(`⚠️ [DEBUG] Contract ${contract.noticeId} has no valid resourceLinks`);
          skippedCount++;
          continue;
        }

        console.log(`📄 [DEBUG] Processing ${resourceLinks.length} documents for contract ${contract.noticeId}`);

        // Queue each document from this contract
        for (let i = 0; i < resourceLinks.length; i++) {
          const docUrl = resourceLinks[i];
          
          try {
            // Generate unique filename
            const urlParts = docUrl.split('/');
            const originalFilename = urlParts[urlParts.length - 1] || `document_${i + 1}`;
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
              skippedCount++;
              continue;
            }

            // Create queue entry
            await prisma.documentProcessingQueue.create({
              data: {
                contractNoticeId: contract.noticeId,
                documentUrl: docUrl,
                description: `${contract.title || 'Untitled'} - ${contract.agency || 'Unknown Agency'}`,
                filename: filename,
                status: 'queued'
              }
            });

            queuedCount++;
            console.log(`✅ [DEBUG] Queued document: ${filename}`);

          } catch (docError) {
            console.error(`❌ [DEBUG] Error queueing document ${docUrl}:`, docError.message);
            errorCount++;
          }
        }

      } catch (contractError) {
        console.error(`❌ [DEBUG] Error processing contract ${contract.noticeId}:`, contractError.message);
        errorCount++;
      }
    }

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

    console.log(`📊 [DEBUG] Queue population completed:`);
    console.log(`📊 [DEBUG] - Queued: ${queuedCount} new documents`);
    console.log(`📊 [DEBUG] - Skipped: ${skippedCount} documents`);
    console.log(`📊 [DEBUG] - Errors: ${errorCount} documents`);
    console.log(`📊 [DEBUG] - Total in queue: ${totalInQueue} documents`);

    res.json({
      success: true,
      message: `Successfully queued ${queuedCount} documents from ${contracts.length} contracts`,
      queued_count: queuedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      contracts_processed: contracts.length,
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
    console.error('❌ [DEBUG] Error queueing documents:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get detailed queue status with real-time counters
router.get('/queue/status', async (req, res) => {
  try {
    console.log('📊 [DEBUG] Getting queue status...');

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

    console.log(`📊 [DEBUG] Queue status: ${queuedCount} queued, ${processingCount} processing, ${completedCount} completed, ${failedCount} failed`);

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
    const { concurrency = 5, batch_size = 20 } = req.body;
    
    console.log('🔄 [DEBUG] Starting parallel document processing...');
    console.log(`🔄 [DEBUG] Concurrency: ${concurrency}, Batch size: ${batch_size}`);

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
      message: `Started processing ${queuedDocs.length} documents`,
      job_id: job.id,
      documents_count: queuedDocs.length,
      concurrency: concurrency,
      processing_method: 'parallel_async'
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

// Helper function to process documents in parallel
async function processDocumentsInParallel(documents, concurrency, jobId) {
  console.log(`🔄 [DEBUG] Processing ${documents.length} documents with concurrency ${concurrency}`);
  
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process documents in batches with limited concurrency
  const processBatch = async (batch) => {
    const promises = batch.map(async (doc) => {
      try {
        console.log(`🔄 [DEBUG] Starting processing: ${doc.filename}`);
        
        // Update status to processing
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
          // Index the processed document in vector database
          await vectorService.indexDocument({
            filename: doc.filename,
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
          console.log(`✅ [DEBUG] Successfully processed: ${doc.filename}`);
          return { success: true, filename: doc.filename, cached: false };
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
        
        // Log progress
        console.log(`📊 [DEBUG] Progress: ${processedCount}/${documents.length} (${Math.round(processedCount/documents.length*100)}%)`);
      }
    });

    return Promise.allSettled(promises);
  };

  // Split documents into batches for controlled concurrency
  const batches = [];
  for (let i = 0; i < documents.length; i += concurrency) {
    batches.push(documents.slice(i, i + concurrency));
  }

  // Process batches sequentially, but documents within each batch in parallel
  for (let i = 0; i < batches.length; i++) {
    console.log(`🔄 [DEBUG] Processing batch ${i + 1}/${batches.length} (${batches[i].length} documents)`);
    await processBatch(batches[i]);
  }

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
