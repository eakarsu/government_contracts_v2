const fs = require('fs');
const path = require('path');

class DocumentAnalyzer {
  constructor() {
    this.supportedTypes = {
      // PDF Documents
      'application/pdf': { extension: '.pdf', type: 'PDF' },
      
      // Microsoft Word Documents
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: '.docx', type: 'Word Document' },
      'application/msword': { extension: '.doc', type: 'Word Document (Legacy)' },
      'application/vnd.ms-word': { extension: '.doc', type: 'Word Document (Legacy)' },
      'application/vnd.ms-word.document.macroEnabled.12': { extension: '.docm', type: 'Word Document (Macro-Enabled)' },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.template': { extension: '.dotx', type: 'Word Template' },
      'application/vnd.ms-word.template.macroEnabled.12': { extension: '.dotm', type: 'Word Template (Macro-Enabled)' },
      
      // Microsoft Excel Documents
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extension: '.xlsx', type: 'Excel Spreadsheet' },
      'application/vnd.ms-excel': { extension: '.xls', type: 'Excel Spreadsheet (Legacy)' },
      'application/vnd.ms-excel.sheet.macroEnabled.12': { extension: '.xlsm', type: 'Excel Spreadsheet (Macro-Enabled)' },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.template': { extension: '.xltx', type: 'Excel Template' },
      'application/vnd.ms-excel.template.macroEnabled.12': { extension: '.xltm', type: 'Excel Template (Macro-Enabled)' },
      'application/vnd.ms-excel.addin.macroEnabled.12': { extension: '.xlam', type: 'Excel Add-In' },
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12': { extension: '.xlsb', type: 'Excel Binary Spreadsheet' },
      
      // Microsoft PowerPoint Documents
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': { extension: '.pptx', type: 'PowerPoint Presentation' },
      'application/vnd.ms-powerpoint': { extension: '.ppt', type: 'PowerPoint Presentation (Legacy)' },
      'application/vnd.ms-powerpoint.presentation.macroEnabled.12': { extension: '.pptm', type: 'PowerPoint Presentation (Macro-Enabled)' },
      'application/vnd.openxmlformats-officedocument.presentationml.template': { extension: '.potx', type: 'PowerPoint Template' },
      'application/vnd.ms-powerpoint.template.macroEnabled.12': { extension: '.potm', type: 'PowerPoint Template (Macro-Enabled)' },
      'application/vnd.ms-powerpoint.slideshow.macroEnabled.12': { extension: '.ppsm', type: 'PowerPoint Slideshow (Macro-Enabled)' },
      'application/vnd.openxmlformats-officedocument.presentationml.slideshow': { extension: '.ppsx', type: 'PowerPoint Slideshow' },
      
      // Microsoft Access and Other Office Documents
      'application/vnd.ms-access': { extension: '.mdb', type: 'Access Database (Legacy)' },
      'application/vnd.ms-access.database': { extension: '.accdb', type: 'Access Database' },
      'application/vnd.ms-project': { extension: '.mpp', type: 'Microsoft Project' },
      'application/vnd.visio': { extension: '.vsd', type: 'Visio Drawing (Legacy)' },
      'application/vnd.ms-visio.drawing': { extension: '.vsdx', type: 'Visio Drawing' },
      'application/vnd.ms-publisher': { extension: '.pub', type: 'Publisher Document' },
      
      // Text and CSV Files
      'text/plain': { extension: '.txt', type: 'Text Document' },
      'text/csv': { extension: '.csv', type: 'CSV File' },
      'application/rtf': { extension: '.rtf', type: 'Rich Text Format' },
      
      // Additional common document types
      'application/vnd.oasis.opendocument.text': { extension: '.odt', type: 'OpenDocument Text' },
      'application/vnd.oasis.opendocument.spreadsheet': { extension: '.ods', type: 'OpenDocument Spreadsheet' },
      'application/vnd.oasis.opendocument.presentation': { extension: '.odp', type: 'OpenDocument Presentation' }
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

    // Modern Office documents (ZIP-based): PK
    if (header[0] === 0x50 && header[1] === 0x4B) {
      // Check for Office Open XML signatures in ZIP
      try {
        const content = buffer.toString('binary', 0, Math.min(buffer.length, 1024));
        
        // Word documents
        if (content.includes('word/') || content.includes('document.xml')) {
          return 'Word Document';
        }
        
        // Excel documents
        if (content.includes('xl/') || content.includes('workbook.xml')) {
          return 'Excel Spreadsheet';
        }
        
        // PowerPoint documents
        if (content.includes('ppt/') || content.includes('presentation.xml')) {
          return 'PowerPoint Presentation';
        }
        
        // Generic Office document if we can't determine specific type
        if (content.includes('_rels/') || content.includes('[Content_Types].xml')) {
          return 'Microsoft Office Document';
        }
      } catch (error) {
        // If we can't parse the ZIP content, assume it's an Office document
        return 'Microsoft Office Document';
      }
    }

    // Legacy Office documents (OLE2/Compound Document)
    if (header[0] === 0xD0 && header[1] === 0xCF && header[2] === 0x11 && header[3] === 0xE0) {
      return 'Microsoft Office Document (Legacy)';
    }

    // RTF documents
    if (header[0] === 0x7B && header[1] === 0x5C && header[2] === 0x72 && header[3] === 0x74) {
      return 'Rich Text Format';
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
      // PDF
      'PDF': '.pdf',
      
      // Word Documents
      'Word Document': '.docx',
      'Word Document (Legacy)': '.doc',
      'Word Document (Macro-Enabled)': '.docm',
      'Word Template': '.dotx',
      'Word Template (Macro-Enabled)': '.dotm',
      
      // Excel Documents
      'Excel Spreadsheet': '.xlsx',
      'Excel Spreadsheet (Legacy)': '.xls',
      'Excel Spreadsheet (Macro-Enabled)': '.xlsm',
      'Excel Template': '.xltx',
      'Excel Template (Macro-Enabled)': '.xltm',
      'Excel Add-In': '.xlam',
      'Excel Binary Spreadsheet': '.xlsb',
      
      // PowerPoint Documents
      'PowerPoint Presentation': '.pptx',
      'PowerPoint Presentation (Legacy)': '.ppt',
      'PowerPoint Presentation (Macro-Enabled)': '.pptm',
      'PowerPoint Template': '.potx',
      'PowerPoint Template (Macro-Enabled)': '.potm',
      'PowerPoint Slideshow': '.ppsx',
      'PowerPoint Slideshow (Macro-Enabled)': '.ppsm',
      
      // Other Microsoft Office
      'Access Database': '.accdb',
      'Access Database (Legacy)': '.mdb',
      'Microsoft Project': '.mpp',
      'Visio Drawing': '.vsdx',
      'Visio Drawing (Legacy)': '.vsd',
      'Publisher Document': '.pub',
      
      // Text and Other
      'Text Document': '.txt',
      'CSV File': '.csv',
      'Rich Text Format': '.rtf',
      'OpenDocument Text': '.odt',
      'OpenDocument Spreadsheet': '.ods',
      'OpenDocument Presentation': '.odp',
      
      // Generic fallbacks
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
