// DOCX Processor module for direct DOCX processing
// Extracts text content directly from DOCX files without PDF conversion

const fs = require('fs-extra');
const path = require('path');
const mammoth = require('mammoth');
const { estimateTokens, splitContentByTokens } = require('./contentUtils');

// Load environment variables
require('dotenv').config();

// Main DOCX processing function
async function processDOCX(docxPath, options = {}) {
  const {
    apiKey = process.env.REACT_APP_OPENROUTER_KEY,
    saveExtracted = false,
    outputDir = null
  } = options;
  
  if (!apiKey) {
    throw new Error('API key is required (REACT_APP_OPENROUTER_KEY)');
  }

  console.log(`📄 Processing DOCX: ${path.basename(docxPath)}`);
  console.log(`📄 [DEBUG] Full DOCX path: ${docxPath}`);
  console.log(`📄 [DEBUG] File size: ${fs.statSync(docxPath).size} bytes`);
  console.log(`📄 [DEBUG] File modified: ${fs.statSync(docxPath).mtime}`);
  const startTime = Date.now();
  
  try {
    // Extract text from DOCX using mammoth
    const result = await mammoth.extractRawText({ path: docxPath });
    const extractedContent = result.value;
    const wordCount = extractedContent.split(/\s+/).filter(word => word.length > 0).length;
    const estimatedTokens = estimateTokens(extractedContent);
    
    console.log(`📊 DOCX extracted ${wordCount} words, ${estimatedTokens.toLocaleString()} tokens`);
    
    // Check if extraction yielded meaningful content
    if (wordCount < 10) {
      throw new Error('DOCX extraction yielded very few words, document may be corrupted or empty');
    }
    
    // Save extracted content if requested
    if (saveExtracted && outputDir) {
      const extractedPath = path.join(outputDir, `${path.basename(docxPath, '.docx')}_extracted.txt`);
      fs.writeFileSync(extractedPath, extractedContent, 'utf8');
    }
    
    const chunks = splitContentByTokens(extractedContent, 100000);
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    return {
      success: true,
      method: 'DOCX-direct',
      wordCount: wordCount,
      chunks: chunks,
      extractedContent: extractedContent,
      processingTime: `${processingTime}s`
    };
    
  } catch (error) {
    throw new Error(`DOCX processing failed: ${error.message}`);
  }
}

module.exports = {
  processDOCX
};