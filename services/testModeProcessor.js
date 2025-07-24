const { prisma } = require('../config/database');
const { summarizeContent } = require('./summaryService');
const fs = require('fs-extra');
const path = require('path');

async function processTestDocumentsSequentially(documents, jobId) {
  console.log(`🧪 [DEBUG] Processing ${documents.length} TEST documents with CONCURRENCY=20 (cost-effective mode)`);
  
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  const concurrency = Math.min(20, documents.length);
  console.log(`🧪 [DEBUG] Using concurrency: ${concurrency}`);

  const processDocument = async (doc) => {
    try {
      console.log(`🧪 [DEBUG] Processing TEST document: ${doc.filename}`);
      
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
      
      const { vectorService } = require('../server');
      
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
        console.log(`🧪 [DEBUG] 💰 COST ALERT: Sending test document to summarization service`);
        
        const downloadPath = path.join(process.cwd(), 'downloaded_documents');
        let localFilePath = null;
        
        try {
          const downloadedFiles = await fs.readdir(downloadPath);
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
          doc.filename || 'test_document',
          '',
          'openai/gpt-4.1'
        );

        if (result) {
          const finalFilename = result.correctedFilename || doc.filename;
          
          const existingRecord = await prisma.documentProcessingQueue.findUnique({
            where: { id: doc.id }
          });

          if (!existingRecord) {
            console.log(`⚠️ [DEBUG] Test document record ${doc.id} no longer exists`);
            return { success: false, filename: doc.filename, error: 'Record not found' };
          }

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

          const { vectorService } = require('../server');
          
          await vectorService.indexDocument({
            filename: finalFilename,
            content: result.content || result.text || JSON.stringify(result),
            processedData: { ...result, testMode: true }
          }, doc.contractNoticeId);

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

  const batchSize = concurrency;
  const batches = [];
  
  for (let i = 0; i < documents.length; i += batchSize) {
    batches.push(documents.slice(i, i + batchSize));
  }

  console.log(`🧪 [DEBUG] Processing ${documents.length} documents in ${batches.length} batches of ${batchSize}`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`🧪 [DEBUG] Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} documents`);
    
    const batchPromises = batch.map(doc => processDocument(doc));
    const batchResults = await Promise.allSettled(batchPromises);
    
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
    
    if (batchIndex < batches.length - 1) {
      console.log(`🧪 [DEBUG] Waiting 1 second before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

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

module.exports = {
  processTestDocumentsSequentially
};