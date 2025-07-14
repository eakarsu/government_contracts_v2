const { Pool } = require('pg');
const AIService = require('./aiService');
const logger = require('../utils/logger');
const fs = require('fs-extra');
const path = require('path');
const PDFDocument = require('pdfkit');

class ProposalDraftingService {
  constructor() {
    this.aiService = AIService;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async parseRFPDocument(userId, contractId, filePath) {
    try {
      // Read document content
      const content = await fs.readFile(filePath, 'utf8');
      
      // Extract requirements using AI
      const requirements = await this.aiService.extractDocumentRequirements(content);
      
      // Parse document structure
      const sections = await this.extractSections(content);
      
      // Store RFP document
      const query = `
        INSERT INTO rfp_documents (
          user_id, contract_id, original_filename, file_path,
          parsed_content, requirements, sections
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        userId,
        contractId,
        path.basename(filePath),
        filePath,
        JSON.stringify({ content: content.substring(0, 10000) }),
        JSON.stringify(requirements),
        JSON.stringify(sections)
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error parsing RFP document:', error);
      throw error;
    }
  }

  async extractSections(content) {
    try {
      // Use AI to identify document sections
      const prompt = `Analyze this RFP document and identify the main sections. Return as JSON array with fields: title, content, requirements, pageNumber:\n\n${content.substring(0, 8000)}`;
      
      const response = await this.aiService.generateChatCompletion([
        { role: 'system', content: 'Extract document sections from RFP documents. Return structured JSON.' },
        { role: 'user', content: prompt }
      ]);

      return JSON.parse(response);
    } catch (error) {
      logger.error('Error extracting sections:', error);
      return [];
    }
  }

  async createProposalDraft(rfpDocumentId, userId, title) {
    try {
      // Get RFP document
      const rfpQuery = 'SELECT * FROM rfp_documents WHERE id = $1';
      const rfpResult = await this.pool.query(rfpQuery, [rfpDocumentId]);
      
      if (rfpResult.rows.length === 0) {
        throw new Error('RFP document not found');
      }

      const rfpDoc = rfpResult.rows[0];
      const requirements = JSON.parse(rfpDoc.requirements);
      const sections = JSON.parse(rfpDoc.sections);

      // Get user's business profile
      const profileQuery = 'SELECT * FROM business_profiles WHERE user_id = $1';
      const profileResult = await this.pool.query(profileQuery, [userId]);
      
      const businessProfile = profileResult.rows[0] || {};

      // Generate proposal sections
      const proposalSections = await this.generateProposalSections(sections, requirements, businessProfile);

      // Calculate initial compliance status
      const complianceStatus = await this.checkCompliance(proposalSections, requirements);

      // Create proposal draft
      const query = `
        INSERT INTO proposal_drafts (
          rfp_document_id, user_id, title, sections, compliance_status
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        rfpDocumentId,
        userId,
        title,
        JSON.stringify(proposalSections),
        JSON.stringify(complianceStatus)
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating proposal draft:', error);
      throw error;
    }
  }

  async generateProposalSections(sections, requirements, businessProfile) {
    const proposalSections = [];

    for (const section of sections) {
      try {
        const sectionContent = await this.aiService.generateProposalSection(
          section.requirements || section.content,
          section.title,
          businessProfile
        );

        proposalSections.push({
          id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: section.title,
          content: sectionContent,
          requirements: section.requirements || [],
          wordCount: sectionContent.split(' ').length,
          status: 'generated',
          lastModified: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`Error generating section ${section.title}:`, error);
        proposalSections.push({
          id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: section.title,
          content: 'Error generating content. Please edit manually.',
          requirements: section.requirements || [],
          wordCount: 0,
          status: 'error',
          lastModified: new Date().toISOString()
        });
      }
    }

    return proposalSections;
  }

  async checkCompliance(proposalSections, requirements) {
    try {
      const complianceChecks = {
        wordLimits: this.checkWordLimits(proposalSections, requirements),
        requiredSections: this.checkRequiredSections(proposalSections, requirements),
        formatCompliance: this.checkFormatCompliance(proposalSections, requirements),
        requirementCoverage: await this.checkRequirementCoverage(proposalSections, requirements)
      };

      const overallScore = Object.values(complianceChecks).reduce((sum, check) => sum + check.score, 0) / 4;
      const overallPassed = Object.values(complianceChecks).every(check => check.passed);

      return {
        overall: overallPassed,
        score: overallScore,
        checks: complianceChecks,
        issues: this.generateComplianceIssues(complianceChecks)
      };
    } catch (error) {
      logger.error('Error checking compliance:', error);
      return {
        overall: false,
        score: 0,
        checks: {},
        issues: ['Error checking compliance']
      };
    }
  }

  checkWordLimits(sections, requirements) {
    const wordLimitIssues = [];
    let totalCompliant = 0;
    let totalSections = sections.length;

    sections.forEach(section => {
      const wordLimit = requirements.wordLimits?.[section.title];
      if (wordLimit && section.wordCount > wordLimit) {
        wordLimitIssues.push(`${section.title}: ${section.wordCount}/${wordLimit} words`);
      } else {
        totalCompliant++;
      }
    });

    return {
      passed: wordLimitIssues.length === 0,
      score: totalSections > 0 ? totalCompliant / totalSections : 1,
      details: wordLimitIssues.length > 0 ? `Word limit exceeded: ${wordLimitIssues.join(', ')}` : 'All word limits met'
    };
  }

  checkRequiredSections(sections, requirements) {
    const requiredSections = requirements.requiredSections || [];
    const sectionTitles = sections.map(s => s.title.toLowerCase());
    const missingSections = requiredSections.filter(req => 
      !sectionTitles.some(title => title.includes(req.toLowerCase()))
    );

    return {
      passed: missingSections.length === 0,
      score: requiredSections.length > 0 ? (requiredSections.length - missingSections.length) / requiredSections.length : 1,
      details: missingSections.length > 0 ? `Missing sections: ${missingSections.join(', ')}` : 'All required sections present'
    };
  }

  checkFormatCompliance(sections, requirements) {
    // Basic format compliance check
    const formatIssues = [];
    
    sections.forEach(section => {
      if (section.content.length < 100) {
        formatIssues.push(`${section.title}: Content too short`);
      }
    });

    return {
      passed: formatIssues.length === 0,
      score: formatIssues.length === 0 ? 1 : 0.5,
      details: formatIssues.length > 0 ? formatIssues.join(', ') : 'Format compliance met'
    };
  }

  async checkRequirementCoverage(sections, requirements) {
    try {
      const allContent = sections.map(s => s.content).join(' ');
      const reqList = requirements.requirements || [];
      
      if (reqList.length === 0) {
        return {
          passed: true,
          score: 1,
          details: 'No specific requirements to check'
        };
      }

      // Use AI to check requirement coverage
      const prompt = `Check if this proposal content addresses these requirements: ${JSON.stringify(reqList)}. Content: ${allContent.substring(0, 4000)}. Return coverage percentage as decimal.`;
      
      const response = await this.aiService.generateChatCompletion([
        { role: 'system', content: 'Analyze proposal content for requirement coverage. Return only a decimal between 0 and 1.' },
        { role: 'user', content: prompt }
      ]);

      const coverage = parseFloat(response.trim()) || 0.5;
      
      return {
        passed: coverage >= 0.8,
        score: coverage,
        details: `${Math.round(coverage * 100)}% of requirements addressed`
      };
    } catch (error) {
      logger.error('Error checking requirement coverage:', error);
      return {
        passed: false,
        score: 0.5,
        details: 'Error checking requirement coverage'
      };
    }
  }

  generateComplianceIssues(complianceChecks) {
    const issues = [];
    
    Object.entries(complianceChecks).forEach(([checkName, check]) => {
      if (!check.passed) {
        issues.push({
          type: 'warning',
          category: checkName,
          message: check.details,
          severity: check.score < 0.5 ? 'high' : 'medium'
        });
      }
    });

    return issues;
  }

  formatContentForHTML(content) {
    if (!content) return '<p>No content available</p>';
    
    // Simple HTML formatting - convert line breaks to paragraphs
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => `<p>${this.escapeHtml(line.trim())}</p>`)
      .join('');
  }

  escapeHtml(text) {
    const div = { innerHTML: '' };
    div.textContent = text;
    return div.innerHTML || text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

 
  async updateProposalSection(proposalId, sectionId, content) {
    try {
      // Get current proposal
      const proposalQuery = 'SELECT * FROM proposal_drafts WHERE id = $1';
      const proposalResult = await this.pool.query(proposalQuery, [proposalId]);
      
      if (proposalResult.rows.length === 0) {
        throw new Error('Proposal not found');
      }

      const proposal = proposalResult.rows[0];
      const sections = JSON.parse(proposal.sections);

      // Update section
      const sectionIndex = sections.findIndex(s => s.id === sectionId);
      if (sectionIndex === -1) {
        throw new Error('Section not found');
      }

      sections[sectionIndex] = {
        ...sections[sectionIndex],
        content,
        wordCount: content.split(' ').length,
        status: 'reviewed',
        lastModified: new Date().toISOString()
      };

      // Recalculate compliance
      const rfpQuery = 'SELECT requirements FROM rfp_documents WHERE id = $1';
      const rfpResult = await this.pool.query(rfpQuery, [proposal.rfp_document_id]);
      const requirements = JSON.parse(rfpResult.rows[0].requirements);
      
      const complianceStatus = await this.checkCompliance(sections, requirements);

      // Update proposal
      const updateQuery = `
        UPDATE proposal_drafts SET
          sections = $2,
          compliance_status = $3,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.pool.query(updateQuery, [
        proposalId,
        JSON.stringify(sections),
        JSON.stringify(complianceStatus)
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating proposal section:', error);
      throw error;
    }
  }

  async exportProposal(proposalId, format = 'pdf') {
    try {
      // Get proposal
      const proposalQuery = 'SELECT * FROM proposal_drafts WHERE id = $1';
      const proposalResult = await this.pool.query(proposalQuery, [proposalId]);
      
      if (proposalResult.rows.length === 0) {
        throw new Error('Proposal not found');
      }

      const proposal = proposalResult.rows[0];
      const sections = JSON.parse(proposal.sections);

      if (format === 'pdf') {
        return await this.generatePDF(proposal, sections);
      } else if (format === 'docx') {
        return await this.generateDOCX(proposal, sections);
      } else {
        throw new Error('Unsupported format');
      }
    } catch (error) {
      logger.error('Error exporting proposal:', error);
      throw error;
    }
  }

  async generatePDF(proposal, sections) {
    const puppeteer = require('puppeteer');
    
    // Build simple HTML content
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${proposal.title}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            line-height: 1.6; 
            color: #333;
          }
          h1 { 
            color: #2c3e50; 
            text-align: center; 
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
          }
          h2 { 
            color: #34495e; 
            margin-top: 30px; 
            border-left: 4px solid #3498db;
            padding-left: 15px;
          }
          p { margin-bottom: 15px; }
          .meta { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .section { margin: 30px 0; }
          .signature-area { 
            margin-top: 50px; 
            border-top: 1px solid #ddd; 
            padding-top: 30px;
          }
          .signature-line { 
            border-bottom: 1px solid #000; 
            width: 300px; 
            margin: 20px 0; 
          }
        </style>
      </head>
      <body>
        <h1>${proposal.title}</h1>
        
        <div class="meta">
          <strong>Generated:</strong> ${new Date().toLocaleDateString()}<br>
          <strong>Sections:</strong> ${sections.length}<br>
          <strong>Total Words:</strong> ${sections.reduce((sum, s) => sum + (s.wordCount || 0), 0)}
        </div>
    `;

    // Add each section
    sections.forEach((section, index) => {
      htmlContent += `
        <div class="section">
          <h2>${index + 1}. ${section.title}</h2>
          <div>${this.formatContentForHTML(section.content)}</div>
        </div>
      `;
    });

    htmlContent += `
        <div class="signature-area">
          <p><strong>Signature:</strong></p>
          <div class="signature-line"></div>
          <p><strong>Date:</strong> _______________</p>
        </div>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      
      return pdfBuffer;
      
    } finally {
      await browser.close();
    }
  }

  async generateDOCX(proposal, sections) {
    const officegen = require('officegen');
    
    return new Promise((resolve, reject) => {
      const docx = officegen('docx');
      
      // Set document properties
      docx.setDocTitle(proposal.title);
      docx.setDocSubject('Generated Proposal Document');
      docx.setDocKeywords('proposal, document, generated');
      
      // Add title
      const titlePara = docx.createP();
      titlePara.addText(proposal.title, { bold: true, font_size: 18 });
      titlePara.options.align = 'center';
      
      // Add spacing
      docx.createP();
      
      // Add metadata
      const metaPara = docx.createP();
      metaPara.addText('Generated: ', { bold: true });
      metaPara.addText(new Date().toLocaleDateString());
      
      const sectionsPara = docx.createP();
      sectionsPara.addText('Sections: ', { bold: true });
      sectionsPara.addText(sections.length.toString());
      
      const wordsPara = docx.createP();
      wordsPara.addText('Total Words: ', { bold: true });
      wordsPara.addText(sections.reduce((sum, s) => sum + (s.wordCount || 0), 0).toString());
      
      // Add spacing
      docx.createP();
      docx.createP();
      
      // Add each section
      sections.forEach((section, index) => {
        // Section heading
        const headingPara = docx.createP();
        headingPara.addText(`${index + 1}. ${section.title}`, { bold: true, font_size: 14 });
        
        // Add spacing
        docx.createP();
        
        // Section content - split into paragraphs
        const content = section.content || 'No content available';
        const paragraphs = content.split('\n').filter(p => p.trim().length > 0);
        
        paragraphs.forEach(paragraph => {
          const para = docx.createP();
          para.addText(paragraph.trim());
        });
        
        // Add spacing between sections
        docx.createP();
        docx.createP();
      });
      
      // Add signature section
      docx.createP();
      const sigHeading = docx.createP();
      sigHeading.addText('Signature', { bold: true });
      
      const sigLine = docx.createP();
      sigLine.addText('_'.repeat(50));
      
      docx.createP();
      const datePara = docx.createP();
      datePara.addText('Date: _________________');
      
      // Generate document buffer
      const chunks = [];
      const stream = docx.generate();
      
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      
      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  async getProposalsByUser(userId) {
    try {
      const query = `
        SELECT 
          pd.*,
          rd.original_filename as rfp_filename,
          c.title as contract_title
        FROM proposal_drafts pd
        JOIN rfp_documents rd ON pd.rfp_document_id = rd.id
        LEFT JOIN contracts c ON rd.contract_id = c.id
        WHERE pd.user_id = $1
        ORDER BY pd.created_at DESC
      `;

      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting proposals by user:', error);
      throw error;
    }
  }
}

module.exports = ProposalDraftingService;
