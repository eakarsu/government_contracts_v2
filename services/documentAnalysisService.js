const { Pool } = require('pg');
const AIService = require('./aiService');
const logger = require('../utils/logger');
const fs = require('fs-extra');
const path = require('path');

class DocumentAnalysisService {
  constructor() {
    this.aiService = AIService;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async analyzeDocument(contractId, filePath, documentType) {
    try {
      // Read document content
      const content = await this.extractTextFromDocument(filePath);
      
      // Generate summary
      const summary = await this.aiService.summarizeDocument(content);
      
      // Extract key points
      const keyPoints = await this.aiService.extractKeyPoints(content);
      
      // Identify critical clauses
      const criticalClauses = await this.extractCriticalClauses(content);
      
      // Calculate confidence score
      const confidence = this.calculateAnalysisConfidence(content, keyPoints);
      
      // Store analysis results
      const query = `
        INSERT INTO document_analyses (
          contract_id, document_type, file_path, summary,
          key_points, extracted_data, critical_clauses, analysis_confidence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        contractId,
        documentType,
        filePath,
        summary,
        JSON.stringify(keyPoints),
        JSON.stringify({
          wordCount: content.split(' ').length,
          pageCount: this.estimatePageCount(content),
          language: 'en',
          processedAt: new Date().toISOString()
        }),
        JSON.stringify(criticalClauses),
        confidence
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error analyzing document:', error);
      throw error;
    }
  }

  async extractTextFromDocument(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.txt') {
        return await fs.readFile(filePath, 'utf8');
      } else if (ext === '.pdf') {
        // In production, use a PDF parsing library like pdf-parse
        return 'PDF content extraction would be implemented here';
      } else if (ext === '.docx') {
        // In production, use a DOCX parsing library like mammoth
        return 'DOCX content extraction would be implemented here';
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }
    } catch (error) {
      logger.error('Error extracting text from document:', error);
      throw error;
    }
  }

  async extractCriticalClauses(content) {
    try {
      const prompt = `Identify critical clauses in this government contract document. Look for terms related to payment, penalties, termination, intellectual property, and compliance. Return as JSON array with fields: type, clause, importance, location:\n\n${content.substring(0, 6000)}`;
      
      const response = await this.aiService.generateChatCompletion([
        { role: 'system', content: 'Extract critical clauses from government contracts. Focus on legal and financial terms.' },
        { role: 'user', content: prompt }
      ]);

      return JSON.parse(response);
    } catch (error) {
      logger.error('Error extracting critical clauses:', error);
      return [];
    }
  }

  calculateAnalysisConfidence(content, keyPoints) {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence based on content length
    if (content.length > 1000) confidence += 0.1;
    if (content.length > 5000) confidence += 0.1;
    
    // Boost confidence based on extracted data quality
    if (keyPoints.scope && keyPoints.scope !== 'Unable to extract') confidence += 0.1;
    if (keyPoints.timeline && keyPoints.timeline !== 'Unable to extract') confidence += 0.1;
    if (keyPoints.budget && keyPoints.budget !== 'Unable to extract') confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  estimatePageCount(content) {
    // Rough estimation: 250 words per page
    return Math.ceil(content.split(' ').length / 250);
  }

  async searchDocuments(query, contractId = null, limit = 20) {
    try {
      let searchQuery = `
        SELECT 
          da.*,
          c.title as contract_title,
          c.agency
        FROM document_analyses da
        JOIN contracts c ON da.contract_id = c.id
        WHERE (
          da.summary ILIKE $1 OR
          da.key_points::text ILIKE $1 OR
          da.critical_clauses::text ILIKE $1
        )
      `;

      const queryParams = [`%${query}%`];
      let paramIndex = 2;

      if (contractId) {
        searchQuery += ` AND da.contract_id = $${paramIndex}`;
        queryParams.push(contractId);
        paramIndex++;
      }

      searchQuery += ` ORDER BY da.analysis_confidence DESC, da.created_at DESC LIMIT $${paramIndex}`;
      queryParams.push(limit);

      const result = await this.pool.query(searchQuery, queryParams);
      return result.rows;
    } catch (error) {
      logger.error('Error searching documents:', error);
      throw error;
    }
  }

  async getDocumentAnalysis(analysisId) {
    try {
      const query = `
        SELECT 
          da.*,
          c.title as contract_title,
          c.agency,
          c.notice_id
        FROM document_analyses da
        JOIN contracts c ON da.contract_id = c.id
        WHERE da.id = $1
      `;

      const result = await this.pool.query(query, [analysisId]);
      
      if (result.rows.length === 0) {
        throw new Error('Document analysis not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting document analysis:', error);
      throw error;
    }
  }

  async compareDocuments(analysisId1, analysisId2) {
    try {
      // Get both analyses
      const analysis1 = await this.getDocumentAnalysis(analysisId1);
      const analysis2 = await this.getDocumentAnalysis(analysisId2);

      // Use AI to compare documents
      const prompt = `Compare these two government contract documents and highlight key differences:

Document 1: ${analysis1.summary}
Key Points 1: ${JSON.stringify(analysis1.key_points)}

Document 2: ${analysis2.summary}
Key Points 2: ${JSON.stringify(analysis2.key_points)}

Return comparison as JSON with fields: similarities, differences, recommendations.`;

      const response = await this.aiService.generateChatCompletion([
        { role: 'system', content: 'Compare government contract documents and provide structured analysis.' },
        { role: 'user', content: prompt }
      ]);

      const comparison = JSON.parse(response);

      return {
        document1: {
          id: analysis1.id,
          title: analysis1.contract_title,
          agency: analysis1.agency
        },
        document2: {
          id: analysis2.id,
          title: analysis2.contract_title,
          agency: analysis2.agency
        },
        comparison
      };
    } catch (error) {
      logger.error('Error comparing documents:', error);
      throw error;
    }
  }

  async getDocumentInsights(contractId) {
    try {
      // Get all document analyses for the contract
      const query = `
        SELECT * FROM document_analyses 
        WHERE contract_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [contractId]);
      const analyses = result.rows;

      if (analyses.length === 0) {
        return {
          totalDocuments: 0,
          averageConfidence: 0,
          insights: []
        };
      }

      // Calculate insights
      const totalDocuments = analyses.length;
      const averageConfidence = analyses.reduce((sum, a) => sum + a.analysis_confidence, 0) / totalDocuments;
      
      // Extract common themes
      const allKeyPoints = analyses.map(a => JSON.parse(a.key_points));
      const allCriticalClauses = analyses.flatMap(a => JSON.parse(a.critical_clauses));

      // Generate insights using AI
      const prompt = `Analyze these document analysis results and provide insights about the contract:

Key Points: ${JSON.stringify(allKeyPoints)}
Critical Clauses: ${JSON.stringify(allCriticalClauses)}

Return insights as JSON with fields: themes, risks, opportunities, recommendations.`;

      const response = await this.aiService.generateChatCompletion([
        { role: 'system', content: 'Analyze contract document data and provide business insights.' },
        { role: 'user', content: prompt }
      ]);

      const insights = JSON.parse(response);

      return {
        totalDocuments,
        averageConfidence,
        insights,
        documentTypes: [...new Set(analyses.map(a => a.document_type))],
        lastAnalyzed: analyses[0].created_at
      };
    } catch (error) {
      logger.error('Error getting document insights:', error);
      throw error;
    }
  }

  async generateDocumentReport(contractId) {
    try {
      const insights = await this.getDocumentInsights(contractId);
      
      // Get contract details
      const contractQuery = 'SELECT * FROM contracts WHERE id = $1';
      const contractResult = await this.pool.query(contractQuery, [contractId]);
      const contract = contractResult.rows[0];

      const report = {
        contract: {
          title: contract.title,
          agency: contract.agency,
          noticeId: contract.notice_id,
          postedDate: contract.posted_date
        },
        analysis: insights,
        generatedAt: new Date().toISOString(),
        summary: `Analysis of ${insights.totalDocuments} documents with ${Math.round(insights.averageConfidence * 100)}% average confidence.`
      };

      return report;
    } catch (error) {
      logger.error('Error generating document report:', error);
      throw error;
    }
  }
}

module.exports = DocumentAnalysisService;
