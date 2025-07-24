// OCR processing utilities extracted from summaryService.js
// Functions for PDF to image conversion and parallel OCR processing

const { createWorker, createScheduler } = require('tesseract.js');
const { fromPath } = require('pdf2pic');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Convert PDF to images for OCR processing
async function convertPdfToImages(pdfPath) {
  // Create unique temp directory to avoid race conditions in parallel processing
  const uniqueId = uuidv4();
  const tempDir = path.join(process.cwd(), 'temp_images', `ocr_${uniqueId}_${Date.now()}`);
  await fs.ensureDir(tempDir);
  
  const options = {
    density: 300,
    saveFilename: "page",
    savePath: tempDir,
    format: "png",
    width: 3000,
    height: 3000,
    quality: 100
  };
  
  const convert = fromPath(pdfPath, options);
  const pages = await convert.bulk(-1);
  return { pages, tempDir };
}

// Preprocess image for better OCR results
async function preprocessImageForOCR(imagePath) {
  const outputPath = imagePath.replace('.png', '_processed.png');
  await sharp(imagePath)
    .greyscale()
    .normalize()
    .sharpen()
    .threshold(128)
    .toFile(outputPath);
  return outputPath;
}

// Clean OCR text output
function cleanTableText(text) {
  return text
    .replace(/[^\w\s\|\-\.\,\:\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\|\s*\|/g, '|')
    .trim();
}

// Run parallel OCR processing on multiple pages with proper error handling
async function runParallelOCR(pages, tempDir, workerCount = 8) {
  const scheduler = createScheduler();
  const workers = [];
  
  try {
    // Create workers with error handling
    console.log(`🔍 Creating ${workerCount} OCR workers...`);
    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = await createWorker('eng');
        if (worker && worker.worker) {
          workers.push(worker);
          scheduler.addWorker(worker);
          console.log(`✅ Worker ${i + 1}/${workerCount} created successfully`);
        } else {
          console.warn(`⚠️ Worker ${i + 1} creation failed - worker is null`);
        }
      } catch (error) {
        console.error(`❌ Failed to create worker ${i + 1}:`, error.message);
      }
    }
    
    if (workers.length === 0) {
      throw new Error('No OCR workers could be created');
    }
    
    console.log(`🔍 Processing ${pages.length} pages with ${workers.length} OCR workers...`);
    
    const ocrPromises = pages.map(async (page, index) => {
      const imagePath = path.join(tempDir, page.name);
      
      try {
        const processedImagePath = await preprocessImageForOCR(imagePath);
        
        // Add retry mechanism for OCR jobs
        let retries = 3;
        while (retries > 0) {
          try {
            const result = await scheduler.addJob('recognize', processedImagePath, {
              tessedit_pageseg_mode: '6',
              tessedit_ocr_engine_mode: '1',
              preserve_interword_spaces: '1',
              tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?-()[]|/ '
            });
            
            console.log(`✅ OCR completed page ${index + 1}/${pages.length}`);
            const cleanedText = cleanTableText(result.data.text);
            return {
              pageNumber: index + 1,
              text: cleanedText,
              success: true
            };
          } catch (error) {
            retries--;
            if (error.message && error.message.includes('postMessage')) {
              console.error(`❌ Worker null error on page ${index + 1}, retries left: ${retries}`);
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
                continue;
              }
            }
            throw error;
          }
        }
      } catch (error) {
        console.error(`❌ OCR failed for page ${index + 1}:`, error.message);
        return {
          pageNumber: index + 1,
          text: '',
          success: false,
          error: error.message
        };
      }
    });
    
    const results = await Promise.allSettled(ocrPromises);
    const successfulResults = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => result.value);
    
    if (successfulResults.length === 0) {
      throw new Error('All OCR operations failed');
    }
    
    successfulResults.sort((a, b) => a.pageNumber - b.pageNumber);
    
    const allText = successfulResults.map(result =>
      `\n--- Page ${result.pageNumber} ---\n${result.text}\n`
    ).join('');
    
    console.log(`📊 OCR completed: ${successfulResults.length}/${pages.length} pages successful`);
    
    return allText;
  } finally {
    // Properly terminate scheduler and workers
    try {
      await scheduler.terminate();
    } catch (error) {
      console.warn('⚠️ Warning during scheduler termination:', error.message);
    }
    
    // Terminate individual workers as backup
    for (const worker of workers) {
      try {
        if (worker && typeof worker.terminate === 'function') {
          await worker.terminate();
        }
      } catch (error) {
        console.warn('⚠️ Warning during worker termination:', error.message);
      }
    }
  }
}

// Clean up temporary OCR files
async function cleanupTempFiles(tempDir) {
  try {
    await fs.remove(tempDir);
    console.log('🧹 Temporary OCR files cleaned up');
  } catch (error) {
    console.warn('⚠️ Warning: Could not clean up temporary files:', error.message);
  }
}

// Main OCR processing function with enhanced error handling
async function processWithOCR(pdfPath) {
  let tempDir = null;
  
  try {
    console.log('🖼️ Converting PDF to images for OCR processing...');
    
    // Validate PDF file exists
    if (!await fs.pathExists(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }
    
    const { pages, tempDir: convertedTempDir } = await convertPdfToImages(pdfPath);
    tempDir = convertedTempDir;
    
    if (!pages || pages.length === 0) {
      throw new Error('No pages could be extracted from PDF');
    }
    
    console.log(`📄 Extracted ${pages.length} pages for OCR processing`);
    
    // Reduce worker count for stability - limit to max 4 workers
    const workerCount = Math.min(4, pages.length, 4);
    console.log(`🔧 Using ${workerCount} OCR workers for stability`);
    
    const extractedText = await runParallelOCR(pages, tempDir, workerCount);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('OCR extracted no text from document');
    }
    
    await cleanupTempFiles(tempDir);
    
    return extractedText;
  } catch (error) {
    console.error('❌ OCR processing failed:', error.message);
    
    // Cleanup temp files even on error
    if (tempDir) {
      try {
        await cleanupTempFiles(tempDir);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup temp files after OCR error:', cleanupError.message);
      }
    }
    
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

module.exports = {
  convertPdfToImages,
  preprocessImageForOCR,
  cleanTableText,
  runParallelOCR,
  cleanupTempFiles,
  processWithOCR
};