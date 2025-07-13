const fetch = require('node-fetch');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.embeddingModel = 'openai/text-embedding-ada-002';
    this.chatModel = 'openai/gpt-4-turbo-preview';
  }

  async generateEmbedding(text) {
    try {
      if (!this.openRouterApiKey) {
        logger.warn('OpenRouter API key not found, using dummy embedding');
        const embedding = new Array(1536).fill(0).map(() => Math.random());
        return embedding;
      }

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Government Contracts Platform'
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text.substring(0, 8000) // Limit text length
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      // Fallback to dummy embedding
      const embedding = new Array(1536).fill(0).map(() => Math.random());
      return embedding;
    }
  }

  async generateChatCompletion(messages, options = {}) {
    try {
      if (!this.openRouterApiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Government Contracts Platform'
        },
        body: JSON.stringify({
          model: options.model || this.chatModel,
          messages,
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.7,
          ...options
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      logger.error('Error generating chat completion:', error);
      throw error;
    }
  }

  async summarizeDocument(text) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert at analyzing government contracts and RFPs. Provide clear, concise summaries focusing on key requirements, deadlines, and deliverables.'
      },
      {
        role: 'user',
        content: `Please summarize this government contract document, highlighting key points, requirements, deadlines, and deliverables:\n\n${text.substring(0, 6000)}`
      }
    ];

    return await this.generateChatCompletion(messages);
  }

  async extractKeyPoints(text) {
    const messages = [
      {
        role: 'system',
        content: 'Extract key information from government contracts including scope, timeline, budget, requirements, and critical clauses. Return as structured JSON.'
      },
      {
        role: 'user',
        content: `Extract key points from this contract document and return as JSON with fields: scope, timeline, budget, requirements, criticalClauses:\n\n${text.substring(0, 6000)}`
      }
    ];

    try {
      const response = await this.generateChatCompletion(messages);
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error parsing key points JSON:', error);
      return {
        scope: 'Unable to extract',
        timeline: 'Unable to extract',
        budget: 'Unable to extract',
        requirements: [],
        criticalClauses: []
      };
    }
  }

  async generateProposalSection(requirements, sectionType, companyProfile) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert proposal writer for government contracts. Generate professional, compliant proposal sections that address all requirements.'
      },
      {
        role: 'user',
        content: `Generate a ${sectionType} section for a government proposal based on these requirements: ${requirements}\n\nCompany profile: ${JSON.stringify(companyProfile)}\n\nEnsure the response addresses all requirements and showcases relevant capabilities.`
      }
    ];

    return await this.generateChatCompletion(messages);
  }

  async calculateBidProbability(contractData, companyProfile, historicalData) {
    const messages = [
      {
        role: 'system',
        content: 'You are an expert at analyzing bid success probability for government contracts. Provide realistic assessments based on company capabilities, contract requirements, and market factors.'
      },
      {
        role: 'user',
        content: `Analyze the probability of winning this government contract and return as JSON with fields: probability (0-1), confidence, factors, suggestions:\n\nContract: ${JSON.stringify(contractData)}\nCompany: ${JSON.stringify(companyProfile)}\nHistorical data: ${JSON.stringify(historicalData)}`
      }
    ];

    try {
      const response = await this.generateChatCompletion(messages);
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error parsing bid probability JSON:', error);
      return {
        probability: 0.5,
        confidence: 'low',
        factors: ['Unable to analyze'],
        suggestions: ['Provide more detailed company information']
      };
    }
  }

  async generateComplianceChecklist(agency, contractType) {
    const messages = [
      {
        role: 'system',
        content: 'Generate comprehensive compliance checklists for government contracts based on agency requirements and contract types.'
      },
      {
        role: 'user',
        content: `Generate a compliance checklist for a ${contractType} contract with ${agency}. Return as JSON array of checklist items with fields: item, description, required, category.`
      }
    ];

    try {
      const response = await this.generateChatCompletion(messages);
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error parsing compliance checklist JSON:', error);
      return [
        {
          item: 'Basic Requirements Review',
          description: 'Review all basic contract requirements',
          required: true,
          category: 'general'
        }
      ];
    }
  }

  async extractDocumentRequirements(documentText) {
    const messages = [
      {
        role: 'system',
        content: 'Extract structured requirements from government contract documents. Focus on deliverables, deadlines, technical specifications, and evaluation criteria.'
      },
      {
        role: 'user',
        content: `Extract requirements from this document and return as JSON with fields: requirements, deadlines, sections, evaluation_criteria:\n\n${documentText.substring(0, 6000)}`
      }
    ];

    try {
      const response = await this.generateChatCompletion(messages);
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error extracting document requirements:', error);
      return {
        requirements: [],
        deadlines: [],
        sections: [],
        evaluation_criteria: {}
      };
    }
  }

  async analyzeBusinessProfile(profile, contracts) {
    const messages = [
      {
        role: 'system',
        content: 'Analyze business profiles against government contract opportunities to identify strengths, weaknesses, and recommendations.'
      },
      {
        role: 'user',
        content: `Analyze this business profile against available contracts and provide recommendations:\n\nProfile: ${JSON.stringify(profile)}\n\nContracts: ${JSON.stringify(contracts.slice(0, 5))}`
      }
    ];

    try {
      const response = await this.generateChatCompletion(messages);
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error analyzing business profile:', error);
      return {
        strengths: [],
        weaknesses: [],
        recommendations: [],
        opportunities: []
      };
    }
  }

  // Legacy method for backward compatibility
  async generateCompletion(prompt, model = 'gpt-3.5-turbo', maxTokens = 1000) {
    const messages = [
      { role: 'user', content: prompt }
    ];
    return await this.generateChatCompletion(messages, { model, maxTokens });
  }

  // Legacy method for backward compatibility
  async semanticSearch(queryText, limit = 10, threshold = 0.7) {
    logger.warn('semanticSearch called on AIService - use SemanticSearchService instead');
    return [];
  }
}

module.exports = new AIService();
