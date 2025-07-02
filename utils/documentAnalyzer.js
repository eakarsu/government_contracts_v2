const fs = require('fs');
const path = require('path');

class DocumentAnalyzer {
  constructor() {
    this.supportedTypes = {
      'application/pdf': { extension: '.pdf', type: 'PDF' },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: '.docx', type: 'Word Document' },
      'application/msword': { extension: '.doc', type: 'Word Document (Legacy)' },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extension: '.xlsx', type: 'Excel Spreadsheet' },
      'application/vnd.ms-excel': { extension: '.xls', type: 'Excel Spreadsheet (Legacy)' },
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': { extension: '.pptx', type: 'PowerPoint Presentation' },
      'application/vnd.ms-powerpoint': { extension: '.ppt', type: 'PowerPoint Presentation (Legacy)' },
      'text/plain': { extension: '.txt', type: 'Text Document' },
      'text/csv': { extension: '.csv', type: 'CSV File' }
    };
  }

  /**
   * Analyze document from buffer and detect type, pages, etc.
   * @param {Buffer} buffer - Document buffer
   * @param {string} filename - Original filename
   * @param {string} contentType - HTTP content type
   * @returns {Object} Analysis result
   */
  analyzeDocument(buffer, filename, contentType) {
    console.log(`📄 [DEBUG] Analyzing document: ${filename}`);
    console.log(`📄 [DEBUG] Content-Type: ${contentType}`);
    console.log(`📄 [DEBUG] Buffer size: ${buffer.length} bytes`);

    const analysis = {
      filename,
      size: buffer.length,
      contentType,
      documentType: 'Unknown',
      extension: path.extname(filename).toLowerCase(),
      isSupported: false,
      isZipFile: false,
      estimatedPages: 0,
      metadata: {}
    };

    // Check if it's a ZIP file (exclude these)
    if (this.isZipFile(buffer, contentType, filename)) {
      analysis.isZipFile = true;
      analysis.documentType = 'ZIP Archive';
      console.log(`⚠️ [DEBUG] Document is a ZIP file - excluding from processing`);
      return analysis;
    }

    // Detect document type
    const detectedType = this.detectDocumentType(buffer, contentType, filename);
    analysis.documentType = detectedType.type;
    analysis.isSupported = detectedType.isSupported;

    if (analysis.isSupported) {
      // Estimate page count based on document type
      analysis.estimatedPages = this.estimatePageCount(buffer, detectedType.type, analysis.size);
      console.log(`📄 [DEBUG] Document type: ${analysis.documentType}`);
      console.log(`📄 [DEBUG] Estimated pages: ${analysis.estimatedPages}`);
    } else {
      console.log(`⚠️ [DEBUG] Unsupported document type: ${analysis.documentType}`);
    }

    return analysis;
  }

  /**
   * Check if document is a ZIP file
   */
  isZipFile(buffer, contentType, filename) {
    // Check content type
    if (contentType && (
      contentType.includes('zip') || 
      contentType.includes('compressed') ||
      contentType === 'application/x-zip-compressed'
    )) {
      return true;
    }

    // Check file extension
    const ext = path.extname(filename).toLowerCase();
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
      return true;
    }

    // Check ZIP file signature (magic bytes)
    if (buffer.length >= 4) {
      const signature = buffer.slice(0, 4);
      // ZIP file starts with "PK" (0x504B)
      if (signature[0] === 0x50 && signature[1] === 0x4B) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect document type from buffer and metadata
   */
  detectDocumentType(buffer, contentType, filename) {
    const ext = path.extname(filename).toLowerCase();

    // First try content type
    if (contentType && this.supportedTypes[contentType]) {
      return {
        type: this.supportedTypes[contentType].type,
        isSupported: true
      };
    }

    // Then try file extension
    for (const [mimeType, info] of Object.entries(this.supportedTypes)) {
      if (info.extension === ext) {
        return {
          type: info.type,
          isSupported: true
        };
      }
    }

    // Try to detect by magic bytes
    const magicType = this.detectByMagicBytes(buffer);
    if (magicType) {
      return {
        type: magicType,
        isSupported: true
      };
    }

    return {
      type: `Unknown (${ext || 'no extension'})`,
      isSupported: false
    };
  }

  /**
   * Detect document type by magic bytes (file signatures)
   */
  detectByMagicBytes(buffer) {
    if (buffer.length < 8) return null;

    const header = buffer.slice(0, 8);

    // PDF: %PDF
    if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
      return 'PDF';
    }

    // Office documents (ZIP-based): PK (then look for specific files)
    if (header[0] === 0x50 && header[1] === 0x4B) {
      // This could be a modern Office document (.docx, .xlsx, .pptx)
      // We'd need to examine the ZIP contents to be sure, but for now assume Office
      return 'Microsoft Office Document';
    }

    // Legacy Office documents
    if (header[0] === 0xD0 && header[1] === 0xCF && header[2] === 0x11 && header[3] === 0xE0) {
      return 'Microsoft Office Document (Legacy)';
    }

    return null;
  }

  /**
   * Estimate page count based on document type and size
   */
  estimatePageCount(buffer, documentType, size) {
    // These are rough estimates based on typical document sizes
    
    if (documentType.includes('PDF')) {
      return this.estimatePdfPages(buffer, size);
    }
    
    if (documentType.includes('Word')) {
      // Rough estimate: 2KB per page for Word documents
      return Math.max(1, Math.round(size / 2048));
    }
    
    if (documentType.includes('Excel')) {
      // Excel sheets are harder to estimate, assume 1 sheet per 10KB
      return Math.max(1, Math.round(size / 10240));
    }
    
    if (documentType.includes('PowerPoint')) {
      // Rough estimate: 50KB per slide
      return Math.max(1, Math.round(size / 51200));
    }
    
    if (documentType.includes('Text')) {
      // Rough estimate: 3KB per page for text documents
      return Math.max(1, Math.round(size / 3072));
    }

    // Default fallback
    return Math.max(1, Math.round(size / 5120)); // 5KB per page
  }

  /**
   * Estimate PDF page count (basic implementation)
   */
  estimatePdfPages(buffer, size) {
    try {
      const content = buffer.toString('binary');
      
      // Look for /Count entries which often indicate page count
      const countMatches = content.match(/\/Count\s+(\d+)/g);
      if (countMatches && countMatches.length > 0) {
        const counts = countMatches.map(match => parseInt(match.match(/\d+/)[0]));
        const maxCount = Math.max(...counts);
        if (maxCount > 0 && maxCount < 10000) { // Sanity check
          return maxCount;
        }
      }

      // Fallback: count page objects
      const pageMatches = content.match(/\/Type\s*\/Page[^s]/g);
      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }

      // Final fallback: estimate by size (average 50KB per page)
      return Math.max(1, Math.round(size / 51200));
    } catch (error) {
      console.warn('Error analyzing PDF structure, using size-based estimate');
      return Math.max(1, Math.round(size / 51200));
    }
  }

  /**
   * Check if document type is supported for processing
   */
  isSupportedType(contentType, filename) {
    const analysis = this.analyzeDocument(Buffer.alloc(0), filename, contentType);
    return analysis.isSupported && !analysis.isZipFile;
  }

  /**
   * Get the correct file extension based on document type
   */
  getCorrectExtension(documentType, originalExtension) {
    const typeToExtension = {
      'PDF': '.pdf',
      'Word Document': '.docx',
      'Word Document (Legacy)': '.doc',
      'Excel Spreadsheet': '.xlsx',
      'Excel Spreadsheet (Legacy)': '.xls',
      'PowerPoint Presentation': '.pptx',
      'PowerPoint Presentation (Legacy)': '.ppt',
      'Text Document': '.txt',
      'CSV File': '.csv',
      'Microsoft Office Document': '.docx', // Default for modern Office
      'Microsoft Office Document (Legacy)': '.doc' // Default for legacy Office
    };

    // Return the correct extension based on document type
    const correctExtension = typeToExtension[documentType];
    if (correctExtension) {
      return correctExtension;
    }

    // Fallback to original extension if we can't determine the type
    return originalExtension || '.bin';
  }

  /**
   * Generate a proper filename with correct extension
   */
  generateProperFilename(originalFilename, documentType, contractId) {
    const correctExtension = this.getCorrectExtension(documentType, '');
    const baseName = originalFilename ? 
      originalFilename.replace(/\.[^/.]+$/, '') : // Remove existing extension
      `document_${Date.now()}`;
    
    return `${contractId}_${baseName}${correctExtension}`;
  }
}

module.exports = new DocumentAnalyzer();
