const express = require('express');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');
const { sendToNorshinAPI } = require('../services/norshinService');
const config = require('../config/env');

const router = express.Router();

// Process and index contract documents
router.post('/process', async (req, res) => {
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
      return res.json({ message: 'No contracts with documents found', processed_count: 0 });
    }

    // Create indexing job
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'documents',
        status: 'running'
      }
    });

    let processedCount = 0;
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
            
            // First check if document is already indexed in vector database
            const existingDocs = await vectorService.searchDocuments(documentId, 1);
            
            if (existingDocs.length > 0 && existingDocs[0].metadata.id === documentId) {
              console.log(`Document already indexed, skipping: ${documentId}`);
              skippedCount++;
              continue;
            }

            // Document not found in vector DB, process it
            const result = await sendToNorshinAPI(docUrl, `doc_${contract.noticeId}`, '', 'openai/gpt-4.1');
            
            if (result) {
              // Index the processed document in vector database
              await vectorService.indexDocument({
                filename: `doc_${contract.noticeId}`,
                content: result.content || result.text || JSON.stringify(result),
                processedData: result
              }, contract.noticeId);
              
              processedCount++;
              console.log(`Processed and indexed document for contract: ${contract.noticeId}`);
            } else {
              errorsCount++;
            }
          } catch (error) {
            console.error(`Error processing document ${docUrl}:`, error);
            errorsCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing documents for contract ${contract.noticeId}:`, error);
        errorsCount++;
      }
    }

    // Update job status
    await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        recordsProcessed: processedCount,
        errorsCount,
        completedAt: new Date()
      }
    });

    res.json({
      success: true,
      job_id: job.id,
      processed_count: processedCount,
      errors_count: errorsCount,
      skipped_count: skippedCount,
      message: `Processed ${processedCount} new documents, skipped ${skippedCount} already indexed documents`
    });

  } catch (error) {
    console.error('Document processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Queue documents for processing
router.post('/queue', async (req, res) => {
  try {
    console.log('Queueing documents for processing...');

    // Clear existing queue
    await prisma.documentProcessingQueue.deleteMany({});

    // Get contracts with documents
    const contracts = await prisma.contract.findMany({
      where: { resourceLinks: { not: null } },
      take: 10
    });

    if (contracts.length === 0) {
      return res.json({
        success: true,
        message: 'No documents to queue for processing',
        queued_count: 0
      });
    }

    let queuedCount = 0;
    for (const contract of contracts) {
      if (contract.resourceLinks && Array.isArray(contract.resourceLinks)) {
        for (const linkUrl of contract.resourceLinks) {
          try {
            // Create queue entry
            await prisma.documentProcessingQueue.create({
              data: {
                contractNoticeId: contract.noticeId,
                documentUrl: linkUrl,
                description: contract.title || '',
                filename: `${contract.noticeId}_doc_${queuedCount + 1}`,
                status: 'queued'
              }
            });
            queuedCount++;
            console.log(`Queued document: ${linkUrl}`);
          } catch (error) {
            console.warn(`Failed to queue document ${linkUrl}:`, error);
          }
        }
      }
    }

    // Get queue status
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
      message: `Queued ${queuedCount} documents for processing`,
      queued_count: queuedCount,
      queue_status: {
        queued: statusCounts.queued || 0,
        processing: statusCounts.processing || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        total: queuedCount,
        is_processing: (statusCounts.processing || 0) > 0
      }
    });

  } catch (error) {
    console.error('Error queueing documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get queue status
router.get('/queue/status', async (req, res) => {
  try {
    const queueStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    queueStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    // Get recent completed documents
    const recentDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
      take: 5
    });

    res.json({
      success: true,
      queue_status: {
        queued: statusCounts.queued || 0,
        processing: statusCounts.processing || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        is_processing: (statusCounts.processing || 0) > 0,
        recent_documents: recentDocs.map(doc => ({
          filename: doc.filename,
          completed_at: doc.completedAt?.toISOString(),
          contract_notice_id: doc.contractNoticeId
        }))
      }
    });

  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process queued documents
router.post('/queue/process', async (req, res) => {
  try {
    const queuedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'queued' }
    });

    if (queuedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No documents currently queued',
        queued_count: 0
      });
    }

    console.log(`Starting processing of ${queuedDocs.length} documents`);

    // Process documents asynchronously
    const processPromises = queuedDocs.map(async (doc) => {
      try {
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
          console.log(`Document already indexed, using cached version: ${documentId}`);
          
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

          return { success: true, filename: doc.filename, cached: true };
        }

        // Document not found in vector DB, process via Norshin API
        const result = await sendToNorshinAPI(
          doc.documentUrl,
          doc.filename || 'document',
          '',
          'openai/gpt-4.1'
        );

        // Index the processed document in vector database
        if (result) {
          await vectorService.indexDocument({
            filename: doc.filename,
            content: result.content || result.text || JSON.stringify(result),
            processedData: result
          }, doc.contractNoticeId);
        }

        // Update status to completed
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'completed',
            processedData: JSON.stringify(result),
            completedAt: new Date()
          }
        });

        return { success: true, filename: doc.filename, cached: false };
      } catch (error) {
        // Update status to failed
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            failedAt: new Date()
          }
        });

        return { success: false, filename: doc.filename, error: error.message };
      }
    });

    // Wait for all processing to complete
    const results = await Promise.allSettled(processPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const errorCount = results.length - successCount;

    res.json({
      success: true,
      message: `Processing completed`,
      submitted_count: queuedDocs.length,
      success_count: successCount,
      error_count: errorCount,
      processing_method: 'async_concurrent'
    });

  } catch (error) {
    console.error('Document processing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

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

module.exports = router;
