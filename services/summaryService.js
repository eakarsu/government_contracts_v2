const pdfParse = require('pdf-parse');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('../config/env');

// OCR dependencies
const { createWorker, createScheduler } = require('tesseract.js');
const { fromPath } = require('pdf2pic');
const sharp = require('sharp');

// Load environment variables
require('dotenv').config();

// Your existing table detection functions (keep them exactly as they are)
function hasSentenceStructure(row) {
  if (!Array.isArray(row)) return false;
  const fullText = row.join(' ').trim();
  const hasPeriods = /\.\s+[A-Z]/.test(fullText);
  const hasMultipleSentences = (fullText.match(/\./g) || []).length > 1;
  const hasLongSentences = fullText.length > 150;
  const hasConjunctions = /\b(and|but|or|however|therefore|because|since|although|while|when|if|unless|until)\b/i.test(fullText);
  const hasArticles = /\b(the|a|an)\b/gi.test(fullText) && (fullText.match(/\b(the|a|an)\b/gi) || []).length > 2;
  const hasPrepositions = /\b(in|on|at|by|for|with|from|to|of|about|through|during|before|after)\b/gi.test(fullText);
  return hasPeriods || hasMultipleSentences || (hasLongSentences && (hasConjunctions || hasArticles || hasPrepositions));
}

function hasWordRelationships(row) {
  if (!Array.isArray(row)) return false;
  const fullText = row.join(' ').trim();
  const hasExplanations = /\b(based on|analysis of|there is|this is|that is|which is|where the|in order to|due to|as a result|according to)\b/i.test(fullText);
  const hasReferences = /\b(figure|section|page|above|below|following|previous|next|chapter|appendix|table \d+\-\d+)\b/i.test(fullText);
  const hasDescriptive = /\b(very|substantially|significantly|approximately|less than|more than|greater than|similar to|different from|compared to)\b/i.test(fullText);
  const hasComplexPhrases = /\b(construction|development|assessment|evaluation|implementation|consideration|recommendation|conclusion)\b/i.test(fullText);
  return hasExplanations || hasReferences || hasDescriptive || hasComplexPhrases;
}

function isDefinitelyText(row) {
  if (!Array.isArray(row)) return false;
  const fullText = row.join(' ').trim();
  const hasQuestions = /\?/.test(fullText);
  const hasQuotations = /["']/.test(fullText);
  const hasParentheses = /\([^)]{10,}\)/.test(fullText);
  const hasListItems = /\b(first|second|third|finally|additionally|furthermore|moreover|also)\b/i.test(fullText);
  const hasLongWords = (fullText.match(/\b\w{8,}\b/g) || []).length > 3;
  return hasQuestions || hasQuotations || hasParentheses || hasListItems || hasLongWords;
}

function isTableRow(row) {
  if (!Array.isArray(row)) return false;
  if (hasSentenceStructure(row) || hasWordRelationships(row) || isDefinitelyText(row)) {
    return false;
  }
  const cellCount = row.filter(cell => cell && cell.trim()).length;
  if (cellCount < 2) return false;
  
  const hasTableKeywords = row.some(cell =>
    /^(table|segment|ratio|los|period|us|ky|highway|v\/c)$/i.test(cell.toString().trim())
  );
  const hasNumericData = row.some(cell =>
    /^\d+\.\d+$|^[A-Z]$|^(US|KY)\s*\d+$/.test(cell.toString().trim())
  );
  const hasShortCells = row.every(cell =>
    cell.toString().trim().length < 25
  );
  const cellsAreDisconnected = row.length >= 3 && row.every(cell =>
    cell.toString().trim().split(' ').length <= 2
  );
  const allCellsVeryShort = row.every(cell =>
    cell.toString().trim().length < 15
  );
  const strongTableIndicators = hasTableKeywords || hasNumericData || (cellsAreDisconnected && allCellsVeryShort);
  return strongTableIndicators && hasShortCells && cellCount >= 2;
}

function formatTableContent(rows) {
  let content = '';
  let inTable = false;
  let tableCount = 0;
  let currentTableRows = [];
  
  rows.forEach((row, index) => {
    const isTable = isTableRow(row);
    if (isTable) {
      if (!inTable) {
        tableCount++;
        inTable = true;
        currentTableRows = [];
      }
      currentTableRows.push(row);
    } else {
      if (inTable) {
        if (currentTableRows.length >= 2) {
          content += `\n=== Table ${tableCount} ===\n`;
          currentTableRows.forEach(tableRow => {
            const cleanedCells = tableRow
              .filter(cell => cell && cell.trim())
              .map(cell => cell.toString().trim());
            content += cleanedCells.join(' | ') + '\n';
          });
          content += '\n';
        } else {
          tableCount--;
          currentTableRows.forEach(tableRow => {
            const textContent = Array.isArray(tableRow) ? tableRow.join(' ') : tableRow.toString();
            const cleanedText = textContent.replace(/\|/g, '').replace(/\s+/g, ' ').trim();
            if (cleanedText) {
              content += cleanedText + '\n';
            }
          });
        }
        inTable = false;
        currentTableRows = [];
      }
      const textContent = Array.isArray(row) ? row.join(' ') : row.toString();
      const cleanedText = textContent.replace(/\|/g, '').replace(/\s+/g, ' ').trim();
      if (cleanedText) {
        content += cleanedText + '\n';
      }
    }
  });
  
  if (inTable && currentTableRows.length >= 2) {
    content += `\n=== Table ${tableCount} ===\n`;
    currentTableRows.forEach(tableRow => {
      const cleanedCells = tableRow
        .filter(cell => cell && cell.trim())
        .map(cell => cell.toString().trim());
      content += cleanedCells.join(' | ') + '\n';
    });
  } else if (inTable && currentTableRows.length > 0) {
    currentTableRows.forEach(tableRow => {
      const textContent = Array.isArray(tableRow) ? tableRow.join(' ') : tableRow.toString();
      const cleanedText = textContent.replace(/\|/g, '').replace(/\s+/g, ' ').trim();
      if (cleanedText) {
        content += cleanedText + '\n';
      }
    });
  }
  return content;
}

// OCR Functions from your ocr-cli.js
async function convertPdfToImages(pdfPath) {
  // Each document must own its OCR workspace. A shared ./temp_images folder
  // lets one concurrent document delete images that pdf2pic is still writing
  // for another document, which can terminate the entire Node process.
  const tempRoot = path.join(process.cwd(), 'temp_images');
  await fs.ensureDir(tempRoot);
  const tempDir = await fs.mkdtemp(path.join(tempRoot, 'ocr-'));

  try {
    const options = {
      density: 300,
      saveFilename: 'page',
      savePath: tempDir,
      format: 'png',
      width: 3000,
      height: 3000,
      quality: 100
    };

    const convert = fromPath(pdfPath, options);
    const pages = await convert.bulk(-1);
    return { pages, tempDir };
  } catch (error) {
    await cleanupTempFiles(tempDir);
    throw error;
  }
}

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

function cleanTableText(text) {
  return text
    .replace(/[^\w\s\|\-\.\,\:\(\)]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\|\s*\|/g, '|')
    .trim();
}

async function runParallelOCR(pages, tempDir, workerCount = 8) {
  const scheduler = createScheduler();
  const workerPromises = [];
  
  for (let i = 0; i < workerCount; i++) {
    workerPromises.push(
      (async () => {
        const worker = await createWorker('eng');
        scheduler.addWorker(worker);
      })()
    );
  }
  
  await Promise.all(workerPromises);
  console.log(`🔍 Processing ${pages.length} pages with ${workerCount} OCR workers...`);
  
  try {
    const ocrPromises = pages.map(async (page, index) => {
      const imagePath = path.join(tempDir, page.name);
      const processedImagePath = await preprocessImageForOCR(imagePath);
      
      return scheduler.addJob('recognize', processedImagePath, {
        tessedit_pageseg_mode: '6',
        tessedit_ocr_engine_mode: '1',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?-()[]|/ '
      })
      .then(result => {
        console.log(`✅ OCR completed page ${index + 1}/${pages.length}`);
        const cleanedText = cleanTableText(result.data.text);
        return {
          pageNumber: index + 1,
          text: cleanedText
        };
      });
    });
    
    const results = await Promise.all(ocrPromises);
    results.sort((a, b) => a.pageNumber - b.pageNumber);
    
    const allText = results.map(result =>
      `\n--- Page ${result.pageNumber} ---\n${result.text}\n`
    ).join('');
    
    return allText;
  } finally {
    await scheduler.terminate();
  }
}

async function cleanupTempFiles(tempDir) {
  try {
    await fs.remove(tempDir);
    console.log('🧹 Temporary OCR files cleaned up');
  } catch (error) {
    console.warn('⚠️ Warning: Could not clean up temporary files:', error.message);
  }
}

async function processWithOCR(pdfPath) {
  let tempDir;
  try {
    console.log('🖼️ Converting PDF to images for OCR processing...');
    const conversion = await convertPdfToImages(pdfPath);
    tempDir = conversion.tempDir;
    
    const workerCount = Math.min(8, conversion.pages.length);
    const extractedText = await runParallelOCR(conversion.pages, tempDir, workerCount);
    
    return extractedText;
  } catch (error) {
    console.error('❌ OCR processing failed:', error.message);
    throw error;
  } finally {
    if (tempDir) await cleanupTempFiles(tempDir);
  }
}

// Token estimation and splitting
function estimateTokens(text) {
  const words = text.split(/\s+/).length;
  return Math.ceil(words / 0.75);
}

function splitContentByTokens(content, maxTokens = 100000) {
  const chunks = [];
  const lines = content.split('\n');
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const line of lines) {
    const lineTokens = estimateTokens(line);
    if (currentTokens + lineTokens > maxTokens && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      currentChunk = line + '\n';
      currentTokens = lineTokens;
    } else {
      currentChunk += line + '\n';
      currentTokens += lineTokens;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

function parseFirstJsonValue(rawContent) {
  const content = String(rawContent || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const start = content.search(/[\[{]/);
  if (start < 0) throw new Error('No JSON object or array found in the model response');

  const stack = [];
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const character = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{' || character === '[') stack.push(character);
    if (character === '}' || character === ']') {
      const opening = stack.pop();
      if ((opening === '{' && character !== '}') || (opening === '[' && character !== ']')) {
        throw new Error('Mismatched JSON delimiters in the model response');
      }
      if (stack.length === 0) return JSON.parse(content.slice(start, index + 1));
    }
  }
  throw new Error('Incomplete JSON value in the model response');
}

// Optimized summarization function - sends all content in one request using middle-out transform
async function summarizeContent(content, apiKey, isMultiPart = false, partInfo = '', requestOptions = {}) {
  const url = `${config.openRouterBaseUrl.replace(/\/$/, '')}/chat/completions`;
  
  // Check content size but don't chunk - middle-out transform handles up to 280K tokens
  const contentTokens = estimateTokens(content);
  console.log(`📊 [DEBUG] Content size: ${content.length} chars, ~${contentTokens} tokens`);
  console.log(`📊 [DEBUG] Sending entire content in one request using middle-out transform (supports up to 280K tokens)`);
  
  const prompt = `TASK: Analyze government contract document and generate comprehensive RFP response sections.

${isMultiPart ? `SECTION: ${partInfo}` : ''}

CONTRACT DOCUMENT:
"""
${content}
"""

Generate a comprehensive analysis and RFP response content in JSON format. Include all relevant sections that would be needed for a complete RFP response, such as:

- Executive summary with overview and key points
- Technical approach and specifications  
- Management plan and project approach
- Past performance and relevant experience
- Scope of work and deliverables
- Compliance requirements and standards
- Performance metrics and quality measures
- Risk analysis and mitigation strategies
- Implementation guidance and coordination

Structure the response as a JSON object with descriptive field names. Provide detailed, professional content suitable for government contracting. Each section should be comprehensive and address the specific requirements found in the contract document.`;

  try {
    const promptTokens = estimateTokens(prompt);
    console.log(`🔄 [DEBUG] Sending ${promptTokens.toLocaleString()} tokens to OpenRouter API with middle-out transform...`);
    
    const response = await axios.post(url, {
      model: config.openRouterModel,
      messages: [
        {
          role: 'system',
          content: requestOptions.systemPrompt || 'Expert government contract attachment analyst. Return ONLY valid JSON. Follow schema exactly. 10-page depth (~6000 words total).'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: requestOptions.maxTokens || config.rfpMaxTokens,
      temperature: 0.2,
      transforms: ["middle-out"],
      response_format: { type: "json_object" }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://your-app.com',
        'X-Title': 'Government Contract Attachment Analyzer'
      },
      timeout: config.rfpRequestTimeoutMs
    });
    
    console.log(`✅ [DEBUG] API response received, status: ${response.status}`);

    // Check if response has expected structure
    if (!response.data) {
      console.error('❌ No response data received from API');
      return {
        success: false,
        error: 'No response data from API',
        rawResponse: response
      };
    }

    // Handle case where API returns direct string content (not OpenAI format)
    if (typeof response.data === 'string') {
      console.log('📝 API returned direct string content');
      let cleanedResult = response.data.trim();
      
      // Check if the string is just whitespace
      if (!cleanedResult || cleanedResult.length < 10) {
        console.error('❌ API returned empty or whitespace-only content:', JSON.stringify(response.data));
        return {
          success: false,
          error: 'API returned empty content',
          rawResponse: response.data
        };
      }
      
      // Try to parse as JSON
      try {
        const parsedJSON = parseFirstJsonValue(cleanedResult);
        return {
          success: true,
          result: parsedJSON
        };
      } catch (parseError) {
        console.error('❌ Failed to parse direct string response as JSON:', parseError.message);
        return {
          success: false,
          error: 'Direct string response is not valid JSON',
          rawContent: cleanedResult
        };
      }
    }

    // Handle standard OpenAI API format
    if (!response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      console.error('❌ Unexpected API response structure:', JSON.stringify(response.data, null, 2));
      return {
        success: false,
        error: 'Invalid API response structure - missing choices array',
        rawResponse: response.data
      };
    }

    // Clean the JSON response from OpenAI format
    let cleanedResult = response.data.choices[0].message.content;
    console.log(`📝 Raw API content length: ${cleanedResult ? cleanedResult.length : 0}`);
    console.log(`📝 First 200 chars: ${cleanedResult ? cleanedResult.substring(0, 200) : 'null'}`);
    
    // Check if content is empty or just whitespace
    if (!cleanedResult || cleanedResult.trim().length === 0) {
      console.error('❌ API returned empty message content');
      return {
        success: false,
        error: 'API returned empty message content',
        rawResponse: response.data
      };
    }
    
    cleanedResult = cleanedResult
      .replace(/^.*\s*```json/i,'')
      .replace(/^.*\s*```/,'')
      .replace(/```\s*$/, '')
      .trim();
    
    console.log(`📝 Cleaned result length: ${cleanedResult.length}`);
    console.log(`📝 Cleaned result preview: ${cleanedResult.substring(0, 200)}`);

    try {
      const parsedJSON = parseFirstJsonValue(cleanedResult);
      return {
        success: true,
        result: parsedJSON
      };
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError.message);
      console.error('❌ Content that failed to parse:', cleanedResult.substring(0, 500));
      return {
        success: false,
        error: `JSON parsing failed: ${parseError.message}`,
        rawContent: cleanedResult
      };
    }
  } catch (error) {
    console.error('❌ OpenRouter API Error:', error.message);
    if (error.response) {
      console.error('❌ API Response Status:', error.response.status);
      console.error('❌ API Response Headers:', error.response.headers);
      console.error('❌ API Response Data:', error.response.data);
    }
    if (error.code === 'ECONNABORTED') {
      console.error('❌ Request timed out while waiting for OpenRouter');
    }

    const statusCode = error.response?.status;
    const retryAttempt = Number(requestOptions.retryAttempt) || 0;
    if ((statusCode === 402 || statusCode === 429) && retryAttempt < 1) {
      const retryAfterHeader = Number(error.response?.headers?.['retry-after']);
      const retryAfterSeconds = Math.max(1, Math.min(120,
        Number.isFinite(retryAfterHeader) ? retryAfterHeader : 15
      ));
      console.warn(
        `⚠️ OpenRouter capacity is temporarily unavailable; retrying once in ${retryAfterSeconds}s`
      );
      await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000));
      return summarizeContent(content, apiKey, isMultiPart, partInfo, {
        ...requestOptions,
        retryAttempt: retryAttempt + 1
      });
    }

    const providerMessage = error.response?.data?.error?.message;
    
    return {
      success: false,
      error: providerMessage || error.message,
      errorType: error.code || 'unknown',
      statusCode
    };
  }
}

// Main PDF processing function with OCR fallback
async function processPDF(pdfPath, options = {}) {
  const {
    saveExtracted = false,
    outputDir = null
  } = options;

  console.log(`📄 Processing PDF: ${path.basename(pdfPath)}`);
  console.log(`📄 [DEBUG] Full PDF path: ${pdfPath}`);
  console.log(`📄 [DEBUG] File size: ${fs.statSync(pdfPath).size} bytes`);
  console.log(`📄 [DEBUG] File modified: ${fs.statSync(pdfPath).mtime}`);
  const startTime = Date.now();
  
  try {
    const buffer = fs.readFileSync(pdfPath);
    const parsed = await pdfParse(buffer);
    let extractedContent = parsed.text.trim();
    let method = 'pdf-parse';
    let wordCount = extractedContent ? extractedContent.split(/\s+/).length : 0;

    if (wordCount < 100) {
      const ocrContent = await processWithOCR(pdfPath);
      const ocrWordCount = ocrContent.trim() ? ocrContent.trim().split(/\s+/).length : 0;
      if (ocrWordCount > wordCount) {
        extractedContent = ocrContent;
        method = 'OCR (fallback)';
        wordCount = ocrWordCount;
      }
    }

    if (wordCount < 50) {
      throw new Error('PDF extraction yielded too little text for a reliable summary');
    }

    if (saveExtracted && outputDir) {
      const suffix = method.startsWith('OCR') ? '_ocr_extracted.txt' : '_extracted.txt';
      fs.writeFileSync(path.join(outputDir, `${path.basename(pdfPath, '.pdf')}${suffix}`), extractedContent, 'utf8');
    }

    const chunks = splitContentByTokens(extractedContent, 100000);
    return {
      success: true,
      method,
      wordCount,
      chunks,
      extractedContent,
      processingTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
    };
  } catch (error) {
    throw new Error(`PDF processing failed: ${error.message}`);
  }
}


// Export all functions for use in your app
module.exports = {
  // Main functions
  processPDF,
  summarizeContent,
  
  // Utility functions
  estimateTokens,
  splitContentByTokens,
  parseFirstJsonValue,
  
  // OCR functions
  processWithOCR,
  convertPdfToImages,
  runParallelOCR,
  cleanupTempFiles,
  
  // Table detection functions
  formatTableContent,
  isTableRow,
  hasSentenceStructure,
  hasWordRelationships,
  isDefinitelyText
};
