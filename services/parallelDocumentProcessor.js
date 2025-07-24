const { prisma } = require('../config/database');
const fs = require('fs-extra');
const path = require('path');

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
      // Quick status update with logging
      console.log(`💾 Updating database status for doc ${doc.id}: queued -> processing`);
      const initialUpdate = await prisma.documentProcessingQueue.update({
        where: { id: doc.id },
        data: { status: 'processing', startedAt: new Date() }
      });
      console.log(`✅ Database status updated to processing for doc ${doc.id}:`, initialUpdate.status);

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
            const LibreOfficeService = require('./libreoffice.service');
            const libreOfficeService = new LibreOfficeService();
            
            const tempDir = path.join(process.cwd(), 'temp_parallel_conversion', `${Date.now()}_${doc.id}`);
            await fs.ensureDir(tempDir);
            
            try {
              await libreOfficeService.acquireSemaphore();
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
            } finally {
              libreOfficeService.releaseSemaphore();
            }
          })();
        }
        
        // Step 2: Wait for conversion to complete, then start extraction and summarization in parallel
        const pdfPath = await conversionPromise;
        console.log(`📄 PDF ready, starting parallel extraction and analysis: ${doc.filename}`);
        
        // Start extraction immediately
        const extractionPromise = (async () => {
          const pdfService = require('./summaryService.js');
          const result = await pdfService.processPDF(pdfPath, {
            apiKey: process.env.REACT_APP_OPENROUTER_KEY,
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
          const pdfService = require('./summaryService.js');
          return await pdfService.summarizeContent(
            extractResult.extractedContent,
            process.env.REACT_APP_OPENROUTER_KEY
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
        
        const result = summaryResult.result;
        
        // Get vector service with delayed require to avoid circular dependency
        const { vectorService } = require('../server');
        
        // Step 3: Start final operations in parallel
        console.log(`🔄 Starting final operations for doc ${doc.id}: ${doc.filename}`);
        
        try {
          await Promise.all([
            // Index in vector database
            (async () => {
              console.log(`📚 Indexing document ${doc.id} in vector database...`);
              await vectorService.indexDocument({
                filename: doc.filename,
                content: result.content || result.text || JSON.stringify(result),
                processedData: result
              }, doc.contractNoticeId);
              console.log(`✅ Vector indexing completed for doc ${doc.id}`);
            })(),
            
            // Update database status with detailed logging
            (async () => {
              console.log(`💾 Updating database status for doc ${doc.id}: processing -> completed`);
              const updateResult = await prisma.documentProcessingQueue.update({
                where: { id: doc.id },
                data: {
                  status: 'completed',
                  processedData: JSON.stringify(result),
                  completedAt: new Date()
                }
              });
              console.log(`✅ Database status updated successfully for doc ${doc.id}:`, updateResult.status);
            })()
          ]);
          
          console.log(`🎉 All final operations completed for doc ${doc.id}: ${doc.filename}`);
        } catch (finalOpsError) {
          console.error(`❌ CRITICAL: Final operations failed for doc ${doc.id}:`, finalOpsError);
          console.error(`❌ Error details:`, {
            message: finalOpsError.message,
            code: finalOpsError.code,
            stack: finalOpsError.stack
          });
          throw finalOpsError;
        }
        
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
      
      // Quick failure update with detailed logging
      try {
        console.log(`💾 Updating database status for doc ${doc.id}: processing -> failed`);
        const updateResult = await prisma.documentProcessingQueue.update({
          where: { id: doc.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            failedAt: new Date()
          }
        });
        console.log(`✅ Database status updated to failed for doc ${doc.id}:`, updateResult.status);
      } catch (updateError) {
        console.error(`❌ CRITICAL: Failed to update database status for doc ${doc.id}:`, updateError);
        console.error(`❌ Update error details:`, {
          message: updateError.message,
          code: updateError.code,
          docId: doc.id,
          originalError: error.message
        });
      }
      
      return { success: false, filename: doc.filename, error: error.message };
    }
  };

  // Process in true parallel batches
  const batchSize = Math.min(concurrency, 30); // Increased from 10 to 30 concurrent
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

module.exports = {
  processDocumentsInParallel
};