const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class PdfConversionService {
  constructor() {
    this.conversionEndpoint = process.env.PDF_CONVERSION_ENDPOINT || 'http://localhost:3001/convert-to-pdf';
    this.timeout = 120000; // 2 minutes timeout
  }

  /**
   * Convert a single document to PDF
   * @param {string} documentUrl - URL of the document to convert
   * @param {string} originalFilename - Original filename
   * @param {string} contractId - Contract ID for logging
   * @returns {Object} Conversion result with PDF buffer and metadata
   */
  async convertToPdfSingle(documentUrl, originalFilename, contractId) {
    console.log(`📄➡️📄 [PDF-CONVERT] Starting PDF conversion for: ${originalFilename}`);
    console.log(`📄➡️📄 [PDF-CONVERT] Contract ID: ${contractId}`);
    console.log(`📄➡️📄 [PDF-CONVERT] Document URL: ${documentUrl}`);
    console.log(`📄➡️📄 [PDF-CONVERT] Conversion endpoint: ${this.conversionEndpoint}`);

    try {
      // Check if document is already a PDF
      const urlLower = documentUrl.toLowerCase();
      const filenameLower = originalFilename.toLowerCase();
      
      if (urlLower.includes('.pdf') || filenameLower.includes('.pdf')) {
        console.log(`📄➡️📄 [PDF-CONVERT] ✅ Document is already a PDF, skipping conversion: ${originalFilename}`);
        return {
          success: true,
          isPdf: true,
          originalUrl: documentUrl,
          originalFilename: originalFilename,
          message: 'Document is already a PDF, no conversion needed'
        };
      }

      console.log(`📄➡️📄 [PDF-CONVERT] 🔄 Converting non-PDF document to PDF: ${originalFilename}`);
      
      // Prepare conversion request
      const conversionRequest = {
        documentUrl: documentUrl,
        originalFilename: originalFilename,
        contractId: contractId,
        outputFormat: 'pdf',
        options: {
          preserveFormatting: true,
          includeMetadata: true
        }
      };

      console.log(`📄➡️📄 [PDF-CONVERT] 📤 Sending conversion request...`);
      console.log(`📄➡️📄 [PDF-CONVERT] Request payload:`, JSON.stringify(conversionRequest, null, 2));

      // Make conversion request
      const response = await axios.post(this.conversionEndpoint, conversionRequest, {
        timeout: this.timeout,
        responseType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ContractProcessor/1.0'
        }
      });

      console.log(`📄➡️📄 [PDF-CONVERT] 📥 Conversion response received`);
      console.log(`📄➡️📄 [PDF-CONVERT] Response status: ${response.status}`);
      console.log(`📄➡️📄 [PDF-CONVERT] Response headers:`, response.headers);

      if (response.status === 200 && response.data) {
        const result = response.data;
        
        console.log(`📄➡️📄 [PDF-CONVERT] ✅ Conversion successful!`);
        console.log(`📄➡️📄 [PDF-CONVERT] Converted filename: ${result.convertedFilename || 'N/A'}`);
        console.log(`📄➡️📄 [PDF-CONVERT] PDF size: ${result.pdfSize || 'N/A'} bytes`);
        console.log(`📄➡️📄 [PDF-CONVERT] Conversion time: ${result.conversionTime || 'N/A'}ms`);

        return {
          success: true,
          isPdf: false,
          wasConverted: true,
          originalUrl: documentUrl,
          originalFilename: originalFilename,
          convertedFilename: result.convertedFilename,
          pdfBuffer: result.pdfBuffer ? Buffer.from(result.pdfBuffer, 'base64') : null,
          pdfUrl: result.pdfUrl,
          pdfSize: result.pdfSize,
          conversionTime: result.conversionTime,
          metadata: result.metadata || {},
          message: 'Document successfully converted to PDF'
        };
      } else {
        throw new Error(`Conversion service returned status ${response.status}`);
      }

    } catch (error) {
      console.error(`📄➡️📄 [PDF-CONVERT] ❌ Conversion failed for: ${originalFilename}`);
      console.error(`📄➡️📄 [PDF-CONVERT] Error type: ${error.constructor.name}`);
      console.error(`📄➡️📄 [PDF-CONVERT] Error message: ${error.message}`);
      
      if (error.response) {
        console.error(`📄➡️📄 [PDF-CONVERT] HTTP Status: ${error.response.status}`);
        console.error(`📄➡️📄 [PDF-CONVERT] Response data:`, error.response.data);
      }
      
      if (error.code === 'ECONNREFUSED') {
        console.error(`📄➡️📄 [PDF-CONVERT] ❌ PDF conversion service is not available at: ${this.conversionEndpoint}`);
      }

      return {
        success: false,
        isPdf: false,
        wasConverted: false,
        originalUrl: documentUrl,
        originalFilename: originalFilename,
        error: error.message,
        errorType: error.constructor.name,
        message: `PDF conversion failed: ${error.message}`
      };
    }
  }

  /**
   * Check if PDF conversion service is available
   * @returns {boolean} Service availability status
   */
  async isServiceAvailable() {
    try {
      console.log(`📄➡️📄 [PDF-CONVERT] 🔍 Checking PDF conversion service availability...`);
      
      const response = await axios.get(`${this.conversionEndpoint}/health`, {
        timeout: 5000
      });
      
      const isAvailable = response.status === 200;
      console.log(`📄➡️📄 [PDF-CONVERT] Service status: ${isAvailable ? '✅ Available' : '❌ Unavailable'}`);
      
      return isAvailable;
    } catch (error) {
      console.log(`📄➡️📄 [PDF-CONVERT] ❌ PDF conversion service is not available: ${error.message}`);
      return false;
    }
  }

  /**
   * Get service configuration and status
   * @returns {Object} Service info
   */
  getServiceInfo() {
    return {
      endpoint: this.conversionEndpoint,
      timeout: this.timeout,
      isConfigured: !!process.env.PDF_CONVERSION_ENDPOINT
    };
  }
}

module.exports = new PdfConversionService();
