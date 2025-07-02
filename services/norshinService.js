const axios = require('axios');
const fs = require('fs-extra');
const config = require('../config/env');

// Utility function to send file to Norshin API
const sendToNorshinAPI = async (filePathOrUrl, originalName, customPrompt = '', model = 'openai/gpt-4.1') => {
  try {
    let fileBuffer;
    
    // Check if it's a URL or local file path
    if (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://')) {
      // Download the file from URL
      console.log(`Downloading document from: ${filePathOrUrl}`);
      const downloadResponse = await axios.get(filePathOrUrl, {
        responseType: 'arraybuffer',
        timeout: 60000, // 1 minute timeout for download
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)'
        }
      });
      fileBuffer = Buffer.from(downloadResponse.data);
      console.log(`Downloaded ${fileBuffer.length} bytes`);
    } else {
      // Read local file
      fileBuffer = fs.readFileSync(filePathOrUrl);
    }
    
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    
    formData.append('document', blob, originalName);
    if (customPrompt) formData.append('customPrompt', customPrompt);
    if (model) formData.append('model', model);

    const response = await axios.post(config.norshinApiUrl, formData, {
      headers: {
        'X-API-Key': config.norshinApiKey,
        'Content-Type': 'multipart/form-data'
      },
      timeout: 120000 // 2 minutes timeout
    });

    return response.data;
  } catch (error) {
    console.error('Norshin API Error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendToNorshinAPI
};
