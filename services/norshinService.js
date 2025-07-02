const axios = require('axios');
const fs = require('fs-extra');
const config = require('../config/env');

// Utility function to send file to Norshin API
const sendToNorshinAPI = async (filePath, originalName, customPrompt = '', model = 'openai/gpt-4.1') => {
  try {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
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
