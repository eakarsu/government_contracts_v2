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
            console.log(`Downloading document from government: ${docUrl}`);
            const result = await sendToNorshinAPI(docUrl, `doc_${contract.noticeId}`, '', 'openai/gpt-4.1');
            
            if (result) {
              // Index the processed document in vector database
              await vectorService.indexDocument({
                filename: `doc_${contract.noticeId}`,
                content: result.content || result.text || JSON.stringify(result),
                processedData: result
              }, contract.noticeId);
              
              downloadedCount++;
              console.log(`Downloaded and indexed document for contract: ${contract.noticeId}`);
            } else {
              errorsCount++;
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
