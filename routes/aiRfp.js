const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { query } = require('../config/database');
const aiService = require('../services/aiService');
const config = require('../config/env');

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

// GET /api/ai-rfp/documents
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

    res.json({
      success: true,
      documents
    });
  } catch (error) {
    console.error('Error fetching RFP documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RFP documents'
    });
  }
});

// GET /api/ai-rfp/proposals
router.get('/proposals', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id, title, sections_data, status, version, 
        created_at, updated_at
      FROM proposals 
      WHERE user_id = $1 
      ORDER BY updated_at DESC
    `, [req.user.id]);

    const proposals = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      sections: JSON.parse(row.sections_data || '[]'),
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      success: true,
      proposals
    });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch proposals'
    });
  }
});

// POST /api/ai-rfp/upload
router.post('/upload', upload.single('rfpDocument'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No RFP document provided' 
      });
    }

    const { contractId } = req.body;
    const filePath = req.file.path;
    const originalFilename = req.file.originalname;

    console.log(`Processing RFP document: ${originalFilename} for user ${req.user.id}`);

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
      console.error('Document parsing error:', parseError);
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to parse document content' 
      });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No text content found in document' 
      });
    }

    // Analyze document with AI
    const analysis = await aiService.analyzeDocument(extractedText, 'rfp');

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
      JSON.stringify(analysis.requirements),
      JSON.stringify(analysis.sections)
    ]);

    const rfpDocument = result.rows[0];

    res.json({
      success: true,
      message: 'RFP document uploaded and analyzed successfully',
      document: {
        id: rfpDocument.id,
        filename: rfpDocument.original_filename,
        contractId: rfpDocument.contract_id,
        requirements: JSON.parse(rfpDocument.requirements),
        sections: JSON.parse(rfpDocument.sections),
        uploadedAt: rfpDocument.created_at,
        hasAnalysis: true
      }
    });

  } catch (error) {
    console.error('RFP upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process RFP document' 
    });
  }
});

// POST /api/ai-rfp/generate-proposal
router.post('/generate-proposal', async (req, res) => {
  try {
    const { rfpDocumentId, title } = req.body;
    
    // Find the RFP document
    const rfpDoc = mockDocuments.find(doc => doc.id === rfpDocumentId);
    if (!rfpDoc) {
      return res.status(404).json({
        success: false,
        error: 'RFP document not found'
      });
    }
    
    // Generate realistic proposal sections based on RFP requirements
    const generatedSections = rfpDoc.sections.map(section => {
      const sampleContent = generateSectionContent(section.title);
      const wordCount = sampleContent.split(/\s+/).length;
      
      return {
        id: `${section.id}-${Date.now()}`,
        sectionId: section.id,
        title: section.title,
        content: sampleContent,
        wordCount,
        status: 'generated',
        compliance: {
          wordLimit: { 
            current: wordCount, 
            maximum: section.wordLimit, 
            compliant: wordCount <= section.wordLimit 
          },
          requirementCoverage: { 
            covered: getRandomRequirements(section.title), 
            missing: [], 
            percentage: Math.floor(Math.random() * 20) + 80 
          }
        },
        lastModified: new Date().toISOString(),
        modifiedBy: 'AI Assistant'
      };
    });
    
    const proposal = {
      id: `prop-${Date.now()}`,
      title: title || `Proposal for ${rfpDoc.filename}`,
      sections: generatedSections,
      status: 'draft',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    mockProposals.push(proposal);
    
    res.json({
      success: true,
      proposal
    });
  } catch (error) {
    console.error('Error generating proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate proposal'
    });
  }
});

// Helper function to generate realistic section content
function generateSectionContent(sectionTitle) {
  const contentTemplates = {
    'Executive Summary': 'Our organization brings extensive experience and proven capabilities to deliver exceptional results for this critical project. We understand the unique requirements and challenges outlined in the RFP and have assembled a world-class team of experts to ensure successful project execution. Our approach combines innovative methodologies with industry best practices to deliver solutions that exceed expectations while maintaining the highest standards of quality and security.',
    
    'Technical Approach': 'Our technical methodology leverages cutting-edge technologies and proven frameworks to deliver robust, scalable solutions. We employ agile development practices, continuous integration/continuous deployment (CI/CD) pipelines, and comprehensive testing strategies. Our architecture follows industry standards for security, performance, and maintainability. Key technical components include cloud-native infrastructure, microservices architecture, API-first design, and advanced monitoring and analytics capabilities.',
    
    'Management Plan': 'Our project management approach follows PMI best practices and agile methodologies to ensure successful delivery. We have established clear governance structures, communication protocols, and risk management procedures. Our experienced project managers will provide regular status updates, milestone tracking, and proactive issue resolution. Quality assurance processes are integrated throughout the project lifecycle to maintain the highest standards of deliverable quality.',
    
    'Cost Proposal': 'Our pricing structure reflects competitive market rates while ensuring the highest quality deliverables. We have carefully analyzed the project requirements and allocated resources efficiently to provide maximum value. Our cost model includes transparent pricing for all project phases, with detailed breakdowns for labor, materials, and overhead costs. We offer flexible payment terms and are committed to delivering within the proposed budget constraints.',
    
    'Past Performance': 'Our organization has successfully completed numerous similar projects for government and commercial clients. We maintain an excellent track record of on-time delivery, budget adherence, and customer satisfaction. Our team includes certified professionals with relevant security clearances and specialized expertise in the required domains. References from previous clients are available upon request to demonstrate our commitment to excellence.',
    
    'Software Architecture': 'Our software architecture follows modern design principles including modularity, scalability, and maintainability. We utilize containerized microservices, event-driven architecture, and cloud-native technologies. The system design incorporates robust security measures, comprehensive logging and monitoring, and automated testing frameworks. Our architecture supports high availability, disaster recovery, and seamless integration with existing systems.',
    
    'Testing Strategy': 'Our comprehensive testing approach includes unit testing, integration testing, system testing, and user acceptance testing. We employ automated testing frameworks, continuous testing pipelines, and performance testing tools. Security testing, accessibility testing, and compatibility testing are integral components of our quality assurance process. Test coverage metrics and defect tracking ensure thorough validation of all system components.',
    
    'Security Plan': 'Our security framework implements defense-in-depth strategies with multiple layers of protection. We follow NIST cybersecurity guidelines, implement zero-trust architecture principles, and maintain compliance with relevant security standards. Security measures include encryption at rest and in transit, multi-factor authentication, role-based access controls, and continuous security monitoring. Regular security assessments and penetration testing ensure ongoing protection against emerging threats.'
  };
  
  return contentTemplates[sectionTitle] || `Detailed ${sectionTitle.toLowerCase()} content will be developed based on the specific requirements outlined in the RFP. Our approach emphasizes innovation, quality, and customer satisfaction while maintaining compliance with all specified standards and regulations.`;
}

// Helper function to generate random requirements coverage
function getRandomRequirements(sectionTitle) {
  const requirementsBySection = {
    'Executive Summary': ['Project understanding', 'Key benefits', 'Team qualifications'],
    'Technical Approach': ['Architecture design', 'Technology stack', 'Implementation methodology'],
    'Management Plan': ['Project timeline', 'Resource allocation', 'Risk management'],
    'Cost Proposal': ['Labor costs', 'Material costs', 'Overhead expenses'],
    'Past Performance': ['Similar projects', 'Client references', 'Success metrics'],
    'Software Architecture': ['System design', 'Scalability', 'Security integration'],
    'Testing Strategy': ['Test planning', 'Automation framework', 'Quality metrics'],
    'Security Plan': ['Threat assessment', 'Security controls', 'Compliance measures']
  };
  
  const requirements = requirementsBySection[sectionTitle] || ['General requirements', 'Quality standards', 'Compliance measures'];
  const numCovered = Math.floor(Math.random() * requirements.length) + 1;
  return requirements.slice(0, numCovered);
}

// GET /api/ai-rfp/proposals/:id
router.get('/proposals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Mock proposal data
    const proposal = {
      id,
      title: 'Sample Proposal',
      sections: [],
      status: 'draft',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      proposal
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch proposal'
    });
  }
});

module.exports = router;
