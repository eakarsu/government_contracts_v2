const { prisma } = require('../config/database');
const { summarizeContent } = require('./summaryService');
const fs = require('fs-extra');
const path = require('path');

// Extract the processDocumentsInParallel function from documentProcessing.js route
// This allows the queue worker to use the same processing logic
async function processDocumentsInParallel(documents, concurrency, options = {}) {
  const { signal, jobId } = options || {};
  console.log(`🚀 [PROCESSOR] Starting parallel processing: ${documents.length} documents, concurrency: ${concurrency}`);
  
  // Check for abort signal before starting
  if (signal?.aborted) {
    throw new Error('Processing was aborted before starting');
  }
  
  let successCount = 0;
  let errorCount = 0;
  let processedCount = 0;

  // Process single document with full pipeline parallelization
  const processDocument = async (doc) => {
    const startTime = Date.now();
    
    // Check for abort signal at start of each document
    if (signal?.aborted) {
      throw new Error('Processing was aborted');
    }
    
    try {
      // Use the exact file path from the queue entry
      let filePath = doc.localFilePath;
      console.log(`📁 [PROCESSOR] Processing queue entry ${doc.id}: ${doc.filename}`);
      console.log(`📁 [PROCESSOR] Expected file path: ${filePath}`);
      
      // Verify the file exists at the specified path
      if (!filePath || !await fs.pathExists(filePath)) {
        console.error(`❌ [PROCESSOR] File not found at expected path: ${filePath}`);
        console.log(`🔍 [PROCESSOR] Searching for file in download directory...`);
        
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
          console.log(`✅ [PROCESSOR] Found file: ${matchingFile} at ${filePath}`);
        } else {
          console.error(`❌ [PROCESSOR] No matching file found for ${doc.filename}`);
        }
      } else {
        console.log(`✅ [PROCESSOR] File verified at: ${filePath}`);
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
            const LibreOfficeService = require('./libreoffice.service');
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
          const pdfService = require('./summaryService.js');
          return await pdfService.processPDF(pdfPath, {
            apiKey: process.env.REACT_APP_OPENROUTER_KEY,
            saveExtracted: false,
            outputDir: null
          });
        })();
        
        // Wait for extraction, then start summarization
        const extractResult = await extractionPromise;
        
        if (!extractResult.success) {
          throw new Error(`PDF extraction failed: ${extractResult.error}`);
        }
        
        console.log(`✅ Extraction completed, starting summarization: ${doc.filename}`);
        
        // Start summarization
        const summaryPromise = (async () => {
          const pdfService = require('./summaryService.js');
          return await pdfService.summarizeContent(
            extractResult.extractedContent,
            process.env.REACT_APP_OPENROUTER_KEY,
            { signal } // Pass abort signal to summarization
          );
        })();
        
        // Wait for summarization
        const summaryResult = await summaryPromise;
        
        if (!summaryResult.success) {
          throw new Error(`Summarization failed: ${summaryResult.error}`);
        }

        console.log(`✅ [DEBUG] OpenRouter summarization completed for: ${doc.filename}`);
        
        // Clean up temp conversion files
        if (fileExt !== '.pdf' && pdfPath.includes('temp_parallel_conversion')) {
          try {
            const tempDir = path.dirname(pdfPath);
            await fs.remove(tempDir);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        
        const result = summaryResult.result;
        
        // Get vector service with delayed require to avoid circular dependency
        let vectorService;
        try {
          const serverModule = require('../server');
          vectorService = serverModule.vectorService;
          
          if (!vectorService) {
            console.error('❌ vectorService is undefined in server module');
            throw new Error('vectorService not available');
          }
          
          if (typeof vectorService.indexDocument !== 'function') {
            console.error('❌ vectorService.indexDocument is not a function');
            throw new Error('vectorService.indexDocument not available');
          }
        } catch (requireError) {
          console.error('❌ Error accessing vectorService:', requireError.message);
          throw new Error(`vectorService access failed: ${requireError.message}`);
        }
        
        // Step 3: Start final operations in parallel
        await Promise.all([
          // Index in vector database
          (async () => {
            await vectorService.indexDocument({
              filename: doc.filename,
              content: result.content || result.text || JSON.stringify(result),
              processedData: result
            }, doc.contractNoticeId);
            console.log(`📚 [DEBUG] Vector indexing completed for: ${doc.filename}`);
          })(),
          
          // Update database status
          (async () => {
            await prisma.documentProcessingQueue.update({
              where: { id: doc.id },
              data: {
                status: 'completed',
                processedData: JSON.stringify(result),
                completedAt: new Date()
              }
            });
            console.log(`💾 [DEBUG] Database status updated to 'completed' for: ${doc.filename}`);
          })()
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
      
      // Quick failure update with OCR detection
      try {
        let failureStatus = 'failed';
        let errorMessage = error.message;
        
        // Check if this is an OCR-required document
        if (error.message && error.message.includes('OCR_REQUIRED')) {
          failureStatus = 'failed';
          errorMessage = 'Document requires OCR processing (disabled for performance)';
          console.log(`📋 [OCR-SKIP] Moving OCR-required document to failed: ${doc.filename}`);
        }
        
        await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: failureStatus,
            errorMessage: errorMessage,
            failedAt: new Date()
          }
        });
      } catch (updateError) {
        // Ignore update errors to keep processing fast
      }
      
      return { success: false, filename: doc.filename, error: error.message };
    }
  };

  // Process in balanced concurrency parallel batches
  const batchSize = Math.min(concurrency, 10); // Balanced at 10 for optimal performance
  const batches = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push(documents.slice(i, i + batchSize));
  }

  console.log(`📦 Processing ${documents.length} documents in ${batches.length} batches of ${batchSize}`);

  // Process ALL batches simultaneously (true parallelization)
  console.log(`🚀 Starting simultaneous processing of all ${batches.length} batches`);
  
  const allBatchPromises = batches.map((batch, batchIndex) => {
    console.log(`🔄 Batch ${batchIndex + 1}/${batches.length}: ${batch.length} documents`);
    const batchPromises = batch.map(doc => processDocument(doc));
    return Promise.allSettled(batchPromises);
  });
  
  // Wait for ALL batches to complete simultaneously
  await Promise.allSettled(allBatchPromises);
  
  console.log(`✅ All ${batches.length} batches completed simultaneously`);

  // Update job status if job ID provided
  if (jobId) {
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

      console.log(`🎉 COMPLETED: ${successCount} success, ${errorCount} errors, ${documents.length} total`);
    } catch (updateError) {
      console.error('❌ Error updating job status:', updateError);
    }
  }
  
  return {
    success: true,
    processed: documents.length,
    successCount,
    errorCount
  };
}

module.exports = {
  processDocumentsInParallel
};