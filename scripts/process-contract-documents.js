#!/usr/bin/env node

// Standalone script for processing contract documents
// Runs in separate process to avoid blocking the main server

const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Get command line arguments
const noticeId = process.argv[2];
const resourceLinksJson = process.argv[3];

if (!noticeId || !resourceLinksJson) {
  console.error('Usage: node process-contract-documents.js <noticeId> <resourceLinksJson>');
  process.exit(1);
}

console.log(`📄 [PROCESSOR] Starting document processing for contract: ${noticeId}`);

(async () => {
  try {
    // Parse resource links
    const resourceLinks = JSON.parse(resourceLinksJson);
    console.log(`📄 [PROCESSOR] Processing ${resourceLinks.length} documents`);
    
    // Import required services (use absolute paths)
    const projectRoot = path.join(__dirname, '..');
    const vectorServicePath = path.join(projectRoot, 'services', 'vectorService.js');
    const summarizationServicePath = path.join(projectRoot, 'services', 'summarizationService.js');
    
    const VectorService = require(vectorServicePath);
    const { summarizeContent } = require(summarizationServicePath);
    
    // Initialize vector service
    const vectorService = new VectorService();
    await vectorService.initialize();
    
    let documentsProcessed = 0;
    
    for (const docUrl of resourceLinks.slice(0, 5)) { // Limit to 5 docs
      try {
        console.log(`📄 [PROCESSOR] Processing document: ${docUrl}`);
        
        // Check if document URL is valid
        if (!docUrl || typeof docUrl !== 'string' || !docUrl.includes('sam.gov')) {
          console.log(`📄 [PROCESSOR] Skipping invalid URL: ${docUrl}`);
          continue;
        }
        
        // We'll check file type after download to avoid LibreOffice blocking
        
        // Create stable document ID based on URL hash, not timestamp
        const crypto = require('crypto');
        const urlHash = crypto.createHash('md5').update(docUrl).digest('hex').substring(0, 8);
        const documentId = `${noticeId}_${urlHash}`;
        
        // Check if already indexed with better duplicate detection
        const existingDocs = await vectorService.searchDocuments(documentId, 1);
        if (existingDocs.length > 0) {
          // Check if exact document ID exists
          const exactMatch = existingDocs.find(doc => doc.metadata?.id === documentId);
          if (exactMatch) {
            console.log(`📄 [PROCESSOR] Document already indexed, skipping: ${documentId} (${docUrl})`);
            continue;
          }
        }
        
        // Clean up any existing downloads for this URL to prevent accumulation
        const fs = require('fs');
        const path = require('path');
        const downloadsDir = './temp_downloads';
        if (fs.existsSync(downloadsDir)) {
          const existingFiles = fs.readdirSync(downloadsDir);
          const relatedFiles = existingFiles.filter(file => file.includes(noticeId));
          for (const file of relatedFiles) {
            try {
              fs.unlinkSync(path.join(downloadsDir, file));
              console.log(`🗑️ [CLEANUP] Removed old download: ${file}`);
            } catch (err) {
              // Ignore cleanup errors
            }
          }
        }
        
        // Process document with timeout and relevance checking
        console.log(`📥 [PROCESSOR] Downloading and indexing: ${docUrl}`);
        
        // Add timeout wrapper with content relevance filtering
        const processWithTimeout = new Promise(async (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Document processing timeout (5 minutes)'));
          }, 5 * 60 * 1000); // 5 minute timeout
          
          try {
            // First get contract details for relevance checking
            const { query } = require('../config/database');
            const contractResult = await query('SELECT title, description, agency FROM contract WHERE notice_id = $1', [noticeId]);
            
            let contractKeywords = [];
            if (contractResult.length > 0) {
              const contract = contractResult[0];
              const contractText = `${contract.title} ${contract.description || ''} ${contract.agency || ''}`.toLowerCase();
              contractKeywords = contractText.match(/\b\w{4,}\b/g) || []; // Words 4+ chars
            }
            
            const result = await summarizeContent(
              docUrl,
              documentId,
              `Document from contract ${noticeId}`,
              'anthropic/claude-3.5-sonnet',
              contractKeywords // Pass keywords for relevance checking
            );
            clearTimeout(timeout);
            resolve(result);
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
        
        const result = await processWithTimeout;
        
        if (result && result.success) {
          documentsProcessed++;
          console.log(`✅ [PROCESSOR] Successfully indexed: ${documentId}`);
          
          // Clean up downloaded file after successful processing
          try {
            const downloadsDir = './temp_downloads';
            if (fs.existsSync(downloadsDir)) {
              const files = fs.readdirSync(downloadsDir);
              const currentDocFiles = files.filter(file => file.includes(noticeId));
              for (const file of currentDocFiles) {
                fs.unlinkSync(path.join(downloadsDir, file));
                console.log(`🗑️ [CLEANUP] Cleaned up processed file: ${file}`);
              }
            }
          } catch (cleanupError) {
            console.log(`⚠️ [CLEANUP] Could not clean up files: ${cleanupError.message}`);
          }
          
        } else {
          console.log(`❌ [PROCESSOR] Failed to process: ${documentId}`);
        }
        
      } catch (docError) {
        console.error(`⚠️ [PROCESSOR] Error processing ${docUrl}:`, docError.message);
        if (docError.message.includes('timeout')) {
          console.log(`⏰ [PROCESSOR] Skipping due to timeout, continuing with next document`);
        }
      }
    }
    
    console.log(`📄 [PROCESSOR] Completed processing ${documentsProcessed}/${resourceLinks.length} documents for contract ${noticeId}`);
    process.exit(0);
    
  } catch (error) {
    console.error('📄 [PROCESSOR] Fatal error:', error);
    process.exit(1);
  }
})();