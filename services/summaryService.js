const pdf2table = require('pdf2table');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

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
  const tempDir = './temp_images';
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
  try {
    console.log('🖼️ Converting PDF to images for OCR processing...');
    const { pages, tempDir } = await convertPdfToImages(pdfPath);
    
    const workerCount = Math.min(8, pages.length);
    const extractedText = await runParallelOCR(pages, tempDir, workerCount);
    
    await cleanupTempFiles(tempDir);
    
    return extractedText;
  } catch (error) {
    console.error('❌ OCR processing failed:', error.message);
    throw error;
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

// Optimized summarization function - sends all content in one request using middle-out transform
async function summarizeContent(content, apiKey, isMultiPart = false, partInfo = '') {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  
  // Check content size but don't chunk - middle-out transform handles up to 280K tokens
  const contentTokens = estimateTokens(content);
  console.log(`📊 [DEBUG] Content size: ${content.length} chars, ~${contentTokens} tokens`);
  console.log(`📊 [DEBUG] Sending entire content in one request using middle-out transform (supports up to 280K tokens)`);
  
  const prompt = `TASK: Analyze government contract attachment document. Return 10-page equivalent analysis in JSON.

${isMultiPart ? `SECTION: ${partInfo}` : ''}

ATTACHMENT DOCUMENT:
"""
${content}
"""

JSON SCHEMA:
{
  "attachment_metadata": {"title": "string", "type": "SOW/PWS/Specs/Amendment", "contract_reference": "string", "attachment_number": "string", "revision": "string", "effective_date": "string"},
  "executive_summary": {"overview": "800 words", "key_provisions": ["string"], "changes_from_base": ["string"], "impact_assessment": "400 words"},
  "technical_specifications": {"requirements": [{"requirement": "string", "description": "300 words", "compliance_standard": "string", "testing_method": "string"}], "performance_standards": "600 words", "quality_metrics": ["metric"]},
  "scope_deliverables": {"statement_of_work": "1000 words", "deliverables": [{"name": "string", "description": "200 words", "acceptance_criteria": "string", "due_date": "string"}], "milestones": [{"milestone": "string", "date": "string", "deliverable": "string"}]},
  "compliance_requirements": {"standards": [{"standard": "string", "requirement": "200 words", "verification": "string"}], "certifications": ["certification"], "reporting": "300 words", "inspection_testing": "400 words"},
  "contract_modifications": {"changes": [{"change_type": "string", "description": "300 words", "rationale": "200 words", "cost_impact": "string"}], "amendment_history": "400 words", "effective_provisions": "300 words"},
  "performance_metrics": {"kpis": [{"metric": "string", "target": "string", "measurement": "string", "penalty": "string"}], "service_levels": "400 words", "monitoring": "300 words"},
  "risk_analysis": {"attachment_risks": [{"risk": "string", "description": "300 words", "probability": "H/M/L", "mitigation": ["string"]}], "compliance_risks": "400 words", "performance_risks": "300 words"},
  "implementation_guidance": {"execution_approach": "500 words", "resource_requirements": "300 words", "coordination": "300 words", "quality_assurance": "400 words"}
}`;

  try {
    const promptTokens = estimateTokens(prompt);
    console.log(`🔄 [DEBUG] Sending ${promptTokens.toLocaleString()} tokens to OpenRouter API with middle-out transform...`);
    
    const response = await axios.post(url, {
      model: 'openai/gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'Expert government contract attachment analyst. Return ONLY valid JSON. Follow schema exactly. 10-page depth (~6000 words total).'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 16000,
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
      timeout: 180000 // Increased to 3 minutes for large documents with middle-out
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
        const parsedJSON = JSON.parse(cleanedResult);
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
      const parsedJSON = JSON.parse(cleanedResult);
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
      console.error('❌ Request timed out after 90 seconds');
    }
    
    return {
      success: false,
      error: error.response?.data || error.message,
      errorType: error.code || 'unknown',
      statusCode: error.response?.status
    };
  }
}

// Main PDF processing function with OCR fallback
async function processPDF(pdfPath, options = {}) {
  const {
    apiKey = process.env.REACT_APP_OPENROUTER_KEY,
    saveExtracted = false,
    outputDir = null
  } = options;
  
  if (!apiKey) {
    throw new Error('API key is required (REACT_APP_OPENROUTER_KEY)');
  }

  console.log(`📄 Processing PDF: ${path.basename(pdfPath)}`);
  console.log(`📄 [DEBUG] Full PDF path: ${pdfPath}`);
  console.log(`📄 [DEBUG] File size: ${fs.statSync(pdfPath).size} bytes`);
  console.log(`📄 [DEBUG] File modified: ${fs.statSync(pdfPath).mtime}`);
  const startTime = Date.now();
  
  try {
    const buffer = fs.readFileSync(pdfPath);
    
    return new Promise((resolve, reject) => {
      // First try pdf2table
      pdf2table.parse(buffer, async function (err, rows, rowsdebug) {
        try {
          if (err) {
            console.log('❌ pdf2table failed, trying OCR fallback...');
            
            const ocrContent = await processWithOCR(pdfPath);
            const wordCount = ocrContent.split(/\s+/).length;
            
            console.log(`📊 OCR extracted ${wordCount} words`);
            
            if (wordCount < 50) {
              throw new Error('OCR extraction yielded very few words, document may be problematic');
            }
            
            // Save extracted content if requested
            if (saveExtracted && outputDir) {
              const extractedPath = path.join(outputDir, `${path.basename(pdfPath, '.pdf')}_ocr_extracted.txt`);
              fs.writeFileSync(extractedPath, ocrContent, 'utf8');
            }
            
            const chunks = splitContentByTokens(ocrContent, 100000);
            console.log(`📝 OCR content split into ${chunks.length} chunk(s)`);
            
            const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
            
            resolve({
              success: true,
              method: 'OCR',
              wordCount: wordCount,
              chunks: chunks,
              extractedContent: ocrContent,
              processingTime: `${processingTime}s`
            });
            return;
          }
          
          // pdf2table succeeded
          const extractedContent = formatTableContent(rows);
          const wordCount = extractedContent.split(/\s+/).length;
          const estimatedTokens = estimateTokens(extractedContent);
          
          console.log(`📊 pdf2table extracted ${wordCount} words, ${estimatedTokens.toLocaleString()} tokens`);
          
          // Check if we need OCR fallback (less than 100 words)
          if (wordCount < 100) {
            console.log(`⚠️ Low word count (${wordCount} < 100), switching to OCR processing...`);
            
            const ocrContent = await processWithOCR(pdfPath);
            const ocrWordCount = ocrContent.split(/\s+/).length;
            
            console.log(`📊 OCR extracted ${ocrWordCount} words (vs ${wordCount} from pdf2table)`);
            
            if (ocrWordCount > wordCount * 2) {
              console.log('✅ Using OCR content (significantly more text extracted)');
              
              // Save extracted content if requested
              if (saveExtracted && outputDir) {
                const extractedPath = path.join(outputDir, `${path.basename(pdfPath, '.pdf')}_ocr_extracted.txt`);
                fs.writeFileSync(extractedPath, ocrContent, 'utf8');
              }
              
              const chunks = splitContentByTokens(ocrContent, 100000);
              const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
              
              resolve({
                success: true,
                method: 'OCR (fallback)',
                wordCount: ocrWordCount,
                chunks: chunks,
                extractedContent: ocrContent,
                processingTime: `${processingTime}s`
              });
              return;
            }
          }
          
          // Continue with pdf2table content
          // Save extracted content if requested
          if (saveExtracted && outputDir) {
            const extractedPath = path.join(outputDir, `${path.basename(pdfPath, '.pdf')}_extracted.txt`);
            fs.writeFileSync(extractedPath, extractedContent, 'utf8');
          }
          
          const chunks = splitContentByTokens(extractedContent, 100000);
          const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
          
          resolve({
            success: true,
            method: 'pdf2table',
            wordCount: wordCount,
            chunks: chunks,
            extractedContent: extractedContent,
            processingTime: `${processingTime}s`
          });
          
        } catch (error) {
          reject(error);
        }
      });
    });
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
