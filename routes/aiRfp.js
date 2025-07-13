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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/rfp-documents');
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
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, DOC, DOCX, TXT'), false);
    }
  }
});

// Upload and analyze RFP document
router.post('/upload', upload.single('rfpDocument'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No RFP document provided' });
    }

    const { contractId } = req.body;
    const filePath = req.file.path;
    const originalFilename = req.file.originalname;

    logger.info(`Processing RFP document: ${originalFilename} for user ${req.user.id}`);

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
    const analysis = await aiService.analyzeDocument(extractedText, 'rfp');
    const requirements = await aiService.extractDocumentRequirements(extractedText);

    // Store RFP document in database
    const result = await query(`
      INSERT INTO rfp_documents (
        user_id, contract_id, original_filename, file_path, 
        parsed_content, requirements, sections
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      req.user.id,
      contractId || null,
      originalFilename,
      filePath,
      JSON.stringify({ text: extractedText, analysis }),
      JSON.stringify(requirements),
      JSON.stringify(requirements.sections || [])
    ]);

    const rfpDocument = result.rows[0];

    res.json({
      message: 'RFP document uploaded and analyzed successfully',
      document: {
        id: rfpDocument.id,
        filename: rfpDocument.original_filename,
        analysis,
        requirements: requirements.requirements || [],
        deadlines: requirements.deadlines || [],
        sections: requirements.sections || [],
        evaluationCriteria: requirements.evaluation_criteria || {},
        contactInfo: requirements.contact_info || {},
        uploadedAt: rfpDocument.created_at
      }
    });

  } catch (error) {
    logger.error('RFP upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to process RFP document' });
  }
});

// Get user's RFP documents
router.get('/documents', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id, original_filename, contract_id, 
        parsed_content, requirements, sections, created_at
      FROM rfp_documents 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `, [req.user.id]);

    const documents = result.rows.map(row => ({
      id: row.id,
      filename: row.original_filename,
      contractId: row.contract_id,
      requirements: JSON.parse(row.requirements || '{}'),
      sections: JSON.parse(row.sections || '[]'),
      uploadedAt: row.created_at,
      hasAnalysis: !!row.parsed_content
    }));

    res.json({ documents });

  } catch (error) {
    logger.error('Get RFP documents error:', error);
    res.status(500).json({ error: 'Failed to retrieve RFP documents' });
  }
});

module.exports = router;
