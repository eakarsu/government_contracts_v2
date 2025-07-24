// PDF Processor module extracted from summaryService.js
// Main PDF processing functions with OCR disabled for performance

const fs = require('fs-extra');
const path = require('path');
const pdf2table = require('pdf2table');
// OCR processing removed for performance optimization
// const { processWithOCR } = require('./ocrProcessor');
const { estimateTokens, splitContentByTokens } = require('./contentUtils');
const { formatTableContent } = require('./tableDetectionUtils');

// Load environment variables
require('dotenv').config();

// Main PDF processing function with OCR fallback
async function processPDF(pdfPath, options = {}) {
  const {
    apiKey = process.env.REACT_APP_OPENROUTER_KEY,
    saveExtracted = false,
    outputDir = null
  } = options;
  
  if (!apiKey) {
    throw new Error('API key is required (REACT_APP_OPENROUTER_KEY)');
  }

  console.log(`📄 Processing PDF: ${path.basename(pdfPath)}`);
  console.log(`📄 [DEBUG] Full PDF path: ${pdfPath}`);
  console.log(`📄 [DEBUG] File size: ${fs.statSync(pdfPath).size} bytes`);
  console.log(`📄 [DEBUG] File modified: ${fs.statSync(pdfPath).mtime}`);
  const startTime = Date.now();
  
  try {
    const buffer = fs.readFileSync(pdfPath);
    
    return new Promise((resolve, reject) => {
      // First try pdf2table
      pdf2table.parse(buffer, async function (err, rows, rowsdebug) {
        try {
          if (err) {
            console.log('❌ pdf2table failed - OCR processing disabled for performance optimization');
            reject(new Error('OCR_REQUIRED: Document requires OCR processing which has been disabled'));
            return;
          }
          
          // pdf2table succeeded
          const extractedContent = formatTableContent(rows);
          const wordCount = extractedContent.split(/\s+/).length;
          const estimatedTokens = estimateTokens(extractedContent);
          
          console.log(`📊 pdf2table extracted ${wordCount} words, ${estimatedTokens.toLocaleString()} tokens`);
          
          // Check if we need OCR fallback (less than 100 words) - but OCR is disabled
          if (wordCount < 100) {
            console.log(`⚠️ Low word count (${wordCount} < 100) - OCR processing disabled for performance optimization`);
            reject(new Error('OCR_REQUIRED: Document has low word count and requires OCR processing which has been disabled'));
            return;
          }
          
          // Continue with pdf2table content
          // Save extracted content if requested
          if (saveExtracted && outputDir) {
            const extractedPath = path.join(outputDir, `${path.basename(pdfPath, '.pdf')}_extracted.txt`);
            fs.writeFileSync(extractedPath, extractedContent, 'utf8');
          }
          
          const chunks = splitContentByTokens(extractedContent, 100000);
          const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
          
          resolve({
            success: true,
            method: 'pdf2table',
            wordCount: wordCount,
            chunks: chunks,
            extractedContent: extractedContent,
            processingTime: `${processingTime}s`
          });
          
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}

module.exports = {
  processPDF
};