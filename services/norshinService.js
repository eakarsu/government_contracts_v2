const axios = require('axios');
const fs = require('fs-extra');
const config = require('../config/env');
const documentAnalyzer = require('../utils/documentAnalyzer');

// Utility function to send file to Norshin API
const sendToNorshinAPI = async (filePathOrUrl, originalName, customPrompt = '', model = 'openai/gpt-4.1') => {
  try {
    // If filePathOrUrl is null, we're processing text content only
    if (filePathOrUrl === null) {
      // Process text content directly (no file upload)
      if (!customPrompt) {
        throw new Error('Custom prompt is required when processing text content');
      }
      
      console.log(`Processing text content with AI analysis...`);
      
      const response = await axios.post(config.norshinApiUrl + '/analyze-text', {
        text: customPrompt,
        model: model
      }, {
        headers: {
          'X-API-Key': config.norshinApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 3600000 // 1 hour timeout
      });

      return response.data;
    }

    let fileBuffer;
    
    // Check if it's a URL or local file path
    if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
      // Download the file from URL
      console.log(`📥 [DEBUG] Downloading document from: ${filePathOrUrl}`);
      const downloadResponse = await axios.get(filePathOrUrl, {
        responseType: 'arraybuffer',
        timeout: 3600000, // 1 hour timeout for download
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)'
        }
      });
      fileBuffer = Buffer.from(downloadResponse.data);
      console.log(`📥 [DEBUG] Downloaded ${fileBuffer.length} bytes`);

      // Analyze the downloaded document
      const contentType = downloadResponse.headers['content-type'] || '';
      const analysis = documentAnalyzer.analyzeDocument(fileBuffer, originalName, contentType);
      
      console.log(`📄 [DEBUG] Document Analysis:`);
      console.log(`📄 [DEBUG] - Type: ${analysis.documentType}`);
      console.log(`📄 [DEBUG] - Size: ${analysis.size} bytes`);
      console.log(`📄 [DEBUG] - Original Extension: ${analysis.extension}`);
      console.log(`📄 [DEBUG] - Estimated Pages: ${analysis.estimatedPages}`);
      console.log(`📄 [DEBUG] - Supported: ${analysis.isSupported}`);
      console.log(`📄 [DEBUG] - Is ZIP: ${analysis.isZipFile}`);

      // Skip ZIP files
      if (analysis.isZipFile) {
        console.log(`⚠️ [DEBUG] Skipping ZIP file: ${originalName}`);
        throw new Error(`ZIP files are not supported: ${originalName}`);
      }

      // Skip unsupported types
      if (!analysis.isSupported) {
        console.log(`⚠️ [DEBUG] Skipping unsupported document type: ${analysis.documentType}`);
        throw new Error(`Unsupported document type: ${analysis.documentType}`);
      }

      // Generate correct filename with proper extension
      const correctExtension = documentAnalyzer.getCorrectExtension(analysis.documentType, analysis.extension);
      const properFilename = originalName.includes('_') ? 
        originalName.split('_')[0] + '_' + originalName.split('_').slice(1).join('_').replace(/\.[^/.]+$/, '') + correctExtension :
        originalName.replace(/\.[^/.]+$/, '') + correctExtension;
      
      console.log(`📄 [DEBUG] - Correct Extension: ${correctExtension}`);
      console.log(`📄 [DEBUG] - Proper Filename: ${properFilename}`);

      // Update originalName to use the correct extension
      originalName = properFilename;

    } else {
      // Read local file
      fileBuffer = fs.readFileSync(filePathOrUrl);
      
      // Analyze the local file
      const analysis = documentAnalyzer.analyzeDocument(fileBuffer, originalName, '');
      
      console.log(`📄 [DEBUG] Local Document Analysis:`);
      console.log(`📄 [DEBUG] - Type: ${analysis.documentType}`);
      console.log(`📄 [DEBUG] - Size: ${analysis.size} bytes`);
      console.log(`📄 [DEBUG] - Original Extension: ${analysis.extension}`);
      console.log(`📄 [DEBUG] - Estimated Pages: ${analysis.estimatedPages}`);
      console.log(`📄 [DEBUG] - Supported: ${analysis.isSupported}`);
      console.log(`📄 [DEBUG] - Is ZIP: ${analysis.isZipFile}`);

      // Skip ZIP files
      if (analysis.isZipFile) {
        console.log(`⚠️ [DEBUG] Skipping ZIP file: ${originalName}`);
        throw new Error(`ZIP files are not supported: ${originalName}`);
      }

      // Skip unsupported types
      if (!analysis.isSupported) {
        console.log(`⚠️ [DEBUG] Skipping unsupported document type: ${analysis.documentType}`);
        throw new Error(`Unsupported document type: ${analysis.documentType}`);
      }

      // Generate correct filename with proper extension for local files
      const correctExtension = documentAnalyzer.getCorrectExtension(analysis.documentType, analysis.extension);
      const properFilename = originalName.replace(/\.[^/.]+$/, '') + correctExtension;
      
      console.log(`📄 [DEBUG] - Correct Extension: ${correctExtension}`);
      console.log(`📄 [DEBUG] - Proper Filename: ${properFilename}`);

      // Update originalName to use the correct extension
      originalName = properFilename;
    }
    
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    
    formData.append('document', blob, originalName);
    if (customPrompt) formData.append('customPrompt', customPrompt);
    if (model) formData.append('model', model);

    console.log(`📤 [DEBUG] Sending document to Norshin API: ${config.norshinApiUrl}`);
    console.log(`📤 [DEBUG] Document filename: ${originalName}`);
    
    const response = await axios.post(config.norshinApiUrl, formData, {
      headers: {
        'X-API-Key': config.norshinApiKey,
        'Content-Type': 'multipart/form-data'
      },
      timeout: 3600000 // 1 hour timeout
    });

    // Return the response data along with the corrected filename
    const responseData = response.data;
    if (originalName !== (filePathOrUrl.startsWith('http') ? filePathOrUrl.split('/').pop() : filePathOrUrl)) {
      responseData.correctedFilename = originalName;
    }

    return responseData;
  } catch (error) {
    console.error('Norshin API Error:', error.response?.data || error.message);
    throw error;
  }
};

// Utility function to process text content with AI (no file upload)
const processTextWithAI = async (textContent, analysisType = 'summary', model = 'openai/gpt-4.1') => {
  console.log(`🤖 [DEBUG] processTextWithAI called with:`, {
    textLength: textContent?.length || 0,
    analysisType,
    model
  });
  
  try {
    const prompt = `Analyze this government contract document and provide a detailed ${analysisType}. 

Document Content:
${textContent}

Please provide:
1. Key findings
2. Important clauses
3. Risk assessment
4. Summary of terms`;

    console.log(`🤖 [DEBUG] Processing text content with AI for ${analysisType}...`);
    console.log(`🤖 [DEBUG] Norshin API URL: ${config.norshinApiUrl}`);
    console.log(`🤖 [DEBUG] Text endpoint URL: ${config.norshinApiUrl}/analyze-text`);
    console.log(`🤖 [DEBUG] API Key present: ${!!config.norshinApiKey}`);
    
    // If Norshin API has a text-only endpoint, use it
    // Otherwise, create a temporary text file and send it
    const response = await axios.post(config.norshinApiUrl + '/analyze-text', {
      text: prompt,
      model: model,
      analysis_type: analysisType
    }, {
      headers: {
        'X-API-Key': config.norshinApiKey,
        'Content-Type': 'application/json'
      },
      timeout: 3600000 // 1 hour timeout
    });

    console.log(`✅ [DEBUG] Norshin API response received:`, response.status);
    return response.data;
  } catch (error) {
    console.log(`⚠️ [DEBUG] Text endpoint failed:`, error.message);
    console.log(`🔄 [DEBUG] Trying file upload fallback...`);
    
    // Fallback: if text endpoint doesn't exist, use the regular file endpoint
    console.log('Text endpoint not available, using file upload fallback...');
    
    // Create a temporary text file
    const tempFilePath = `/tmp/temp_analysis_${Date.now()}.txt`;
    console.log(`📁 [DEBUG] Creating temp file: ${tempFilePath}`);
    
    await fs.writeFile(tempFilePath, textContent);
    
    try {
      console.log(`🔄 [DEBUG] Calling sendToNorshinAPI with temp file...`);
      const result = await sendToNorshinAPI(
        tempFilePath, 
        'document_analysis.txt', 
        `Analyze this document and provide: ${analysisType}`, 
        model
      );
      
      // Clean up temp file
      console.log(`🗑️ [DEBUG] Cleaning up temp file...`);
      await fs.remove(tempFilePath);
      
      console.log(`✅ [DEBUG] Fallback method succeeded`);
      return result;
    } catch (fallbackError) {
      console.error(`❌ [DEBUG] Fallback method also failed:`, fallbackError.message);
      // Clean up temp file even if processing fails
      await fs.remove(tempFilePath).catch(() => {});
      throw fallbackError;
    }
  }
};

module.exports = {
  sendToNorshinAPI,
  processTextWithAI
};
