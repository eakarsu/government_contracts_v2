const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { query } = require('../config/database');
const aiService = require('../services/aiService');
const { logger } = require('../utils/logger');

const router = express.Router();

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/documents');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

// Analyze document
router.post('/analyze', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document provided' });
    }

    const { contractId, analysisType = 'general' } = req.body;
    const filePath = req.file.path;
    const originalFilename = req.file.originalname;

    logger.info(`Analyzing document: ${originalFilename} for user ${req.user.id}`);

    // Extract text from document
    let extractedText = '';
    const fileExtension = path.extname(originalFilename).toLowerCase();

    try {
      if (fileExtension === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;
      } else if (fileExtension === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      } else if (fileExtension === '.doc') {
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      } else if (fileExtension === '.txt') {
        extractedText = fs.readFileSync(filePath, 'utf8');
      }
    } catch (parseError) {
      logger.error('Document parsing error:', parseError);
      return res.status(400).json({ error: 'Failed to parse document content' });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'No text content found in document' });
    }

    // Analyze document with AI
    const analysis = await aiService.analyzeDocument(extractedText, analysisType);
    
    // Extract key points and critical clauses
    const keyPointsPrompt = `Extract key points, important dates, and critical clauses from this document:\n\n${extractedText}`;
    const keyPointsAnalysis = await aiService.generateText(keyPointsPrompt, { maxTokens: 1000 });

    // Generate summary
    const summaryPrompt = `Provide a concise executive summary of this document:\n\n${extractedText}`;
    const summary = await aiService.generateText(summaryPrompt, { maxTokens: 500 });

    // Store analysis in database
    const result = await query(`
      INSERT INTO document_analyses (
        contract_id, document_type, file_path, summary, key_points, 
        extracted_data, critical_clauses, analysis_confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      contractId || null,
      analysisType,
      filePath,
      summary,
      JSON.stringify({ keyPoints: keyPointsAnalysis }),
      JSON.stringify({ fullText: extractedText, analysis }),
      JSON.stringify({ analysis: keyPointsAnalysis }),
      0.85 // Default confidence score
    ]);

    const analysisRecord = result.rows[0];

    res.json({
      message: 'Document analyzed successfully',
      analysis: {
        id: analysisRecord.id,
        filename: originalFilename,
        documentType: analysisType,
        summary,
        keyPoints: keyPointsAnalysis,
        fullAnalysis: analysis,
        confidence: 0.85,
        analyzedAt: analysisRecord.created_at
      }
    });

  } catch (error) {
    logger.error('Document analysis error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to analyze document' });
  }
});

module.exports = router;
