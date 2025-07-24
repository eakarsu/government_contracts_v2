const { prisma } = require('../config/database');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');

/**
 * JavaScript Parallel Document Processor
 * Replaces the queue system with parallel processing using Promise.all
 * Keeps all the same logic, just processes documents in parallel instead of queue
 */
class JSParallelProcessor {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 10;
    this.isProcessing = false;
    this.shouldStop = false;
    this.abortController = null;
    this.processingStats = {
      total: 0,
      completed: 0,
      failed: 0,
      in_progress: 0,
      start_time: null
    };
    
    // OpenRouter configuration
    this.openrouterConfig = {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'
    };
    
    this.norshinApiUrl = process.env.NORSHIN_API_URL || 'https://norshin.com/api/process-document';
    
    console.log(`🚀 [JS-PARALLEL] Initialized with max ${this.maxConcurrency} concurrent documents`);
  }

  /**
   * Start parallel document processing
   * Replaces queue worker start() method
   */
  async startProcessing() {
    if (this.isProcessing) {
      console.log('⚠️ [JS-PARALLEL] Processing already in progress');
      return { success: false, message: 'Processing already in progress' };
    }

    try {
      console.log(`🚀 [JS-PARALLEL] Starting parallel document processing`);
      
      // Initialize processing state
      this.isProcessing = true;
      this.shouldStop = false;
      this.abortController = new AbortController();
      this.processingStats.start_time = new Date();
      
      const result = await this.processAllDocuments();
      
      // Clean up processing state
      this.isProcessing = false;
      this.shouldStop = false;
      this.abortController = null;
      
      if (result.stopped) {
        console.log('⏹️ [JS-PARALLEL] Parallel processing stopped by user');
        return {
          success: true,
          message: 'Parallel processing stopped by user',
          stats: result
        };
      } else {
        console.log('✅ [JS-PARALLEL] Parallel processing completed:', result);
        return {
          success: true,
          message: 'Parallel processing completed',
          stats: result
        };
      }
      
    } catch (error) {
      // Clean up on error
      this.isProcessing = false;
      this.shouldStop = false;
      this.abortController = null;
      
      if (error.name === 'AbortError') {
        console.log('⏹️ [JS-PARALLEL] Processing aborted by user');
        return {
          success: true,
          message: 'Processing stopped by user'
        };
      }
      
      console.error('❌ [JS-PARALLEL] Processing failed:', error.message);
      return {
        success: false,
        message: 'Processing failed',
        error: error.message
      };
    }
  }

  /**
   * Stop processing with proper cancellation
   */
  async stopProcessing() {
    if (!this.isProcessing) {
      console.log('⚠️ [JS-PARALLEL] No processing to stop');
      return { success: false, message: 'No processing in progress' };
    }

    console.log('⏹️ [JS-PARALLEL] Stopping parallel processing...');
    
    // Set stop flag
    this.shouldStop = true;
    
    // Abort ongoing operations if possible
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Wait a moment for operations to gracefully stop
    let attempts = 0;
    const maxAttempts = 30; // Wait up to 3 seconds
    
    while (this.isProcessing && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (this.isProcessing) {
      // Force stop if graceful stop didn't work
      console.log('⚠️ [JS-PARALLEL] Force stopping parallel processing');
      this.isProcessing = false;
      this.shouldStop = false;
      this.abortController = null;
      
      return {
        success: true,
        message: 'Parallel processing force stopped'
      };
    } else {
      console.log('✅ [JS-PARALLEL] Parallel processing stopped gracefully');
      return {
        success: true,
        message: 'Parallel processing stopped successfully'
      };
    }
  }

  /**
   * Get current processing status
   */
  async getStatus() {
    try {
      // Get database status
      const statusCounts = await prisma.documentProcessingQueue.groupBy({
        by: ['status'],
        _count: { id: true }
      });

      const status = {};
      statusCounts.forEach(item => {
        status[item.status] = item._count.id;
      });

      return {
        queued: status.queued || 0,
        processing: status.processing || 0,
        completed: status.completed || 0,
        failed: status.failed || 0,
        isProcessing: this.isProcessing,
        currentStats: this.processingStats
      };
      
    } catch (error) {
      console.error('❌ [JS-PARALLEL] Error getting status:', error.message);
      return {
        error: error.message,
        isProcessing: this.isProcessing,
        currentStats: this.processingStats
      };
    }
  }

  /**
   * Check if processing is currently running
   */
  isRunning() {
    return this.isProcessing;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return this.processingStats;
  }

  /**
   * Reset processing statistics and counters
   */
  async resetCounters() {
    try {
      console.log('🔄 [JS-PARALLEL] Resetting processing counters and statistics');
      
      // Reset internal stats
      this.processingStats = {
        total: 0,
        completed: 0,
        failed: 0,
        in_progress: 0,
        start_time: null
      };
      
      // Optional: Reset database counters (reset all failed/completed back to queued)
      const resetCompleted = await prisma.documentProcessingQueue.updateMany({
        where: { status: 'completed' },
        data: { 
          status: 'queued',
          completedAt: null,
          processedData: null,
          updatedAt: new Date()
        }
      });
      
      const resetFailed = await prisma.documentProcessingQueue.updateMany({
        where: { status: 'failed' },
        data: { 
          status: 'queued',
          failedAt: null,
          errorMessage: null,
          retryCount: 0,
          updatedAt: new Date()
        }
      });
      
      const resetProcessing = await prisma.documentProcessingQueue.updateMany({
        where: { status: 'processing' },
        data: { 
          status: 'queued',
          startedAt: null,
          updatedAt: new Date()
        }
      });
      
      // Clear all queued documents (full reset)
      const clearQueued = await prisma.documentProcessingQueue.deleteMany({
        where: { status: 'queued' }
      });
      
      const totalReset = resetCompleted.count + resetFailed.count + resetProcessing.count + clearQueued.count;
      
      console.log(`✅ [JS-PARALLEL] Reset ${totalReset} documents and cleared queue`);
      console.log(`   - Completed → Queued: ${resetCompleted.count}`);
      console.log(`   - Failed → Queued: ${resetFailed.count}`);
      console.log(`   - Processing → Queued: ${resetProcessing.count}`);
      console.log(`   - Queued documents cleared: ${clearQueued.count}`);
      
      return {
        success: true,
        message: `Reset ${totalReset} documents and cleared queue`,
        resetCounts: {
          completed: resetCompleted.count,
          failed: resetFailed.count,
          processing: resetProcessing.count,
          queued_cleared: clearQueued.count,
          total: totalReset
        },
        newStats: this.processingStats
      };
      
    } catch (error) {
      console.error(`❌ [JS-PARALLEL] Error resetting counters: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all queued documents from database
   */
  async getQueuedDocuments() {
    try {
      const documents = await prisma.documentProcessingQueue.findMany({
        where: { status: 'queued' },
        orderBy: { queuedAt: 'asc' }
      });
      
      console.log(`📋 [JS-PARALLEL] Found ${documents.length} queued documents`);
      return documents;
    } catch (error) {
      console.error(`❌ [JS-PARALLEL] Error fetching queued documents: ${error.message}`);
      return [];
    }
  }

  /**
   * Update document status in database
   */
  async updateDocumentStatus(docId, status, errorMessage = null, processedData = null) {
    try {
      const updateData = {
        status,
        updatedAt: new Date()
      };

      if (status === 'processing') {
        updateData.startedAt = new Date();
      } else if (status === 'completed') {
        updateData.completedAt = new Date();
        if (processedData) updateData.processedData = processedData;
      } else if (status === 'failed') {
        updateData.failedAt = new Date();
        updateData.retryCount = { increment: 1 };
        if (errorMessage) updateData.errorMessage = errorMessage;
      }

      await prisma.documentProcessingQueue.update({
        where: { id: docId },
        data: updateData
      });

      console.log(`✅ [JS-PARALLEL] Updated document ${docId} status to ${status}`);
    } catch (error) {
      console.error(`❌ [JS-PARALLEL] Error updating document ${docId} status: ${error.message}`);
    }
  }

  /**
   * Download document (same logic as existing system)
   */
  async downloadDocument(documentUrl, contractNoticeId) {
    try {
      console.log(`📥 [DOWNLOAD] Downloading document: ${documentUrl}`);
      
      // Create downloads directory
      const downloadsDir = path.join(__dirname, '..', 'downloads');
      await fs.ensureDir(downloadsDir);
      
      // Download file
      const response = await axios.get(documentUrl, { 
        timeout: 30000,
        responseType: 'arraybuffer'
      });
      
      // Generate filename
      const filename = `${contractNoticeId}_${Date.now()}.pdf`;
      const filePath = path.join(downloadsDir, filename);
      
      // Save file
      await fs.writeFile(filePath, response.data);
      
      console.log(`✅ [DOWNLOAD] Downloaded to: ${filePath}`);
      return filePath;
      
    } catch (error) {
      console.error(`❌ [DOWNLOAD] Error downloading ${documentUrl}: ${error.message}`);
      return null;
    }
  }

  /**
   * Convert document to PDF if needed
   */
  async convertToPdf(filePath) {
    try {
      const fileExt = path.extname(filePath).toLowerCase();
      
      if (fileExt === '.pdf') {
        return filePath;
      }
      
      // Convert using LibreOffice (same as existing system)
      const outputDir = path.dirname(filePath);
      
      return new Promise((resolve, reject) => {
        const cmd = spawn('libreoffice', [
          '--headless', '--convert-to', 'pdf',
          '--outdir', outputDir, filePath
        ]);

        cmd.on('close', (code) => {
          if (code === 0) {
            const pdfPath = path.join(outputDir, path.basename(filePath, fileExt) + '.pdf');
            if (fs.existsSync(pdfPath)) {
              console.log(`✅ [CONVERT] Converted to PDF: ${pdfPath}`);
              resolve(pdfPath);
            } else {
              resolve(filePath); // Return original if PDF not created
            }
          } else {
            console.error(`❌ [CONVERT] LibreOffice conversion failed with code ${code}`);
            resolve(filePath); // Return original if conversion fails
          }
        });

        cmd.on('error', (error) => {
          console.error(`❌ [CONVERT] Error converting ${filePath}: ${error.message}`);
          resolve(filePath); // Return original if conversion fails
        });
      });
      
    } catch (error) {
      console.error(`❌ [CONVERT] Error converting ${filePath}: ${error.message}`);
      return filePath;
    }
  }

  /**
   * Extract text from PDF (using existing OCR processor)
   */
  async extractTextFromPdf(pdfPath) {
    try {
      // Use the correct function name from OCR processor
      const { processWithOCR } = require('./ocrProcessor');
      
      const extractedText = await processWithOCR(pdfPath);
      if (extractedText && extractedText.trim().length > 0) {
        console.log(`✅ [OCR] Successfully extracted ${extractedText.length} characters from ${path.basename(pdfPath)}`);
        return extractedText;
      }
      
      // Fallback - return empty string if OCR fails
      console.log(`⚠️ [OCR] OCR extraction failed for ${pdfPath}, returning empty text`);
      return "";
      
    } catch (error) {
      console.error(`❌ [OCR] Error extracting text from ${pdfPath}: ${error.message}`);
      // Return empty string instead of failing the entire document processing
      console.log(`⚠️ [OCR] Continuing document processing without extracted text for ${path.basename(pdfPath)}`);
      return "";
    }
  }

  /**
   * Call OpenRouter API for document analysis
   */
  async callOpenRouterApi(text, documentInfo, signal = null) {
    try {
      if (!this.openrouterConfig.apiKey) {
        console.error("❌ [API] OpenRouter API key not configured");
        return null;
      }
      
      const textContent = text && text.trim().length > 0 
        ? text.substring(0, 10000) 
        : `Document filename: ${documentInfo.filename || 'Unknown'}\nNo text could be extracted from this document.`;
      
      const prompt = `
        Analyze this government contract document and extract key information:
        
        Document: ${documentInfo.description || 'Government Contract Document'}
        Contract ID: ${documentInfo.contractNoticeId || 'Unknown'}
        
        Text Content:
        ${textContent}
        
        Please provide:
        1. Document summary
        2. Key requirements  
        3. Important dates
        4. Contact information
        5. Bid submission details
        
        Return as JSON format. If no text was extracted, provide analysis based on document metadata.
      `;
      
      const response = await axios.post(
        `${this.openrouterConfig.baseUrl}/chat/completions`,
        {
          model: this.openrouterConfig.model,
          messages: [
            { role: 'system', content: 'You are an expert at analyzing government contract documents.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 2000,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openrouterConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
          signal: signal // Add abort signal support
        }
      );
      
      if (response.data.choices && response.data.choices.length > 0) {
        const analysis = response.data.choices[0].message.content;
        console.log(`✅ [API] OpenRouter analysis completed for ${documentInfo.id}`);
        return { analysis, raw_response: response.data };
      }
      
      console.error(`❌ [API] Invalid OpenRouter response format`);
      return null;
      
    } catch (error) {
      console.error(`❌ [API] OpenRouter API error: ${error.message}`);
      return null;
    }
  }

  /**
   * Call Norshin API for additional processing
   */
  async callNorshinApi(filePath, signal = null) {
    try {
      console.log(`🔄 [NORSHIN] Processing document: ${filePath}`);
      
      const FormData = require('form-data');
      const form = new FormData();
      form.append('document', fs.createReadStream(filePath));
      
      const response = await axios.post(this.norshinApiUrl, form, {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 120000,
        signal: signal // Add abort signal support
      });
      
      console.log(`✅ [NORSHIN] Processing completed`);
      return response.data;
      
    } catch (error) {
      console.error(`❌ [NORSHIN] API error: ${error.message}`);
      return null;
    }
  }

  /**
   * Process a single document (same logic as queue worker, but returns Promise)
   */
  async processSingleDocument(document) {
    const docId = document.id;
    const contractNoticeId = document.contractNoticeId;
    const documentUrl = document.documentUrl;
    
    try {
      console.log(`🔄 [PROCESS] Starting document ${docId}: ${contractNoticeId}`);
      
      // Check if we should stop before processing
      if (this.shouldStop) {
        throw new Error('Processing stopped by user');
      }
      
      // Update status to processing
      await this.updateDocumentStatus(docId, 'processing');
      this.processingStats.in_progress += 1;
      
      // Step 1: Download document
      let filePath = document.localFilePath;
      if (!filePath || !fs.existsSync(filePath)) {
        filePath = await this.downloadDocument(documentUrl, contractNoticeId);
        if (!filePath) {
          throw new Error("Failed to download document");
        }
      }
      
      // Check if we should stop before conversion
      if (this.shouldStop) {
        throw new Error('Processing stopped by user');
      }
      
      // Step 2: Convert to PDF if needed
      const pdfPath = await this.convertToPdf(filePath);
      
      // Check if we should stop after conversion
      if (this.shouldStop) {
        throw new Error('Processing stopped by user');
      }
      
      // Check if we should stop before OCR
      if (this.shouldStop) {
        throw new Error('Processing stopped by user');
      }
      
      // Step 3: Extract text
      const extractedText = await this.extractTextFromPdf(pdfPath);
      if (!extractedText || extractedText.trim().length === 0) {
        console.log(`⚠️ [PROCESS] No text extracted from ${docId}, will still process with APIs using filename`);
        // Don't fail the entire document - continue with empty text or filename
      }
      
      // Check if we should stop before API calls
      if (this.shouldStop) {
        throw new Error('Processing stopped by user');
      }
      
      // Step 4: Call APIs in parallel with cancellation support
      let openrouterResult = null;
      let norshinResult = null;
      
      // Create cancellable API calls
      const openrouterPromise = this.callOpenRouterApi(extractedText, document, this.abortController?.signal).catch(err => {
        if (err.name === 'AbortError') {
          throw new Error('Processing stopped by user');
        }
        console.error(`❌ [API] OpenRouter failed for ${docId}: ${err.message}`);
        return null;
      });
      
      const norshinPromise = this.callNorshinApi(pdfPath, this.abortController?.signal).catch(err => {
        if (err.name === 'AbortError') {
          throw new Error('Processing stopped by user');
        }
        console.error(`❌ [API] Norshin failed for ${docId}: ${err.message}`);
        return null;
      });
      
      // Wait for both with cancellation check
      try {
        [openrouterResult, norshinResult] = await Promise.all([openrouterPromise, norshinPromise]);
      } catch (error) {
        if (error.message === 'Processing stopped by user' || this.shouldStop) {
          throw new Error('Processing stopped by user');
        }
        // Continue with partial results if one API failed
        [openrouterResult, norshinResult] = await Promise.allSettled([openrouterPromise, norshinPromise])
          .then(results => [
            results[0].status === 'fulfilled' ? results[0].value : null,
            results[1].status === 'fulfilled' ? results[1].value : null
          ]);
      }
      
      // Step 5: Combine results
      const processedData = {
        extracted_text: extractedText && extractedText.trim().length > 0 
          ? extractedText.substring(0, 1000) 
          : `No text extracted - OCR failed for ${path.basename(pdfPath)}`,
        text_extraction_status: extractedText && extractedText.trim().length > 0 ? 'success' : 'failed',
        openrouter_analysis: openrouterResult,
        norshin_analysis: norshinResult,
        processed_at: new Date().toISOString(),
        file_path: pdfPath
      };
      
      // Step 6: Update database
      await this.updateDocumentStatus(docId, 'completed', null, JSON.stringify(processedData));
      
      this.processingStats.completed += 1;
      this.processingStats.in_progress -= 1;
      
      console.log(`✅ [PROCESS] Completed document ${docId}: ${contractNoticeId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ [PROCESS] Failed document ${docId}: ${error.message}`);
      
      await this.updateDocumentStatus(docId, 'failed', error.message);
      this.processingStats.failed += 1;
      this.processingStats.in_progress -= 1;
      
      return false;
    }
  }

  /**
   * Process all queued documents in parallel using Promise.all
   */
  async processAllDocuments() {
    try {
      // Get all queued documents
      const documents = await this.getQueuedDocuments();
      
      if (documents.length === 0) {
        console.log("ℹ️ [PROCESS] No queued documents found");
        return { total: 0, completed: 0, failed: 0 };
      }
      
      // Initialize stats
      this.processingStats.total = documents.length;
      this.processingStats.start_time = new Date();
      
      console.log(`🚀 [PROCESS] Starting parallel processing of ${documents.length} documents`);
      
      // Create semaphore to limit concurrent processing
      const semaphore = this.createSemaphore(this.maxConcurrency);
      
      // Process documents with concurrency limit and cancellation support
      const processWithLimit = async (doc) => {
        // Check if we should stop before acquiring semaphore
        if (this.shouldStop) {
          throw new Error('Processing stopped by user');
        }
        
        await semaphore.acquire();
        try {
          // Check again after acquiring semaphore
          if (this.shouldStop) {
            throw new Error('Processing stopped by user');
          }
          
          return await this.processSingleDocument(doc);
        } finally {
          semaphore.release();
        }
      };
      
      // Process all documents concurrently with limit - CANCELLABLE VERSION
      const results = [];
      const activePromises = new Map();
      let completedCount = 0;
      
      // Start initial batch of documents up to concurrency limit
      for (let i = 0; i < Math.min(documents.length, this.maxConcurrency); i++) {
        if (this.shouldStop) break;
        
        const doc = documents[i];
        const promise = processWithLimit(doc).then(
          result => {
            activePromises.delete(doc.id);
            completedCount++;
            return { status: 'fulfilled', value: result };
          },
          error => {
            activePromises.delete(doc.id);
            completedCount++;
            return { status: 'rejected', reason: error };
          }
        );
        
        activePromises.set(doc.id, promise);
        results[i] = promise;
      }
      
      // Process remaining documents one by one as others complete
      let nextIndex = Math.min(documents.length, this.maxConcurrency);
      
      while (completedCount < documents.length && !this.shouldStop) {
        // Wait for at least one promise to complete
        if (activePromises.size > 0) {
          await Promise.race(Array.from(activePromises.values()));
        }
        
        // Start next document if available and not stopping
        if (nextIndex < documents.length && !this.shouldStop) {
          const doc = documents[nextIndex];
          const promise = processWithLimit(doc).then(
            result => {
              activePromises.delete(doc.id);
              completedCount++;
              return { status: 'fulfilled', value: result };
            },
            error => {
              activePromises.delete(doc.id);
              completedCount++;
              return { status: 'rejected', reason: error };
            }
          );
          
          activePromises.set(doc.id, promise);
          results[nextIndex] = promise;
          nextIndex++;
        }
        
        // If stopping, break out of the loop
        if (this.shouldStop) {
          console.log(`⏹️ [PROCESS] Processing cancelled by user. Stopping after ${completedCount} documents.`);
          break;
        }
      }
      
      // Wait for all started promises to complete or resolve them as stopped
      const finalResults = await Promise.allSettled(results.filter(r => r !== undefined));
      
      // Check if processing was stopped
      const stoppedResults = finalResults.filter(r => 
        r.status === 'rejected' && r.reason?.message === 'Processing stopped by user'
      );
      
      if (stoppedResults.length > 0) {
        console.log(`⏹️ [PROCESS] Processing stopped by user after ${finalResults.length - stoppedResults.length} documents`);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        const failed = results.filter(r => r.status === 'rejected' && r.reason?.message !== 'Processing stopped by user').length;
        
        return {
          total: documents.length,
          completed: successful,
          failed: failed,
          stopped: true,
          processed: successful + failed,
          duration: (new Date() - this.processingStats.start_time) / 1000
        };
      }
      
      // Calculate final stats
      const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      const failed = results.length - successful;
      
      const duration = (new Date() - this.processingStats.start_time) / 1000;
      
      console.log(`🎉 [PROCESS] Completed parallel processing:`);
      console.log(`   📊 Total: ${documents.length}`);
      console.log(`   ✅ Successful: ${successful}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`   ⏱️ Duration: ${duration.toFixed(2)} seconds`);
      
      return {
        total: documents.length,
        completed: successful,
        failed: failed,
        duration: duration,
        stats: this.processingStats
      };
      
    } catch (error) {
      console.error(`❌ [PROCESS] Error in parallel processing: ${error.message}`);
      return { total: 0, completed: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Create a semaphore to limit concurrency
   */
  createSemaphore(limit) {
    let count = 0;
    const waiting = [];
    
    return {
      async acquire() {
        return new Promise((resolve) => {
          if (count < limit) {
            count++;
            resolve();
          } else {
            waiting.push(resolve);
          }
        });
      },
      
      release() {
        count--;
        if (waiting.length > 0) {
          count++;
          const resolve = waiting.shift();
          resolve();
        }
      }
    };
  }
}

module.exports = JSParallelProcessor;