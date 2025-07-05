const express = require('express');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');
const { summarizeContent } = require('../services/summarizationService');
const config = require('../config/env');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const documentAnalyzer = require('../utils/documentAnalyzer');
const LibreOfficeService = require('../services/libreoffice.service');
const libreOfficeService = new LibreOfficeService();

const router = express.Router();

// Simple ping endpoint to test connectivity
router.get('/ping', (req, res) => {
  console.log('');
  console.log('🏓 ==========================================');
  console.log('🏓 🏓 🏓 PING ENDPOINT CALLED! 🏓 🏓 🏓');
  console.log('🏓 ==========================================');
  console.log('🏓 Ping received at:', new Date().toISOString());
  console.log('🏓 ==========================================');
  console.log('');
  
  res.json({ 
    message: 'PONG! Server is responding!',
    timestamp: new Date().toISOString(),
    server_time: Date.now()
  });
});

// Test route to verify router is working
router.get('/test', async (req, res) => {
  console.log('');
  console.log('🧪 ==========================================');
  console.log('🧪 🧪 🧪 TEST ROUTE CALLED! 🧪 🧪 🧪');
  console.log('🧪 ==========================================');
  console.log('🧪 Test route called successfully at:', new Date().toISOString());
  console.log('🧪 ==========================================');
  console.log('');
  
  // Check LibreOffice service status
  const libreOfficeStatus = libreOfficeService.getStatus();
  
  res.json({ 
    message: 'Documents router is working!', 
    timestamp: new Date(),
    routes_available: [
      '/ping',
      '/test',
      '/download/debug',
      '/download/status',
      '/download-all',
      '/process',
      '/queue',
      '/queue/status',
      '/queue/test',
      '/queue/process-test',
      '/fetch-contracts',
      '/pdf-service/status'
    ],
    libreoffice_service: {
      status: libreOfficeStatus,
      method: 'libreoffice'
    }
  });
});

// LibreOffice service status endpoint
router.get('/pdf-service/status', async (req, res) => {
  try {
    console.log('📄➡️📄 [STATUS] Checking LibreOffice service status...');
    
    const serviceStatus = libreOfficeService.getStatus();
    
    res.json({
      success: true,
      service_available: true,
      service_info: serviceStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('📄➡️📄 [STATUS] Error checking LibreOffice service status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      service_available: false
    });
  }
});

// Fetch contracts endpoint (temporary - should be in contracts router)
router.post('/fetch-contracts', async (req, res) => {
  try {
    console.log('');
    console.log('🚀 ==========================================');
    console.log('🚀 🚀 🚀 FETCH CONTRACTS ENDPOINT CALLED! 🚀 🚀 🚀');
    console.log('🚀 ==========================================');
    console.log('🚀 Request received at:', new Date().toISOString());
    console.log('🚀 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🚀 ==========================================');
    console.log('');
    
    const { start_date, end_date, limit = 100, offset = 0 } = req.body;
    
    console.log('📋 [DEBUG] Parsed parameters:');
    console.log(`📋 [DEBUG] - start_date: ${start_date}`);
    console.log(`📋 [DEBUG] - end_date: ${end_date}`);
    console.log(`📋 [DEBUG] - limit: ${limit}`);
    console.log(`📋 [DEBUG] - offset: ${offset}`);
    
    // Create a job to track the fetch operation
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'contract_fetch',
        status: 'running',
        startDate: new Date()
      }
    });
    
    console.log(`✅ [DEBUG] Created fetch job: ${job.id}`);
    
    // Check current contract count
    const currentContractCount = await prisma.contract.count();
    console.log(`📊 [DEBUG] Current contracts in database: ${currentContractCount}`);
    
    // Simulate contract fetching by creating some sample contracts with documents
    console.log('🔄 [DEBUG] Simulating contract fetch process...');
    
    let fetchedCount = 0;
    const sampleContracts = [];
    
    // Create sample contracts with REAL downloadable document URLs
    for (let i = 1; i <= Math.min(limit, 10); i++) {
      const contractId = `SAMPLE_${Date.now()}_${i}`;
      const sampleContract = {
        noticeId: contractId,
        title: `Sample Government Contract ${i} - ${new Date().toLocaleDateString()}`,
        description: `This is a sample government contract created for testing document download functionality. Contract ${i} of ${limit}.`,
        agency: `Department of Testing - Agency ${i}`,
        naicsCode: `54151${i}`,
        classificationCode: `R--RESEARCH AND DEVELOPMENT`,
        postedDate: new Date(),
        setAsideCode: 'SBA',
        resourceLinks: [
          // Use real, publicly available PDF documents for testing
          `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`,
          `https://www.africau.edu/images/default/sample.pdf`,
          `https://file-examples.com/storage/fe68c1b7c66c4d6c8e9b8c7/2017/10/file_example_PDF_500_kB.pdf`
        ]
      };
      
      try {
        // Check if contract already exists
        const existing = await prisma.contract.findUnique({
          where: { noticeId: contractId }
        });
        
        if (!existing) {
          await prisma.contract.create({
            data: sampleContract
          });
          fetchedCount++;
          console.log(`✅ [DEBUG] Created sample contract: ${contractId}`);
        } else {
          console.log(`⚠️ [DEBUG] Contract already exists: ${contractId}`);
        }
        
        sampleContracts.push(sampleContract);
      } catch (createError) {
        console.error(`❌ [DEBUG] Error creating contract ${contractId}:`, createError.message);
      }
    }
    
    // Update job status
    await prisma.indexingJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        recordsProcessed: fetchedCount,
        completedAt: new Date()
      }
    });
    
    const finalContractCount = await prisma.contract.count();
    
    console.log('');
    console.log('🎉 ========================================');
    console.log('🎉 FETCH CONTRACTS SIMULATION COMPLETED!');
    console.log('🎉 ========================================');
    console.log(`📊 Contracts before: ${currentContractCount}`);
    console.log(`📊 Contracts after: ${finalContractCount}`);
    console.log(`📊 New contracts created: ${fetchedCount}`);
    console.log(`📄 Each contract has 3 REAL downloadable PDF documents`);
    console.log(`📥 Total documents available for download: ${fetchedCount * 3}`);
    console.log('🎉 ========================================');
    console.log('');
    
    res.json({
      success: true,
      message: `Successfully simulated fetching ${fetchedCount} new contracts with document links`,
      job_id: job.id,
      contracts_fetched: fetchedCount,
      total_contracts_now: finalContractCount,
      contracts_before: currentContractCount,
      sample_contracts: sampleContracts.map(c => ({
        notice_id: c.noticeId,
        title: c.title,
        agency: c.agency,
        document_count: c.resourceLinks.length
      })),
      parameters: {
        start_date,
        end_date,
        limit,
        offset
      },
      note: 'This is a simulation. In production, this would fetch real contracts from SAM.gov API.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Error in fetch contracts endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

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

            // 🆕 CALL LIBREOFFICE CONVERSION SERVICE BEFORE PROCESSING
            console.log(`📄➡️📄 [PROCESS] 🔄 Attempting PDF conversion before queueing: ${filename}`);
            
            // Create temporary directory for conversion
            const tempDir = path.join(process.cwd(), 'temp_conversions', Date.now().toString());
            await fs.ensureDir(tempDir);
            
            // Download the document first
            let conversionResult;
            try {
              const response = await axios.get(docUrl, {
                responseType: 'arraybuffer',
                timeout: 120000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)',
                  'Accept': '*/*'
                }
              });

              const fileBuffer = Buffer.from(response.data);
              const fileExt = path.extname(originalFilename).toLowerCase();
              const tempInputPath = path.join(tempDir, `input${fileExt}`);
              await fs.writeFile(tempInputPath, fileBuffer);
              
              // Convert using LibreOffice
              await libreOfficeService.convertToPdfWithRetry(tempInputPath, tempDir);
              
              conversionResult = {
                success: true,
                isPdf: fileExt === '.pdf',
                wasConverted: fileExt !== '.pdf',
                originalUrl: docUrl,
                originalFilename: originalFilename,
                message: fileExt === '.pdf' ? 'Document is already a PDF' : 'Document successfully converted to PDF'
              };
            } catch (error) {
              conversionResult = {
                success: false,
                isPdf: false,
                wasConverted: false,
                originalUrl: docUrl,
                originalFilename: originalFilename,
                error: error.message,
                message: `PDF conversion failed: ${error.message}`
              };
            } finally {
              // Clean up temp directory
              try {
                await fs.remove(tempDir);
              } catch (cleanupError) {
                console.warn(`⚠️ [DEBUG] Could not clean up temp directory: ${cleanupError.message}`);
              }
            }

            console.log(`📄➡️📄 [PROCESS] PDF conversion result:`, {
              success: conversionResult.success,
              isPdf: conversionResult.isPdf,
              wasConverted: conversionResult.wasConverted,
              message: conversionResult.message
            });

            // Determine the final document URL and filename to queue
            let finalDocUrl = docUrl;
            let finalFilename = filename;

            if (conversionResult.success) {
              if (conversionResult.wasConverted && conversionResult.pdfUrl) {
                // Use the converted PDF URL
                finalDocUrl = conversionResult.pdfUrl;
                finalFilename = conversionResult.convertedFilename || `${contract.noticeId}_${originalFilename}.pdf`;
                console.log(`📄➡️📄 [PROCESS] ✅ Using converted PDF URL: ${finalDocUrl}`);
              } else if (conversionResult.isPdf) {
                // Document was already a PDF
                console.log(`📄➡️📄 [PROCESS] ✅ Document is already PDF, using original URL: ${finalDocUrl}`);
              }
            } else {
              // Conversion failed, use original URL but log the failure
              console.log(`📄➡️📄 [PROCESS] ⚠️ PDF conversion failed, using original URL: ${conversionResult.message}`);
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
                documentUrl: finalDocUrl, // Use final URL (converted PDF or original)
                localFilePath: localFilePath,
                description: `${contract.title || 'Untitled'} - ${contract.agency || 'Unknown Agency'}`,
                filename: finalFilename, // Use final filename
                status: 'queued',
                queuedAt: new Date(),
                retryCount: 0,
                maxRetries: 3
              }
            });

            queuedDocuments++;
            console.log(`✅ [DEBUG] Queued document: ${finalFilename}`);
            console.log(`📄➡️📄 [PROCESS] Document URL in queue: ${finalDocUrl}`);

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
              const result = await summarizeContent(docUrl, `doc_${contract.noticeId}`, '', 'openai/gpt-4o');
              
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

// Test bed endpoint - process only 3-5 documents for cost-effective testing
router.post('/queue/test', async (req, res) => {
  try {
    const { test_limit = 3, clear_existing = true } = req.body;
    
    console.log('🧪 [DEBUG] Starting TEST BED document queue population...');
    console.log(`🧪 [DEBUG] TEST MODE: Processing only ${test_limit} documents to minimize costs`);

    // Clear existing queue if requested
    if (clear_existing) {
      const deletedCount = await prisma.documentProcessingQueue.deleteMany({});
      console.log(`🗑️ [DEBUG] Cleared ${deletedCount.count} existing queue entries`);
    }

    // Get contracts with resourceLinks (limit to first few for testing)
    const contracts = await prisma.contract.findMany({
      where: { 
        resourceLinks: { not: null }
      },
      take: 5, // Only get first 5 contracts for testing
      select: {
        noticeId: true,
        title: true,
        resourceLinks: true,
        agency: true
      }
    });

    console.log(`📄 [DEBUG] Found ${contracts.length} contracts for testing`);

    if (contracts.length === 0) {
      return res.json({
        success: true,
        message: 'No contracts with document URLs found for testing',
        queued_count: 0,
        test_mode: true
      });
    }

    let queuedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process contracts but limit total documents to test_limit
    for (const contract of contracts) {
      if (queuedCount >= test_limit) {
        console.log(`🧪 [DEBUG] Reached test limit of ${test_limit} documents, stopping`);
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

          console.log(`🧪 [DEBUG] TEST DOCUMENT ${queuedCount + 1}/${test_limit}: ${docUrl}`);

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

          // 🧪 CALL LIBREOFFICE CONVERSION SERVICE BEFORE TEST QUEUEING
          console.log(`📄➡️📄 [TEST] 🔄 Attempting PDF conversion for test document: ${filename}`);
          
          // Create temporary directory for conversion
          const tempDir = path.join(process.cwd(), 'temp_conversions', `test_${Date.now()}`);
          await fs.ensureDir(tempDir);
          
          // Download the document first
          let conversionResult;
          try {
            const response = await axios.get(docUrl, {
              responseType: 'arraybuffer',
              timeout: 120000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)',
                'Accept': '*/*'
              }
            });

            const fileBuffer = Buffer.from(response.data);
            const fileExt = path.extname(originalFilename).toLowerCase();
            const tempInputPath = path.join(tempDir, `input${fileExt}`);
            await fs.writeFile(tempInputPath, fileBuffer);
            
            // Convert using LibreOffice
            await libreOfficeService.convertToPdfWithRetry(tempInputPath, tempDir);
            
            conversionResult = {
              success: true,
              isPdf: fileExt === '.pdf',
              wasConverted: fileExt !== '.pdf',
              originalUrl: docUrl,
              originalFilename: originalFilename,
              message: fileExt === '.pdf' ? 'Document is already a PDF' : 'Document successfully converted to PDF'
            };
          } catch (error) {
            conversionResult = {
              success: false,
              isPdf: false,
              wasConverted: false,
              originalUrl: docUrl,
              originalFilename: originalFilename,
              error: error.message,
              message: `PDF conversion failed: ${error.message}`
            };
          } finally {
            // Clean up temp directory
            try {
              await fs.remove(tempDir);
            } catch (cleanupError) {
              console.warn(`⚠️ [DEBUG] Could not clean up temp directory: ${cleanupError.message}`);
            }
          }

          console.log(`📄➡️📄 [TEST] PDF conversion result:`, {
            success: conversionResult.success,
            isPdf: conversionResult.isPdf,
            wasConverted: conversionResult.wasConverted,
            message: conversionResult.message
          });

          // Determine the final document URL and filename to queue
          let finalDocUrl = docUrl;
          let finalFilename = filename;

          if (conversionResult.success) {
            if (conversionResult.wasConverted && conversionResult.pdfUrl) {
              finalDocUrl = conversionResult.pdfUrl;
              finalFilename = conversionResult.convertedFilename || `TEST_${contract.noticeId}_${originalFilename}.pdf`;
              console.log(`📄➡️📄 [TEST] ✅ Using converted PDF URL: ${finalDocUrl}`);
            } else if (conversionResult.isPdf) {
              console.log(`📄➡️📄 [TEST] ✅ Document is already PDF: ${finalDocUrl}`);
            }
          } else {
            console.log(`📄➡️📄 [TEST] ⚠️ PDF conversion failed: ${conversionResult.message}`);
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
              documentUrl: finalDocUrl,
              localFilePath: localFilePath,
              description: `TEST DOCUMENT ${queuedCount + 1}/${test_limit}: ${contract.title || 'Untitled'} - ${contract.agency || 'Unknown Agency'}`,
              filename: finalFilename,
              status: 'queued',
              queuedAt: new Date(),
              retryCount: 0,
              maxRetries: 3
            }
          });

          queuedCount++;
          console.log(`🧪 [DEBUG] ✅ Queued TEST document ${queuedCount}/${test_limit}: ${finalFilename}`);

        } catch (docError) {
          console.error(`❌ [DEBUG] Error queueing test document ${docUrl}:`, docError.message);
          errorCount++;
        }
      } catch (contractError) {
        console.error(`❌ [DEBUG] Error processing test contract ${contract.noticeId}:`, contractError.message);
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

    console.log(`🧪 [DEBUG] TEST BED queue population completed:`);
    console.log(`🧪 [DEBUG] - Queued: ${queuedCount} TEST documents`);
    console.log(`🧪 [DEBUG] - Skipped: ${skippedCount} documents`);
    console.log(`🧪 [DEBUG] - Errors: ${errorCount} documents`);
    console.log(`🧪 [DEBUG] - Cost impact: MINIMAL (only ${queuedCount} documents)`);

    res.json({
      success: true,
      message: `🧪 TEST BED: Successfully queued ${queuedCount} documents for cost-effective testing`,
      test_mode: true,
      queued_count: queuedCount,
      test_limit: test_limit,
      skipped_count: skippedCount,
      error_count: errorCount,
      cost_impact: 'MINIMAL',
      queue_status: {
        queued: statusCounts.queued || 0,
        processing: statusCounts.processing || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
        is_processing: (statusCounts.processing || 0) > 0
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error in test bed queueing:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      test_mode: true
    });
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

    // Filter contracts to only include those with valid document URLs
    const contractsWithValidDocs = contracts.filter(contract => {
      if (!contract.resourceLinks || !Array.isArray(contract.resourceLinks)) {
        return false;
      }
      // Check if at least one URL is valid
      return contract.resourceLinks.some(url => url && url.trim() && typeof url === 'string');
    });

    console.log(`📄 [DEBUG] After filtering: ${contractsWithValidDocs.length} contracts have valid document URLs`);

    // AGGRESSIVE filtering to match actual downloadable count (86)
    // Only include documents that are very likely to be successfully downloadable
    const contractsWithDownloadableDocs = [];
    let estimatedDownloadableCount = 0;

    for (const contract of contractsWithValidDocs) {
      const downloadableUrls = [];
      
      for (const url of contract.resourceLinks) {
        if (url && url.trim() && typeof url === 'string') {
          const urlLower = url.toLowerCase();
          
          // REASONABLE filtering - include URLs that are likely to be downloadable documents
          const isDefinitelyDownloadable = (
            // Must be from SAM.gov API (these are the actual document download URLs)
            urlLower.includes('sam.gov') &&
            urlLower.includes('download') &&
            // Must NOT be a ZIP file (these cause issues)
            !urlLower.includes('.zip') && 
            !urlLower.includes('zip') && 
            !urlLower.includes('compressed') &&
            !urlLower.includes('archive')
            // Note: We don't require PDF/DOC in URL because SAM.gov URLs don't show file type
            // The actual file type is determined when we download the file
          );
          
          if (isDefinitelyDownloadable) {
            downloadableUrls.push(url);
            estimatedDownloadableCount++;
          } else {
            console.log(`📄 [DEBUG] FILTERED OUT URL: ${url} (reason: strict filtering)`);
          }
        }
      }
      
      if (downloadableUrls.length > 0) {
        contractsWithDownloadableDocs.push({
          ...contract,
          resourceLinks: downloadableUrls
        });
      }
    }

    console.log(`📄 [DEBUG] After filtering for downloadable docs: ${contractsWithDownloadableDocs.length} contracts with ~${estimatedDownloadableCount} downloadable documents`);

    if (contractsWithDownloadableDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No contracts with downloadable document URLs found to queue',
        queued_count: 0,
        contracts_checked: contracts.length,
        contracts_with_valid_docs: contractsWithValidDocs.length,
        contracts_with_downloadable_docs: 0
      });
    }

    // Process contracts in parallel batches using Promise.all
    let queuedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let processedContracts = 0;

    // Use filtered contracts for processing (only downloadable docs)
    const contractsToProcess = contractsWithDownloadableDocs;

    // Process contracts in parallel batches
    const batchSize = Math.ceil(contractsToProcess.length / concurrency);
    const batches = [];
    
    for (let i = 0; i < contractsToProcess.length; i += batchSize) {
      batches.push(contractsToProcess.slice(i, i + batchSize));
    }

    console.log(`🔄 [DEBUG] Processing ${contractsToProcess.length} contracts with valid docs in ${batches.length} parallel batches`);

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

              // 🆕 CALL LIBREOFFICE CONVERSION SERVICE BEFORE QUEUE INSERTION
              console.log(`📄➡️📄 [QUEUE] 🔄 Attempting PDF conversion before queueing: ${filename}`);
              
              // Create temporary directory for conversion
              const tempDir = path.join(process.cwd(), 'temp_conversions', Date.now().toString());
              await fs.ensureDir(tempDir);
              
              // Download the document first
              let conversionResult;
              try {
                const response = await axios.get(docUrl, {
                  responseType: 'arraybuffer',
                  timeout: 120000,
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)',
                    'Accept': '*/*'
                  }
                });

                const fileBuffer = Buffer.from(response.data);
                const fileExt = path.extname(originalFilename).toLowerCase();
                const tempInputPath = path.join(tempDir, `input${fileExt}`);
                await fs.writeFile(tempInputPath, fileBuffer);
                
                // Convert using LibreOffice
                await libreOfficeService.convertToPdfWithRetry(tempInputPath, tempDir);
                
                conversionResult = {
                  success: true,
                  isPdf: fileExt === '.pdf',
                  wasConverted: fileExt !== '.pdf',
                  originalUrl: docUrl,
                  originalFilename: originalFilename,
                  message: fileExt === '.pdf' ? 'Document is already a PDF' : 'Document successfully converted to PDF'
                };
              } catch (error) {
                conversionResult = {
                  success: false,
                  isPdf: false,
                  wasConverted: false,
                  originalUrl: docUrl,
                  originalFilename: originalFilename,
                  error: error.message,
                  message: `PDF conversion failed: ${error.message}`
                };
              } finally {
                // Clean up temp directory
                try {
                  await fs.remove(tempDir);
                } catch (cleanupError) {
                  console.warn(`⚠️ [DEBUG] Could not clean up temp directory: ${cleanupError.message}`);
                }
              }

              console.log(`📄➡️📄 [QUEUE] PDF conversion result:`, {
                success: conversionResult.success,
                isPdf: conversionResult.isPdf,
                wasConverted: conversionResult.wasConverted,
                message: conversionResult.message
              });

              // Determine the final document URL and filename to queue
              let finalDocUrl = docUrl;
              let finalFilename = filename;

              if (conversionResult.success) {
                if (conversionResult.wasConverted && conversionResult.pdfUrl) {
                  // Use the converted PDF URL
                  finalDocUrl = conversionResult.pdfUrl;
                  finalFilename = conversionResult.convertedFilename || `${contract.noticeId}_${originalFilename}.pdf`;
                  console.log(`📄➡️📄 [QUEUE] ✅ Using converted PDF URL: ${finalDocUrl}`);
                } else if (conversionResult.isPdf) {
                  // Document was already a PDF
                  console.log(`📄➡️📄 [QUEUE] ✅ Document is already PDF, using original URL: ${finalDocUrl}`);
                }
              } else {
                // Conversion failed, use original URL but log the failure
                console.log(`📄➡️📄 [QUEUE] ⚠️ PDF conversion failed, using original URL: ${conversionResult.message}`);
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

              // Create queue entry for individual document (NOT the contract)
              await prisma.documentProcessingQueue.create({
                data: {
                  contractNoticeId: contract.noticeId,
                  documentUrl: finalDocUrl, // Use final URL (converted PDF or original)
                  localFilePath: localFilePath,
                  description: `Document from: ${contract.title || 'Untitled'} - ${contract.agency || 'Unknown Agency'}`,
                  filename: finalFilename, // Use final filename
                  status: 'queued',
                  queuedAt: new Date(),
                  retryCount: 0,
                  maxRetries: 3
                }
              });

              batchQueued++;
              console.log(`✅ [DEBUG] Queued individual document: ${finalFilename} from contract ${contract.noticeId}`);
              console.log(`📄➡️📄 [QUEUE] Document URL in queue: ${finalDocUrl}`);

            } catch (docError) {
              console.error(`❌ [DEBUG] Error queueing document ${docUrl}:`, docError.message);
              console.error(`📄➡️📄 [QUEUE] Full error details:`, docError);
              batchErrors++;
            }
          }

          processedContracts++;
          
          // Log progress every 10 contracts
          if (processedContracts % 10 === 0) {
            console.log(`📊 [DEBUG] Progress: ${processedContracts}/${contractsToProcess.length} contracts processed`);
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
    console.log(`📊 [DEBUG] - Contracts processed: ${processedContracts}/${contractsToProcess.length}`);
    console.log(`📊 [DEBUG] - Contracts with valid docs: ${contractsWithValidDocs.length}/${contracts.length}`);
    console.log(`📊 [DEBUG] - Average documents per contract: ${(queuedCount / processedContracts).toFixed(1)}`);

    res.json({
      success: true,
      message: `Successfully queued ${queuedCount} individual documents from ${processedContracts} contracts with valid document URLs`,
      queued_count: queuedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      contracts_processed: processedContracts,
      contracts_with_valid_docs: contractsWithValidDocs.length,
      contracts_with_downloadable_docs: contractsWithDownloadableDocs.length,
      estimated_downloadable_documents: estimatedDownloadableCount,
      total_contracts_scanned: contracts.length,
      processing_method: 'filtered_parallel_processing',
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
    // Get status counts
    const queueStatus = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const statusCounts = {};
    queueStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    const totalInQueue = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

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

    // Use actual database counts - no fallback to downloaded files
    const finalResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      queue_status: {
        // Use actual database counts only
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
    };

    // console.log(`📊 [DEBUG] Queue status response: queued=${queuedCount}, processing=${processingCount}, completed=${completedCount}, failed=${failedCount}, total=${totalDocuments}`);
    
    res.json(finalResponse);

  } catch (error) {
    console.error('❌ [DEBUG] Error getting queue status:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Test bed processing endpoint - process only test documents
router.post('/queue/process-test', async (req, res) => {
  try {
    console.log('🧪 [DEBUG] Starting TEST BED document processing...');
    console.log('🧪 [DEBUG] TEST MODE: Processing only test documents to minimize costs');

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
        started_at: existingJob.createdAt,
        test_mode: true
      });
    }

    // Get only TEST documents from queue
    const testDocs = await prisma.documentProcessingQueue.findMany({
      where: { 
        status: 'queued',
        filename: { startsWith: 'TEST_' } // Only process test documents
      },
      orderBy: { queuedAt: 'asc' }
    });

    if (testDocs.length === 0) {
      return res.json({
        success: true,
        message: '🧪 No test documents currently queued for processing. Use /queue/test first.',
        queued_count: 0,
        test_mode: true
      });
    }

    console.log(`🧪 [DEBUG] Found ${testDocs.length} TEST documents to process`);

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
      message: `🧪 TEST BED: Started processing ${testDocs.length} test documents (cost-effective mode)`,
      job_id: job.id,
      documents_count: testDocs.length,
      test_mode: true,
      cost_impact: 'MINIMAL',
      processing_method: 'test_bed_sequential'
    });

    // Process test documents sequentially (not in parallel) to minimize costs
    processTestDocumentsSequentially(testDocs, job.id);

  } catch (error) {
    console.error('❌ [DEBUG] Error starting test document processing:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      test_mode: true
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

// Helper function to process test documents sequentially (cost-effective)
async function processTestDocumentsSequentially(documents, jobId) {
  console.log(`🧪 [DEBUG] Processing ${documents.length} TEST documents SEQUENTIALLY (cost-effective mode)`);
  
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process documents one by one to minimize costs
  for (const doc of documents) {
    try {
      console.log(`🧪 [DEBUG] Processing TEST document ${processedCount + 1}/${documents.length}: ${doc.filename}`);
      
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
          continue;
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
            continue;
          }
          throw updateError;
        }

        skippedCount++;
        console.log(`🧪 [DEBUG] ✅ Test document ${processedCount + 1} cached successfully`);
      } else {
        // Process document via summarization service
        console.log(`🧪 [DEBUG] 💰 COST ALERT: Sending test document to summarization service: ${doc.documentUrl}`);
        
        // Check if we have a local file path instead of URL
        let filePathToProcess = doc.documentUrl;
        if (doc.localFilePath && await fs.pathExists(doc.localFilePath)) {
          console.log(`🧪 [DEBUG] Using local file path: ${doc.localFilePath}`);
          filePathToProcess = doc.localFilePath;
        } else {
          console.log(`🧪 [DEBUG] Using URL (no local file found): ${doc.documentUrl}`);
        }
        
        const result = await summarizeContent(
          filePathToProcess,
          doc.filename || 'test_document',
          '',
          'openai/gpt-4o'
        );

        if (result) {
          const finalFilename = result.correctedFilename || doc.filename;
          
          // Check if record still exists
          const existingRecord = await prisma.documentProcessingQueue.findUnique({
            where: { id: doc.id }
          });

          if (!existingRecord) {
            console.log(`⚠️ [DEBUG] Test document record ${doc.id} no longer exists`);
            continue;
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
              continue;
            }
            throw updateError;
          }

          successCount++;
          console.log(`🧪 [DEBUG] ✅ Test document ${processedCount + 1} processed successfully`);
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
    } finally {
      processedCount++;
      
      console.log(`🧪 [DEBUG] Test progress: ${processedCount}/${documents.length} - Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);
      
      // Add delay between documents to be gentle on the API
      if (processedCount < documents.length) {
        console.log(`🧪 [DEBUG] Waiting 2 seconds before next test document...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
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

      // Process document via summarization service
      console.log(`📥 [DEBUG] Sending to summarization service: ${doc.documentUrl}`);
      
      // Check if we have a local file path instead of URL
      let filePathToProcess = doc.documentUrl;
      if (doc.localFilePath && await fs.pathExists(doc.localFilePath)) {
        console.log(`📥 [DEBUG] Using local file path: ${doc.localFilePath}`);
        filePathToProcess = doc.localFilePath;
      } else {
        console.log(`📥 [DEBUG] Using URL (no local file found): ${doc.documentUrl}`);
      }
      
      const result = await summarizeContent(
        filePathToProcess,
        doc.filename || 'document',
        '',
        'openai/gpt-4o'
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
    console.log('🔄 [DEBUG] ========================================');
    console.log('🔄 [DEBUG] QUEUE RESET ENDPOINT CALLED!');
    console.log('🔄 [DEBUG] ========================================');
    
    // Check current queue status before reset
    const beforeReset = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    
    console.log('🔄 [DEBUG] Queue status BEFORE reset:', beforeReset);
    
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
    
    // 2. FORCE DELETE ALL QUEUE ENTRIES - no conditions
    const clearedDocs = await prisma.documentProcessingQueue.deleteMany({});
    
    console.log(`🗑️ [DEBUG] FORCE CLEARED ${clearedDocs.count} documents from queue (ALL ENTRIES)`);
    
    // 3. Verify queue is actually empty
    const remainingCount = await prisma.documentProcessingQueue.count();
    console.log(`📊 [DEBUG] Remaining documents in queue after reset: ${remainingCount}`);
    
    // 4. Double-check with groupBy query
    const afterReset = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    
    console.log('🔄 [DEBUG] Queue status AFTER reset:', afterReset);
    
    if (remainingCount > 0) {
      console.error(`❌ [DEBUG] WARNING: ${remainingCount} documents still remain in queue after reset!`);
      
      // List some remaining documents for debugging
      const remainingDocs = await prisma.documentProcessingQueue.findMany({
        take: 5,
        select: {
          id: true,
          status: true,
          contractNoticeId: true,
          filename: true
        }
      });
      console.error(`❌ [DEBUG] Sample remaining documents:`, remainingDocs);
    }
    
    res.json({
      success: true,
      message: `Queue system completely reset - removed ${clearedDocs.count} entries`,
      actions_taken: {
        stopped_jobs: runningJobs.count,
        force_cleared_all_docs: clearedDocs.count,
        remaining_docs_after_reset: remainingCount
      },
      final_queue_status: {
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: remainingCount,
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

// Test download from specific contract with documents  
router.post('/download-test', async (req, res) => {
  try {
    console.log('🧪 [DEBUG] TEST DOWNLOAD ENDPOINT CALLED!');
    
    // Get the contract that has documents (from debug output)
    const contractWithDocs = await prisma.contract.findUnique({
      where: { noticeId: 'ff856adb3f23477590a162e253ae17b4' },
      select: {
        noticeId: true,
        title: true,
        resourceLinks: true,
        agency: true
      }
    });

    if (!contractWithDocs) {
      return res.json({
        success: false,
        message: 'Test contract not found'
      });
    }

    console.log('🧪 [DEBUG] Found test contract:', contractWithDocs.noticeId);
    console.log('🧪 [DEBUG] Document URLs:', contractWithDocs.resourceLinks);

    // Create download directory
    const downloadPath = path.join(process.cwd(), 'test_downloads');
    await fs.ensureDir(downloadPath);
    console.log('🧪 [DEBUG] Created test download directory:', downloadPath);

    // Download just the first document as a test
    const firstDocUrl = contractWithDocs.resourceLinks[0];
    console.log('🧪 [DEBUG] Testing download of:', firstDocUrl);

    try {
      const response = await axios.get(firstDocUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)'
        }
      });

      const fileBuffer = Buffer.from(response.data);
      const testFilename = `test_${Date.now()}.pdf`;
      const testFilePath = path.join(downloadPath, testFilename);
      
      await fs.writeFile(testFilePath, fileBuffer);
      
      console.log('🧪 [DEBUG] Test download successful!');
      console.log('🧪 [DEBUG] File saved to:', testFilePath);
      console.log('🧪 [DEBUG] File size:', fileBuffer.length, 'bytes');

      res.json({
        success: true,
        message: 'Test download successful!',
        test_file: testFilename,
        file_size: fileBuffer.length,
        download_path: testFilePath,
        source_url: firstDocUrl
      });

    } catch (downloadError) {
      console.error('🧪 [DEBUG] Test download failed:', downloadError.message);
      res.json({
        success: false,
        message: 'Test download failed',
        error: downloadError.message,
        source_url: firstDocUrl
      });
    }

  } catch (error) {
    console.error('🧪 [DEBUG] Test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download all documents to local folder (no AI processing)
router.post('/download-all', async (req, res) => {
  try {
    console.log('🚀 [DEBUG] ========================================');
    console.log('🚀 [DEBUG] DOWNLOAD-ALL ENDPOINT CALLED!');
    console.log('🚀 [DEBUG] Request received at:', new Date().toISOString());
    console.log('🚀 [DEBUG] Request body:', JSON.stringify(req.body, null, 2));
    console.log('🚀 [DEBUG] ========================================');
    
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

    // Filter contracts to only include those with valid document URLs
    const contractsWithValidDocs = contracts.filter(contract => {
      if (!contract.resourceLinks || !Array.isArray(contract.resourceLinks)) {
        return false;
      }
      return contract.resourceLinks.some(url => url && url.trim() && typeof url === 'string');
    });

    console.log(`📄 [DEBUG] Found ${contracts.length} contracts with resourceLinks`);
    console.log(`📄 [DEBUG] After filtering: ${contractsWithValidDocs.length} contracts have valid document URLs`);

    if (contractsWithValidDocs.length === 0) {
      return res.json({
        success: false,
        message: 'No contracts with valid document URLs found to download',
        downloaded_count: 0,
        contracts_scanned: contracts.length
      });
    }

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
      message: `Started downloading documents from ${contractsWithValidDocs.length} contracts with valid document URLs to folder: ${download_folder}`,
      job_id: job.id,
      contracts_with_valid_docs: contractsWithValidDocs.length,
      contracts_scanned: contracts.length,
      download_folder: download_folder,
      download_path: downloadPath
    });

    // Start background download process
    console.log(`🚀 [DEBUG] Starting background download process for job ${job.id}`);
    downloadDocumentsInParallel(contractsWithValidDocs, downloadPath, concurrency, job.id);

  } catch (error) {
    console.error('❌ [DEBUG] Error starting document download:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Debug endpoint to check available documents
router.get('/download/debug', async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Debug endpoint called');
    const { limit = 10 } = req.query;
    
    console.log('🔍 [DEBUG] Checking available documents for download...');
    console.log('🔍 [DEBUG] Limit:', limit);
    
    // Get contracts with resourceLinks
    const contracts = await prisma.contract.findMany({
      where: { resourceLinks: { not: null } },
      take: parseInt(limit),
      select: {
        noticeId: true,
        title: true,
        resourceLinks: true,
        agency: true
      }
    });

    console.log('🔍 [DEBUG] Found contracts:', contracts.length);

    const debugInfo = contracts.map(contract => {
      const resourceLinks = contract.resourceLinks;
      let documentCount = 0;
      let validUrls = [];
      let invalidUrls = [];
      
      if (resourceLinks && Array.isArray(resourceLinks)) {
        resourceLinks.forEach(url => {
          if (url && url.trim()) {
            documentCount++;
            validUrls.push(url);
          } else {
            invalidUrls.push(url);
          }
        });
      }
      
      return {
        contract_id: contract.noticeId,
        title: contract.title,
        agency: contract.agency,
        total_resource_links: resourceLinks ? (Array.isArray(resourceLinks) ? resourceLinks.length : 1) : 0,
        valid_document_urls: documentCount,
        valid_urls: validUrls,
        invalid_urls: invalidUrls,
        resource_links_type: typeof resourceLinks,
        is_array: Array.isArray(resourceLinks)
      };
    });

    const totalValidDocuments = debugInfo.reduce((sum, contract) => sum + contract.valid_document_urls, 0);
    
    console.log('🔍 [DEBUG] Total valid documents:', totalValidDocuments);
    
    res.json({
      success: true,
      total_contracts_checked: contracts.length,
      total_valid_documents: totalValidDocuments,
      contracts: debugInfo
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error in download debug:', error);
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
      
      // Handle ZIP files by extracting them
      if (analysis.isZipFile && !analysis.documentType.includes('Microsoft Office') && !analysis.documentType.includes('Word') && !analysis.documentType.includes('Excel') && !analysis.documentType.includes('PowerPoint')) {
        console.log(`📦 [DEBUG] [${documentId}] Processing ZIP file: ${originalFilename}`);
        
        try {
          // Create extraction directory
          const extractPath = path.join(downloadPath, `extracted_${contract.noticeId}_${Date.now()}`);
          
          // Extract ZIP files
          const extractedFiles = await documentAnalyzer.extractZipFiles(fileBuffer, extractPath);
          
          if (extractedFiles.length === 0) {
            console.log(`⚠️ [DEBUG] [${documentId}] No supported files found in ZIP: ${originalFilename}`);
            skippedCount++;
            return { success: false, reason: 'No supported files in ZIP' };
          }

          // Process each extracted file
          let extractedCount = 0;
          for (const extractedFile of extractedFiles) {
            if (extractedFile.isSupported) {
              // Move the extracted file to the main download directory with proper naming
              const timestamp = Date.now();
              const finalFilename = `${contract.noticeId}_${extractedFile.fileName.replace(/\.[^/.]+$/, '')}_${timestamp}${path.extname(extractedFile.fileName)}`;
              const finalPath = path.join(downloadPath, finalFilename);
              
              try {
                await fs.move(extractedFile.extractedPath, finalPath);
                extractedCount++;
                console.log(`✅ [DEBUG] [${documentId}] Extracted and saved: ${finalFilename} (${extractedFile.documentType})`);
              } catch (moveError) {
                console.error(`❌ [DEBUG] [${documentId}] Error moving extracted file:`, moveError.message);
              }
            }
          }

          // Clean up extraction directory
          try {
            await fs.remove(extractPath);
          } catch (cleanupError) {
            console.warn(`⚠️ [DEBUG] [${documentId}] Could not clean up extraction directory:`, cleanupError.message);
          }

          if (extractedCount > 0) {
            downloadedCount += extractedCount;
            console.log(`✅ [DEBUG] [${documentId}] Successfully extracted ${extractedCount} files from ZIP: ${originalFilename}`);
            return { success: true, extractedFiles: extractedCount, type: 'ZIP Archive' };
          } else {
            skippedCount++;
            return { success: false, reason: 'No files could be extracted from ZIP' };
          }
        } catch (zipError) {
          console.error(`❌ [DEBUG] [${documentId}] Error processing ZIP file:`, zipError.message);
          errorCount++;
          return { success: false, error: zipError.message };
        }
      }

      // Only skip if it's truly unsupported (not Microsoft Office or PDF)
      if (!analysis.isSupported && !analysis.documentType.includes('PDF') && !analysis.documentType.includes('Microsoft Office') && !analysis.documentType.includes('Word') && !analysis.documentType.includes('Excel') && !analysis.documentType.includes('PowerPoint')) {
        console.log(`⚠️ [DEBUG] [${documentId}] SKIPPED - Unsupported document type: ${analysis.documentType}`);
        console.log(`⚠️ [DEBUG] [${documentId}] Content-Type: ${contentType}`);
        console.log(`⚠️ [DEBUG] [${documentId}] File extension: ${analysis.extension}`);
        skippedCount++;
        return { success: false, reason: 'Unsupported type' };
      }

      // Force support for Microsoft Office documents and PDFs even if not detected as supported
      if (analysis.documentType.includes('PDF') || analysis.documentType.includes('Microsoft Office') || analysis.documentType.includes('Word') || analysis.documentType.includes('Excel') || analysis.documentType.includes('PowerPoint')) {
        analysis.isSupported = true;
        console.log(`✅ [DEBUG] [${documentId}] FORCED SUPPORT for Microsoft/PDF document: ${analysis.documentType}`);
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

console.log('📋 [DEBUG] Documents router module loaded successfully');
module.exports = router;
