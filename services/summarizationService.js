const fs = require('fs-extra');
const path = require('path');
const config = require('../config/env');
const documentAnalyzer = require('../utils/documentAnalyzer');

// Import your PDF processing service
const pdfService = require('./summaryService.js'); // Adjust path as needed
const axios = require('axios');

// Utility function to send file to Norshin API (now using local PDF processing)
const summarizeContent = async (filePathOrUrl, originalName, customPrompt = '', model = 'openai/gpt-4.1') => {
  try {
    let fileBuffer;
    let tempFilePath = null;
    let pdfPath = filePathOrUrl;
    
    // Check if it's a URL or local file path
    if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
      // Download the file from URL
      const tempDir = './temp_downloads';
      await fs.ensureDir(tempDir);
      
      tempFilePath = path.join(tempDir, `download_${Date.now()}_${originalName}`);
      
      const response = await axios.get(filePathOrUrl, {
        responseType: 'arraybuffer',
        timeout: 60000, // Reduced timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)',
          'Accept': '*/*'
        }
      });

      fileBuffer = Buffer.from(response.data);
      await fs.writeFile(tempFilePath, fileBuffer);
      pdfPath = tempFilePath;
    } else {
      // Read local file
      if (!fs.existsSync(filePathOrUrl)) {
        throw new Error(`File not found: ${filePathOrUrl}`);
      }
      fileBuffer = fs.readFileSync(filePathOrUrl);
    }
    
    // Quick document analysis
    const contentType = path.extname(originalName).toLowerCase();
    const analysis = documentAnalyzer.analyzeDocument(fileBuffer, originalName, contentType);
    
    // Skip unsupported files quickly
    if (analysis.isZipFile) {
      throw new Error(`ZIP files not supported: ${originalName}`);
    }
    
    if (!analysis.isSupported) {
      throw new Error(`Unsupported type: ${analysis.documentType}`);
    }
    
    // Generate correct filename
    const correctExtension = documentAnalyzer.getCorrectExtension(analysis.documentType, analysis.extension);
    const properFilename = originalName.includes('_') ?
      originalName.split('_')[0] + '_' + originalName.split('_').slice(1).join('_').replace(/\.[^/.]+$/, '') + correctExtension :
      originalName.replace(/\.[^/.]+$/, '') + correctExtension;
    
    originalName = properFilename;
    
    // Handle PDF conversion efficiently
    const fileExt = path.extname(pdfPath).toLowerCase();
    let finalPdfPath = pdfPath;
    
    if (fileExt !== '.pdf') {
      const LibreOfficeService = require('./libreoffice.service');
      const libreOfficeService = new LibreOfficeService();
      
      const actualFileName = path.basename(pdfPath);
      const actualFileExt = path.extname(actualFileName);
      const actualBaseName = path.basename(actualFileName, actualFileExt);
      const tempDir = path.join(process.cwd(), 'temp_summarization', `${Date.now()}_${actualBaseName}`);
      await fs.ensureDir(tempDir);
      
      try {
        await libreOfficeService.convertToPdfWithRetry(pdfPath, tempDir);
        
        const files = await fs.readdir(tempDir);
        const pdfFile = files.find(file => file.toLowerCase().endsWith('.pdf'));
        
        if (pdfFile) {
          finalPdfPath = path.join(tempDir, pdfFile);
        } else {
          throw new Error('No PDF file found after conversion');
        }
        
      } catch (conversionError) {
        try {
          await fs.remove(tempDir);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        throw new Error(`PDF conversion failed: ${conversionError.message}`);
      }
    }
    
    // Now call processPDF on the PDF file (either original or converted)
    const extractResult = await pdfService.processPDF(finalPdfPath, {
      apiKey: process.env.REACT_APP_OPENROUTER_KEY,
      saveExtracted: false,
      outputDir: null
    });
    
    // Clean up temp conversion directory if it was created
    if (fileExt !== '.pdf' && finalPdfPath.includes('temp_summarization')) {
      try {
        const tempDir = path.dirname(finalPdfPath);
        await fs.remove(tempDir);
        console.log(`🗑️ [DEBUG] Cleaned up temp conversion directory: ${tempDir}`);
      } catch (cleanupError) {
        console.warn(`⚠️ [DEBUG] Could not clean up temp conversion directory: ${cleanupError.message}`);
      }
    }
    
    if (!extractResult.success) {
      throw new Error(`PDF extraction failed: ${extractResult.error}`);
    }
    
    console.log(`✅ Extraction completed: ${extractResult.method}, ${extractResult.wordCount} words content, content:${extractResult.extractedContent}`);
    
    // Create enhanced prompt if custom prompt provided (keeping original Norshin logic)
    let contentToSummarize = extractResult.extractedContent;
    if (customPrompt) {
      contentToSummarize = `${customPrompt}\n\nDocument Content:\n${extractResult.extractedContent}`;
    }
    
    // Summarize content using your local service
    const summaryResult = await pdfService.summarizeContent(
      contentToSummarize,
      process.env.REACT_APP_OPENROUTER_KEY
    );
    
    if (!summaryResult.success) {
      throw new Error(`Local summarization failed: ${summaryResult.error}`);
    }
    
    console.log(`✅ [DEBUG] Local analysis completed successfully: ${JSON.stringify(summaryResult, null, 2) }`);
    
    // Clean up temp file if it was downloaded (keeping original Norshin logic)
    if (tempFilePath) {
      try {
        await fs.remove(tempFilePath);
        console.log(`🗑️ [DEBUG] Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`⚠️ [DEBUG] Failed to clean up temp file: ${cleanupError.message}`);
      }
    }
    
    // Return the response data in the same format as original Norshin service
    const responseData = summaryResult.result;
    
    // Add corrected filename if needed (keeping original Norshin logic)
    if (originalName !== (filePathOrUrl.startsWith('http') ? filePathOrUrl.split('/').pop() : filePathOrUrl)) {
      responseData.correctedFilename = originalName;
    }
    
    return responseData;
    
  } catch (error) {
    console.error('Norshin API Error:', error.response?.data || error.message);
    throw error;
  }
};


module.exports = {
  summarizeContent
};

