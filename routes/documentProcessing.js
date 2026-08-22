const express = require('express');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorServiceInstance');
const { summarizeContent } = require('../services/summarizationService');
const config = require('../config/env');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const documentAnalyzer = require('../utils/documentAnalyzer');
const LibreOfficeService = require('../services/libreoffice.service');
const libreOfficeService = new LibreOfficeService();

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
      
      // Test mode is additive; it never clears existing queue entries.

      // Get contracts with resourceLinks (limit to first few for testing)
      const contracts = await prisma.contract.findMany({
        where: { 
          resourceLinks: { not: null },
          ...(contract_id ? { noticeId: contract_id } : {})
        },
        take: Math.min(limit, 10), // Maximum 10 contracts for test mode
        select: {
          noticeId: true,
          title: true,
          resourceLinks: true,
          agency: true
        }
      });

      console.log(`📄 [DEBUG] Found ${contracts.length} contracts for test processing`);

      if (contracts.length === 0) {
        return res.json({
          success: false,
          message: 'No contracts with document URLs found for test processing',
          processed_count: 0,
          test_mode: true
        });
      }

      let queuedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Process contracts but limit total documents to test_limit
      for (const contract of contracts) {
        if (queuedCount >= limit) {
          console.log(`🧪 [DEBUG] Reached test limit of ${limit} documents, stopping`);
          break;
        }

        try {
          const resourceLinks = contract.resourceLinks;
          
          if (!resourceLinks || !Array.isArray(resourceLinks) || resourceLinks.length === 0) {
            skippedCount++;
            continue;
          }

          // Process only first document from each contract for testing
          const docUrl = resourceLinks[0]; // Only take first document
          
          try {
            const urlParts = docUrl.split('/');
            const originalFilename = urlParts[urlParts.length - 1] || `test_document_${queuedCount + 1}`;
            const filename = `TEST_${contract.noticeId}_${originalFilename}`;

            console.log(`🧪 [DEBUG] TEST DOCUMENT ${queuedCount + 1}/${limit}: ${docUrl}`);

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

            // Check if document was already downloaded locally
            const downloadPath = path.join(process.cwd(), 'downloaded_documents');
            const possibleLocalFiles = await fs.readdir(downloadPath).catch(() => []);
            const localFile = possibleLocalFiles.find(file => 
              file.includes(contract.noticeId) && 
              (file.includes(originalFilename.replace(/\.[^/.]+$/, '')) || file.includes('document'))
            );
            
            const localFilePath = localFile ? path.join(downloadPath, localFile) : null;
            
            if (localFilePath) {
              console.log(`📁 [DEBUG] Found local file for test document: ${localFile}`);
            }

            // Create queue entry for test document
            await prisma.documentProcessingQueue.create({
              data: {
                contractNoticeId: contract.noticeId,
                documentUrl: docUrl,
                localFilePath: localFilePath,
                description: `TEST DOCUMENT ${queuedCount + 1}/${limit}: ${contract.title || 'Untitled'} - ${contract.agency || 'Unknown Agency'}`,
                filename: filename,
                status: 'queued',
                queuedAt: new Date(),
                retryCount: 0,
                maxRetries: 3
              }
            });

            queuedCount++;
            console.log(`🧪 [DEBUG] ✅ Queued TEST document ${queuedCount}/${limit}: ${filename}`);

          } catch (docError) {
            console.error(`❌ [DEBUG] Error queueing test document ${docUrl}:`, docError.message);
            errorCount++;
          }
        } catch (contractError) {
          console.error(`❌ [DEBUG] Error processing test contract ${contract.noticeId}:`, contractError.message);
          errorCount++;
        }
      }

      // Create processing job for tracking
      const job = await prisma.indexingJob.create({
        data: {
          jobType: 'queue_processing',
          status: 'running',
          startDate: new Date()
        }
      });

      console.log(`✅ [DEBUG] Created TEST processing job: ${job.id}`);

      // Respond immediately with job info
      res.json({
        success: true,
        message: `🧪 TEST MODE: Started processing ${queuedCount} test documents (cost-effective mode)`,
        job_id: job.id,
        documents_count: queuedCount,
        test_mode: true,
        cost_impact: 'MINIMAL',
        processing_method: 'test_mode_sequential',
        queued_count: queuedCount,
        skipped_count: skippedCount,
        error_count: errorCount
      });

      // Process test documents sequentially (not in parallel) to minimize costs
      processTestDocumentsSequentially(await prisma.documentProcessingQueue.findMany({
        where: { 
          status: 'queued',
          filename: { startsWith: 'TEST_' }
        },
        orderBy: { queuedAt: 'asc' }
      }), job.id);

      return; // Exit early for test mode
    }

    // REGULAR PROCESSING MODE (for larger limits)
    console.log('🔄 [DEBUG] Using REGULAR PROCESSING MODE for large-scale processing');

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

            // Check if document was already downloaded locally
            const downloadPath = path.join(process.cwd(), 'downloaded_documents');
            const possibleLocalFiles = await fs.readdir(downloadPath).catch(() => []);
            const localFile = possibleLocalFiles.find(file => 
              file.includes(contract.noticeId) && 
              (file.includes(originalFilename.replace(/\.[^/.]+$/, '')) || file.includes('document'))
            );
            
            const localFilePath = localFile ? path.join(downloadPath, localFile) : null;
            
            if (localFilePath) {
              console.log(`📁 [DEBUG] Found local file for document: ${localFile}`);
            }

            // Add to queue (filename will be corrected during processing)
            await prisma.documentProcessingQueue.create({
              data: {
                contractNoticeId: contract.noticeId,
                documentUrl: docUrl,
                localFilePath: localFilePath,
                description: `${contract.title || 'Untitled'} - ${contract.agency || 'Unknown Agency'}`,
                filename: filename,
                status: 'queued',
                queuedAt: new Date(),
                retryCount: 0,
                maxRetries: 3
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
      where: { status: 'queued', localFilePath: { not: null } },
      take: limit,
      orderBy: { queuedAt: 'asc' }
    });

    if (queuedDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No downloaded documents are ready to process',
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

    const processingConcurrency = Math.max(1, Math.min(10, Number(concurrency) || 5));

    // Respond immediately and start background processing
    res.json({
      success: true,
      message: `Started processing all ${queuedDocs.length} downloaded documents with ${processingConcurrency} workers`,
      job_id: job.id,
      documents_count: queuedDocs.length,
      concurrency: processingConcurrency,
      processing_method: 'bounded_parallel_processing'
    });

    processDocumentsInParallel(queuedDocs, processingConcurrency, job.id);

  } catch (error) {
    console.error('❌ [DEBUG] Document processing failed:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to process test documents with higher concurrency
async function processTestDocumentsSequentially(documents, jobId) {
  console.log(`🧪 [DEBUG] Processing ${documents.length} TEST documents with CONCURRENCY=20 (cost-effective mode)`);
  
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process documents with concurrency of 20 instead of sequentially
  const concurrency = Math.min(20, documents.length);
  console.log(`🧪 [DEBUG] Using concurrency: ${concurrency}`);

  // Process single document
  const processDocument = async (doc) => {
    try {
      console.log(`🧪 [DEBUG] Processing TEST document: ${doc.filename}`);
      
      // Update status to processing
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
          console.log(`⚠️ [DEBUG] Test document record ${doc.id} no longer exists, skipping`);
          return { success: false, filename: doc.filename, error: 'Record not found' };
        }
        throw updateError;
      }

      const documentId = `${doc.contractNoticeId}_${doc.filename}`;
      
      // Check if document is already indexed in vector database
      const existingDocs = await vectorService.searchDocuments(documentId, 1);
      
      if (existingDocs.length > 0 && existingDocs[0].metadata.id === documentId) {
        console.log(`🧪 [DEBUG] Test document already indexed, using cached: ${documentId}`);
        
        try {
          await prisma.documentProcessingQueue.update({
            where: { id: doc.id },
            data: {
              status: 'completed',
              processedData: JSON.stringify({ 
                cached: true, 
                content: existingDocs[0].document,
                source: 'vector_database',
                testMode: true
              }),
              completedAt: new Date()
            }
          });
        } catch (updateError) {
          if (updateError.code === 'P2025') {
            console.log(`⚠️ [DEBUG] Test document record ${doc.id} was deleted`);
            return { success: false, filename: doc.filename, error: 'Record deleted during caching' };
          }
          throw updateError;
        }

        skippedCount++;
        console.log(`🧪 [DEBUG] ✅ Test document cached successfully: ${doc.filename}`);
        return { success: true, filename: doc.filename, cached: true };
      } else {
        // Process document via summarization service
        console.log(`🧪 [DEBUG] 💰 COST ALERT: Sending test document to summarization service`);
        
        // First, try to find the downloaded file in the downloaded_documents folder
        const downloadPath = path.join(process.cwd(), 'downloaded_documents');
        let localFilePath = null;
        
        try {
          const downloadedFiles = await fs.readdir(downloadPath);
          // Look for files that match this contract ID
          const matchingFile = downloadedFiles.find(file => 
            file.includes(doc.contractNoticeId) && 
            (file.toLowerCase().endsWith('.pdf') || 
             file.toLowerCase().endsWith('.doc') || 
             file.toLowerCase().endsWith('.docx') ||
             file.toLowerCase().endsWith('.xls') ||
             file.toLowerCase().endsWith('.xlsx') ||
             file.toLowerCase().endsWith('.ppt') ||
             file.toLowerCase().endsWith('.pptx'))
          );
          
          if (matchingFile) {
            localFilePath = path.join(downloadPath, matchingFile);
            console.log(`🧪 [DEBUG] ✅ Found downloaded file: ${matchingFile}`);
          }
        } catch (error) {
          console.log(`🧪 [DEBUG] ⚠️ Could not check downloaded files: ${error.message}`);
        }
        
        // Use local file if found, otherwise use the stored localFilePath, otherwise use URL
        let filePathToProcess;
        
        if (localFilePath && await fs.pathExists(localFilePath)) {
          filePathToProcess = localFilePath;
          console.log(`🧪 [DEBUG] ✅ Using found local file: ${localFilePath}`);
        } else if (doc.localFilePath && await fs.pathExists(doc.localFilePath)) {
          filePathToProcess = doc.localFilePath;
          console.log(`🧪 [DEBUG] ✅ Using stored local file path: ${doc.localFilePath}`);
        } else {
          filePathToProcess = doc.documentUrl;
          console.log(`🧪 [DEBUG] ⚠️ No local file found, will download from URL: ${doc.documentUrl}`);
        }
        
        console.log(`🧪 [DEBUG] Processing file: ${filePathToProcess}`);
        
        const result = await summarizeContent(
          filePathToProcess,
          doc.filename || 'test_document'
        );

        if (result) {
          const finalFilename = result.correctedFilename || doc.filename;
          
          // Check if record still exists
          const existingRecord = await prisma.documentProcessingQueue.findUnique({
            where: { id: doc.id }
          });

          if (!existingRecord) {
            console.log(`⚠️ [DEBUG] Test document record ${doc.id} no longer exists`);
            return { success: false, filename: doc.filename, error: 'Record not found' };
          }

          // Update filename if changed
          if (finalFilename !== doc.filename) {
            console.log(`🧪 [DEBUG] Updating test filename from ${doc.filename} to ${finalFilename}`);
            try {
              await prisma.documentProcessingQueue.update({
                where: { id: doc.id },
                data: { filename: finalFilename }
              });
            } catch (updateError) {
              console.log(`⚠️ [DEBUG] Failed to update test filename: ${updateError.message}`);
            }
          }

          // Index the processed document
          await vectorService.indexDocument({
            filename: finalFilename,
            content: result.content || result.text || JSON.stringify(result),
            processedData: { ...result, testMode: true }
          }, doc.contractNoticeId);

          // Update status to completed
          try {
            await prisma.documentProcessingQueue.update({
              where: { id: doc.id },
              data: {
                status: 'completed',
                processedData: JSON.stringify({ ...result, testMode: true }),
                completedAt: new Date()
              }
            });
          } catch (updateError) {
            if (updateError.code === 'P2025') {
              console.log(`⚠️ [DEBUG] Test document record ${doc.id} was deleted during processing`);
              return { success: false, filename: doc.filename, error: 'Record deleted during processing' };
            }
            throw updateError;
          }

          successCount++;
          console.log(`🧪 [DEBUG] ✅ Test document processed successfully: ${doc.filename}`);
          return { success: true, filename: finalFilename, cached: false };
        } else {
          throw new Error('No result from summarization service');
        }
      }

    } catch (error) {
      console.error(`🧪 [DEBUG] ❌ Error processing test document ${doc.filename}:`, error.message);
      
      // Update status to failed
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
          console.log(`⚠️ [DEBUG] Test document record ${doc.id} was deleted`);
        }
      }

      errorCount++;
      return { success: false, filename: doc.filename, error: error.message };
    } finally {
      processedCount++;
    }
  };

  // Process documents in batches with concurrency
  const batchSize = concurrency;
  const batches = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push(documents.slice(i, i + batchSize));
  }

  console.log(`🧪 [DEBUG] Processing ${documents.length} documents in ${batches.length} batches of ${batchSize}`);

  // Process each batch in parallel
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`🧪 [DEBUG] Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} documents`);
    
    const batchPromises = batch.map(doc => processDocument(doc));
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Process batch results
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const value = result.value;
        if (value?.success) {
          if (value.cached) {
            skippedCount++;
          } else {
            successCount++;
          }
        } else {
          errorCount++;
        }
      } else {
        console.error(`🧪 [DEBUG] Batch ${batchIndex + 1} document ${index + 1} rejected:`, result.reason);
        errorCount++;
      }
    });
    
    console.log(`🧪 [DEBUG] Batch ${batchIndex + 1} completed - Progress: ${processedCount}/${documents.length} - Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);
    
    // Small delay between batches
    if (batchIndex < batches.length - 1) {
      console.log(`🧪 [DEBUG] Waiting 1 second before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Update job status
  try {
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: errorCount > 0 ? 'completed_with_errors' : 'completed',
        recordsProcessed: successCount,
        errorsCount: errorCount,
        completedAt: new Date()
      }
    });

    console.log(`🧪 [DEBUG] ========================================`);
    console.log(`🧪 [DEBUG] TEST BED PROCESSING COMPLETED!`);
    console.log(`🧪 [DEBUG] ========================================`);
    console.log(`🧪 [DEBUG] 📊 Total processed: ${processedCount}`);
    console.log(`🧪 [DEBUG] ✅ Success: ${successCount}`);
    console.log(`🧪 [DEBUG] ❌ Errors: ${errorCount}`);
    console.log(`🧪 [DEBUG] ⏭️  Skipped: ${skippedCount}`);
    console.log(`🧪 [DEBUG] 💰 Cost impact: MINIMAL (only ${successCount} API calls)`);
    console.log(`🧪 [DEBUG] ========================================`);
  } catch (updateError) {
    console.error('🧪 [DEBUG] Error updating test job status:', updateError);
  }
}

// Optimized parallel document processing with proper concurrency
async function processDocumentsInParallel(documents, concurrency, jobId) {
  console.log(`🚀 [OPTIMIZED] Starting parallel processing: ${documents.length} documents, concurrency: ${concurrency}`);
  
  let successCount = 0;
  let errorCount = 0;
  let processedCount = 0;

  // Process single document with full pipeline parallelization
  const processDocument = async (doc) => {
    const startTime = Date.now();
    
    try {
      // Quick status update
      await prisma.documentProcessingQueue.update({
        where: { id: doc.id },
        data: { status: 'processing', startedAt: new Date() }
      });

      // Use the exact file path from the queue entry
      let filePath = doc.localFilePath;
      console.log(`📁 [DEBUG] Processing queue entry ${doc.id}: ${doc.filename}`);
      console.log(`📁 [DEBUG] Expected file path: ${filePath}`);
      
      // Verify the file exists at the specified path
      if (!filePath || !await fs.pathExists(filePath)) {
        console.error(`❌ [DEBUG] File not found at expected path: ${filePath}`);
        console.log(`🔍 [DEBUG] Searching for file in download directory...`);
        
        const downloadPath = path.join(process.cwd(), 'downloaded_documents');
        const files = await fs.readdir(downloadPath).catch(() => []);
        
        // Look for exact filename match first
        let matchingFile = files.find(file => file === doc.filename);
        
        if (!matchingFile) {
          // Fallback to partial match
          matchingFile = files.find(file => 
            file.includes(doc.contractNoticeId) && 
            (file.toLowerCase().endsWith('.pdf') || file.toLowerCase().endsWith('.docx'))
          );
        }
        
        if (matchingFile) {
          filePath = path.join(downloadPath, matchingFile);
          console.log(`✅ [DEBUG] Found file: ${matchingFile} at ${filePath}`);
        } else {
          console.error(`❌ [DEBUG] No matching file found for ${doc.filename}`);
        }
      } else {
        console.log(`✅ [DEBUG] File verified at: ${filePath}`);
      }
      
      if (!filePath) {
        throw new Error('No file found');
      }
      
      // PARALLEL PIPELINE: Start all operations simultaneously
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout (3min)')), 180000);
      });
      
      const processingPromise = (async () => {
        // Step 1: Check if conversion needed and start it immediately
        const fileExt = path.extname(filePath).toLowerCase();
        let conversionPromise = Promise.resolve(filePath); // Default to original file
        
        if (fileExt !== '.pdf') {
          console.log(`🔄 Starting PDF conversion in parallel: ${doc.filename}`);
          conversionPromise = (async () => {
            const LibreOfficeService = require('../services/libreoffice.service');
            const libreOfficeService = new LibreOfficeService();
            
            const tempDir = path.join(process.cwd(), 'temp_parallel_conversion', `${Date.now()}_${doc.id}`);
            await fs.ensureDir(tempDir);
            
            try {
              await libreOfficeService.convertToPdfWithRetry(filePath, tempDir);
              const files = await fs.readdir(tempDir);
              const pdfFile = files.find(file => file.toLowerCase().endsWith('.pdf'));
              
              if (pdfFile) {
                return path.join(tempDir, pdfFile);
              } else {
                throw new Error('No PDF file found after conversion');
              }
            } catch (error) {
              await fs.remove(tempDir).catch(() => {});
              throw new Error(`PDF conversion failed: ${error.message}`);
            }
          })();
        }
        
        // Step 2: Wait for conversion to complete, then start extraction and summarization in parallel
        const pdfPath = await conversionPromise;
        console.log(`📄 PDF ready, starting parallel extraction and analysis: ${doc.filename}`);
        
        // Start extraction immediately
        const extractionPromise = (async () => {
          const pdfService = require('../services/summaryService.js');
          const result = await pdfService.processPDF(pdfPath, {
            apiKey: process.env.OPENROUTER_API_KEY,
            saveExtracted: false,
            outputDir: null
          });
          return result;
        })();
        
        // Wait for extraction, then start summarization
        const extractResult = await extractionPromise;
        
        if (!extractResult.success) {
          throw new Error(`PDF extraction failed: ${extractResult.error}`);
        }
        
        console.log(`✅ Extraction completed, starting summarization: ${doc.filename}`);
        
        // Start summarization
        const summaryPromise = (async () => {
          const pdfService = require('../services/summaryService.js');
          return await pdfService.summarizeContent(
            extractResult.extractedContent,
            process.env.OPENROUTER_API_KEY
          );
        })();
        
        // Wait for summarization
        const summaryResult = await summaryPromise;
        
        if (!summaryResult.success) {
          throw new Error(`Summarization failed: ${summaryResult.error}`);
        }
        
        // Clean up temp conversion files
        if (fileExt !== '.pdf' && pdfPath.includes('temp_parallel_conversion')) {
          try {
            const tempDir = path.dirname(pdfPath);
            await fs.remove(tempDir);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        
        const summary = summaryResult.result;
        const result = {
          ...(summary && typeof summary === 'object' ? summary : { summary: String(summary || '') }),
          extractedText: extractResult.extractedContent,
          extractionMethod: extractResult.method,
          extractedWordCount: extractResult.wordCount
        };
        
        // Step 3: Start final operations in parallel
        await Promise.all([
          // Index in vector database
          vectorService.indexDocument({
            filename: doc.filename,
            content: result.extractedText,
            processedData: result
          }, doc.contractNoticeId),
          
          // Update database status
          prisma.documentProcessingQueue.update({
            where: { id: doc.id },
            data: {
              status: 'completed',
              processedData: JSON.stringify(result),
              completedAt: new Date()
            }
          })
        ]);
        
        return result;
      })();
      
      await Promise.race([processingPromise, timeoutPromise]);
      
      successCount++;
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ ${++processedCount}/${documents.length} (${duration}s): ${doc.filename}`);
      
      return { success: true, filename: doc.filename };

    } catch (error) {
      errorCount++;
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`❌ ${++processedCount}/${documents.length} (${duration}s): ${doc.filename} - ${error.message}`);
      
      // Quick failure update
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
        // Ignore update errors to keep processing fast
      }
      
      return { success: false, filename: doc.filename, error: error.message };
    }
  };

  // Process in true parallel batches
  const batchSize = Math.min(concurrency, 10); // Max 10 concurrent
  const batches = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push(documents.slice(i, i + batchSize));
  }

  console.log(`📦 Processing ${documents.length} documents in ${batches.length} batches of ${batchSize}`);

  // Process all batches
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`🔄 Batch ${batchIndex + 1}/${batches.length}: ${batch.length} documents`);
    
    // Process batch in parallel
    const batchPromises = batch.map(doc => processDocument(doc));
    await Promise.allSettled(batchPromises);
    
    // Brief pause between batches
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Update job status
  try {
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: errorCount > 0 ? 'completed_with_errors' : 'completed',
        recordsProcessed: successCount,
        errorsCount: errorCount,
        completedAt: new Date()
      }
    });

    console.log(`🎉 COMPLETED: ${successCount} success, ${errorCount} errors, ${documents.length} total`);
  } catch (updateError) {
    console.error('❌ Error updating job status:', updateError);
  }
  
  return {
    success: true,
    processed: documents.length,
    successCount,
    errorCount
  };
}

console.log('🔄 [DEBUG] Document processing router module loaded successfully');
module.exports = router;
