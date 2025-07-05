const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const execPromise = util.promisify(exec);

class LibreOfficeSemaphore {
    constructor(maxConcurrent = 2) {
        this.maxConcurrent = maxConcurrent;
        this.running = 0;
        this.queue = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (this.running < this.maxConcurrent) {
                this.running++;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release() {
        this.running--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.running++;
            next();
        }
    }
}

class PdfConversionService {
  constructor() {
    this.conversionEndpoint = process.env.PDF_CONVERSION_ENDPOINT || 'http://localhost:3001/convert-to-pdf';
    this.timeout = 120000; // 2 minutes timeout
    this.semaphore = new LibreOfficeSemaphore(2);
    this.setupCleanup();
  }

  setupCleanup() {
    // Run cleanup every 5 minutes
    setInterval(() => this.cleanupProcesses(), 300000);
  }

  cleanupProcesses() {
    try {
      exec('pkill -f soffice.bin', (error) => {
        if (!error) {
          console.log('📄➡️📄 [PDF-CONVERT] Cleaned up stuck LibreOffice processes');
        }
      });
      
      exec('pkill -f "libreoffice"', (error) => {
        if (!error) {
          console.log('📄➡️📄 [PDF-CONVERT] Cleaned up stuck LibreOffice main processes');
        }
      });
    } catch (error) {
      console.error('📄➡️📄 [PDF-CONVERT] Error cleaning up processes:', error);
    }
  }

  /**
   * Convert a single document to PDF using LibreOffice
   * @param {string} documentUrl - URL of the document to convert
   * @param {string} originalFilename - Original filename
   * @param {string} contractId - Contract ID for logging
   * @returns {Object} Conversion result with PDF buffer and metadata
   */
  async convertToPdfSingle(documentUrl, originalFilename, contractId) {
    console.log(`📄➡️📄 [PDF-CONVERT] Starting LibreOffice PDF conversion for: ${originalFilename}`);
    console.log(`📄➡️📄 [PDF-CONVERT] Contract ID: ${contractId}`);
    console.log(`📄➡️📄 [PDF-CONVERT] Document URL: ${documentUrl}`);

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

      console.log(`📄➡️📄 [PDF-CONVERT] 🔄 Converting non-PDF document to PDF using LibreOffice: ${originalFilename}`);
      
      // Download the document first
      console.log(`📄➡️📄 [PDF-CONVERT] 📥 Downloading document from: ${documentUrl}`);
      const response = await axios.get(documentUrl, {
        responseType: 'arraybuffer',
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContractIndexer/1.0)',
          'Accept': '*/*'
        }
      });

      const fileBuffer = Buffer.from(response.data);
      console.log(`📄➡️📄 [PDF-CONVERT] ✅ Downloaded ${fileBuffer.length} bytes`);

      // Create temporary directory for conversion
      const tempDir = path.join(process.cwd(), 'temp_conversions', Date.now().toString());
      await fs.ensureDir(tempDir);
      
      // Save the downloaded file
      const fileExt = path.extname(originalFilename).toLowerCase();
      const tempInputPath = path.join(tempDir, `input${fileExt}`);
      await fs.writeFile(tempInputPath, fileBuffer);
      
      console.log(`📄➡️📄 [PDF-CONVERT] 💾 Saved input file to: ${tempInputPath}`);

      // Convert to PDF using LibreOffice
      const conversionResult = await this.convertToPdfWithRetry(tempInputPath, tempDir);
      
      // Find the generated PDF file
      const files = await fs.readdir(tempDir);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
      
      if (pdfFiles.length === 0) {
        throw new Error('No PDF files found after LibreOffice conversion');
      }

      const pdfPath = path.join(tempDir, pdfFiles[0]);
      const pdfBuffer = await fs.readFile(pdfPath);
      const convertedFilename = `${contractId}_${path.basename(originalFilename, fileExt)}.pdf`;
      
      console.log(`📄➡️📄 [PDF-CONVERT] ✅ Conversion successful!`);
      console.log(`📄➡️📄 [PDF-CONVERT] Converted filename: ${convertedFilename}`);
      console.log(`📄➡️📄 [PDF-CONVERT] PDF size: ${pdfBuffer.length} bytes`);

      // Clean up temporary files
      await this.cleanupFiles([tempDir]);

      return {
        success: true,
        isPdf: false,
        wasConverted: true,
        originalUrl: documentUrl,
        originalFilename: originalFilename,
        convertedFilename: convertedFilename,
        pdfBuffer: pdfBuffer,
        pdfUrl: null, // We return the buffer instead of URL
        pdfSize: pdfBuffer.length,
        conversionTime: Date.now(),
        metadata: { method: 'libreoffice' },
        message: 'Document successfully converted to PDF using LibreOffice'
      };

    } catch (error) {
      console.error(`📄➡️📄 [PDF-CONVERT] ❌ LibreOffice conversion failed for: ${originalFilename}`);
      console.error(`📄➡️📄 [PDF-CONVERT] Error type: ${error.constructor.name}`);
      console.error(`📄➡️📄 [PDF-CONVERT] Error message: ${error.message}`);

      return {
        success: false,
        isPdf: false,
        wasConverted: false,
        originalUrl: documentUrl,
        originalFilename: originalFilename,
        error: error.message,
        errorType: error.constructor.name,
        message: `LibreOffice PDF conversion failed: ${error.message}`
      };
    }
  }

  async convertToPdfWithRetry(inputPath, outputDir, maxRetries = 3) {
    const fileExt = path.extname(inputPath).toLowerCase();
    if (fileExt === '.pdf') {
      return { success: true };
    }
    
    await this.acquireSemaphore();
    
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.convertToPdfSingleLibreOffice(inputPath, outputDir);

          const allFiles = await fs.readdir(outputDir);
          // Check if the specific input file has a PDF counterpart
          const inputBaseName = path.basename(inputPath, path.extname(inputPath));
          const hasPDFCounterpart = allFiles.some(f => 
            f.toLowerCase().endsWith('.pdf') && 
            path.basename(f, '.pdf') === inputBaseName
          );

          if (!hasPDFCounterpart) {
            throw new Error('No PDF files found after LibreOffice conversion');
          } else {
            console.log(`📄➡️📄 [PDF-CONVERT] ${inputPath} is successfully translated to pdf`);
          }
          return result;
        } catch (error) {
          console.error(`📄➡️📄 [PDF-CONVERT] LibreOffice conversion attempt ${attempt} failed:`, error.message);
          
          if (error.message.includes('javaldx') || 
              error.message.includes('Java Runtime Environment') ||
              error.message.includes('UserInstallation')) {
            
            if (attempt < maxRetries) {
              const backoffDelay = 1000 * Math.pow(2, attempt - 1);
              console.log(`📄➡️📄 [PDF-CONVERT] Retrying LibreOffice conversion in ${backoffDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
              
              this.cleanupProcesses();
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              continue;
            }
          }
          throw error;
        }
      }
    } finally {
      this.releaseSemaphore();
    }
  }

  async convertToPdfSingleLibreOffice(inputPath, outputDir) {
    const uniqueId = uuidv4();
    const userInstallDir = `/tmp/libreoffice_${uniqueId}`;
    
    try {
      await execPromise(`mkdir -p "${userInstallDir}"`);
      
      const platform = process.platform;
      let libreofficePath;
      
      if (platform === 'darwin') {
        libreofficePath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
      } else if (platform === 'linux') {
        libreofficePath = 'libreoffice';
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      const command = [
        `"${libreofficePath}"`,
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', `"${outputDir}"`,
        `-env:UserInstallation=file://${userInstallDir}`,
        '--norestore',
        '--invisible',
        `"${inputPath}"`
      ].join(' ');

      console.log(`📄➡️📄 [PDF-CONVERT] Converting with unique installation: ${userInstallDir}`);
      await execPromise(command, { timeout: 60000 });
      
      return { success: true, userInstallDir };
      
    } catch (error) {
      throw new Error(`LibreOffice conversion failed: ${error.message}`);
    } finally {
      try {
        await execPromise(`rm -rf "${userInstallDir}"`);
      } catch (cleanupError) {
        console.error(`📄➡️📄 [PDF-CONVERT] Failed to cleanup user installation directory: ${cleanupError.message}`);
      }
    }
  }

  async acquireSemaphore() {
    await this.semaphore.acquire();
  }

  releaseSemaphore() {
    this.semaphore.release();
  }

  async cleanupFiles(filePaths) {
    filePaths.forEach(async (filePath) => {
      if (await fs.pathExists(filePath)) {
        try {
          if ((await fs.stat(filePath)).isDirectory()) {
            await fs.remove(filePath);
          } else {
            await fs.unlink(filePath);
          }
        } catch (error) {
          console.error(`📄➡️📄 [PDF-CONVERT] Error cleaning up ${filePath}:`, error);
        }

        // Clean up files with same base name but different extensions
        try {
          const dir = path.dirname(filePath);
          const baseName = path.basename(filePath, path.extname(filePath));
          
          if (await fs.pathExists(dir)) {
            const files = await fs.readdir(dir);
            for (const file of files) {
              const fullPath = path.join(dir, file);
              const fileBaseName = path.basename(file, path.extname(file));
              
              if (fileBaseName === baseName && (await fs.stat(fullPath)).isFile()) {
                try {
                  await fs.unlink(fullPath);
                  console.log(`📄➡️📄 [PDF-CONVERT] Cleaned up related file: ${fullPath}`);
                } catch (error) {
                  console.error(`📄➡️📄 [PDF-CONVERT] Error cleaning up related file ${fullPath}:`, error);
                }
              }
            }
          }
        } catch (error) {
          console.error(`📄➡️📄 [PDF-CONVERT] Error during extended cleanup for ${filePath}:`, error);
        }
      }
    });
  }

  getStatus() {
    return {
      running: this.semaphore.running,
      queued: this.semaphore.queue.length,
      max_concurrent: this.semaphore.maxConcurrent,
      method: 'libreoffice'
    };
  }

  /**
   * Check if LibreOffice is available
   * @returns {boolean} Service availability status
   */
  async isServiceAvailable() {
    try {
      console.log(`📄➡️📄 [PDF-CONVERT] 🔍 Checking LibreOffice availability...`);
      
      const platform = process.platform;
      let libreofficePath;
      
      if (platform === 'darwin') {
        libreofficePath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
      } else if (platform === 'linux') {
        libreofficePath = 'libreoffice';
      } else {
        console.log(`📄➡️📄 [PDF-CONVERT] ❌ Unsupported platform: ${platform}`);
        return false;
      }

      await execPromise(`"${libreofficePath}" --version`, { timeout: 5000 });
      
      console.log(`📄➡️📄 [PDF-CONVERT] Service status: ✅ LibreOffice Available`);
      return true;
    } catch (error) {
      console.log(`📄➡️📄 [PDF-CONVERT] ❌ LibreOffice is not available: ${error.message}`);
      return false;
    }
  }

  /**
   * Get service configuration and status
   * @returns {Object} Service info
   */
  getServiceInfo() {
    return {
      method: 'libreoffice',
      timeout: this.timeout,
      semaphore_status: this.getStatus(),
      platform: process.platform,
      isConfigured: true
    };
  }
}

module.exports = new PdfConversionService();
