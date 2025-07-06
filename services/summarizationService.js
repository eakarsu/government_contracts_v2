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
    console.log(`📤 [DEBUG] Processing document locally: ${originalName}`);
    

    let fileBuffer;
    let tempFilePath = null;
    let pdfPath = filePathOrUrl;
    
    // Check if it's a URL or local file path
    if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
      // Download the file from URL
      console.log(`📥 [DEBUG] Downloading document from: ${filePathOrUrl}`);
      
      // Create temp directory
      const tempDir = './temp_downloads';
      await fs.ensureDir(tempDir);
      
      // Download file manually using axios
      tempFilePath = path.join(tempDir, `download_${Date.now()}_${originalName}`);
      
      const response = await axios.get(filePathOrUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)',
          'Accept': '*/*'
        }
      });

      fileBuffer = Buffer.from(response.data);
      await fs.writeFile(tempFilePath, fileBuffer);
      console.log(`📥 [DEBUG] Downloaded ${fileBuffer.length} bytes`);
      
      // Use the downloaded file path for processing
      pdfPath = tempFilePath;
    } else {
      // Read local file
      if (!fs.existsSync(filePathOrUrl)) {
        throw new Error(`File not found: ${filePathOrUrl}`);
      }
      fileBuffer = fs.readFileSync(filePathOrUrl);
    }
    
    // Analyze the document (keeping original Norshin logic)
    const contentType = path.extname(originalName).toLowerCase();
    const analysis = documentAnalyzer.analyzeDocument(fileBuffer, originalName, contentType);
    
    console.log(`📄 [DEBUG] Document Analysis:`);
    console.log(`📄 [DEBUG] - Type: ${analysis.documentType}`);
    console.log(`📄 [DEBUG] - Size: ${analysis.size} bytes`);
    console.log(`📄 [DEBUG] - Original Extension: ${analysis.extension}`);
    console.log(`📄 [DEBUG] - Estimated Pages: ${analysis.estimatedPages} pages`);
    console.log(`📄 [DEBUG] - Supported: ${analysis.isSupported}`);
    console.log(`📄 [DEBUG] - Is ZIP: ${analysis.isZipFile}`);
    
    // Skip ZIP files (keeping original Norshin logic)
    if (analysis.isZipFile) {
      console.log(`⚠️ [DEBUG] Skipping ZIP file: ${originalName}`);
      throw new Error(`ZIP files are not supported: ${originalName}`);
    }
    
    // Skip unsupported types (keeping original Norshin logic)
    if (!analysis.isSupported) {
      console.log(`⚠️ [DEBUG] Skipping unsupported document type: ${analysis.documentType}`);
      throw new Error(`Unsupported document type: ${analysis.documentType}`);
    }
    
    // Generate correct filename with proper extension (keeping original Norshin logic)
    const correctExtension = documentAnalyzer.getCorrectExtension(analysis.documentType, analysis.extension);
    const properFilename = originalName.includes('_') ?
      originalName.split('_')[0] + '_' + originalName.split('_').slice(1).join('_').replace(/\.[^/.]+$/, '') + correctExtension :
      originalName.replace(/\.[^/.]+$/, '') + correctExtension;
    
    console.log(`📄 [DEBUG] - Correct Extension: ${correctExtension}`);
    console.log(`📄 [DEBUG] - Proper Filename: ${properFilename}`);
    
    // Update originalName to use the correct extension
    originalName = properFilename;
    
    console.log(`🔄 [DEBUG] Processing document with local service...`);
    
    // Check if document needs PDF conversion first
    const fileExt = path.extname(pdfPath).toLowerCase();
    let finalPdfPath = pdfPath;
    
    if (fileExt !== '.pdf') {
      console.log(`📄➡️📄 [CONVERT] Document needs PDF conversion: ${originalName} (${fileExt})`);
      
      // Import LibreOffice service
      const LibreOfficeService = require('./libreoffice.service');
      const libreOfficeService = new LibreOfficeService();
      
      // Create temp directory for conversion
      const tempDir = path.join(process.cwd(), 'temp_summarization', `${Date.now()}_${path.basename(originalName, fileExt)}`);
      await fs.ensureDir(tempDir);
      
      try {
        // Convert to PDF using LibreOffice
        console.log(`📄➡️📄 [CONVERT] Converting ${fileExt} to PDF: ${pdfPath}`);
        await libreOfficeService.convertToPdfWithRetry(pdfPath, tempDir);
        
        // Find the converted PDF
        const files = await fs.readdir(tempDir);
        const pdfFile = files.find(file => file.toLowerCase().endsWith('.pdf'));
        
        if (pdfFile) {
          finalPdfPath = path.join(tempDir, pdfFile);
          console.log(`📄➡️📄 [CONVERT] ✅ Conversion successful: ${finalPdfPath}`);
        } else {
          throw new Error('No PDF file found after LibreOffice conversion');
        }
        
      } catch (conversionError) {
        console.error(`📄➡️📄 [CONVERT] ❌ Conversion failed: ${conversionError.message}`);
        // Clean up temp directory
        try {
          await fs.remove(tempDir);
        } catch (cleanupError) {
          console.warn(`⚠️ [DEBUG] Could not clean up temp directory: ${cleanupError.message}`);
        }
        throw new Error(`PDF conversion failed: ${conversionError.message}`);
      }
    } else {
      console.log(`📄➡️📄 [CONVERT] Document is already PDF: ${originalName}`);
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

