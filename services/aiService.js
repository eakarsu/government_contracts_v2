const config = require('../config/env');

class AIService {
  constructor() {
    this.apiKey = config.openRouterApiKey;
    this.baseUrl = config.openRouterBaseUrl.replace(/\/$/, '');
    this.chatModel = config.openRouterModel;
  }

  async analyzeDocument(text, documentType = 'rfp') {
    try {
      if (!this.apiKey) {
        console.warn('OpenRouter API key not configured, using fallback analysis');
        return this.getFallbackAnalysis(documentType);
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl,
          'X-Title': 'Government Contracts Platform'
        },
        body: JSON.stringify({
          model: this.chatModel,
          messages: [
            {
              role: 'system',
              content: `You are an expert ${documentType.toUpperCase()} analyzer. Extract key requirements, sections, deadlines, and evaluation criteria from documents. Return structured JSON data.`
            },
            {
              role: 'user',
              content: `Analyze this ${documentType} document and extract:
1. Required sections and their word limits
2. Evaluation criteria and weights
3. Key deadlines
4. Technical requirements
5. Compliance requirements

Document text: ${text.substring(0, 8000)}...

Return a JSON object with sections, requirements, deadlines, and evaluation_criteria.`
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`AI analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      const analysisText = data.choices[0].message.content;
      
      return this.parseAnalysisResponse(analysisText);
    } catch (error) {
      console.error('AI document analysis error:', error);
      return this.getFallbackAnalysis(documentType);
    }
  }

  async generateProposalSection(sectionTitle, requirements, companyProfile, rfpContext) {
    try {
      if (!this.apiKey) {
        console.warn('OpenRouter API key not configured, using fallback content');
        return this.getFallbackSectionContent(sectionTitle);
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl,
          'X-Title': 'Government Contracts Platform'
        },
        body: JSON.stringify({
          model: this.chatModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert proposal writer. Generate compelling, compliant proposal sections that address RFP requirements while highlighting company strengths.'
            },
            {
              role: 'user',
              content: `Generate a ${sectionTitle} section for an RFP proposal.

Requirements: ${JSON.stringify(requirements)}
Company Profile: ${JSON.stringify(companyProfile)}
RFP Context: ${JSON.stringify(rfpContext)}

Write a professional, detailed section that:
1. Addresses all requirements
2. Highlights company strengths
3. Uses specific examples
4. Maintains professional tone
5. Stays within word limits

Return only the section content, no additional formatting.`
            }
          ],
          max_tokens: 1500,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`AI generation failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI section generation error:', error);
      return this.getFallbackSectionContent(sectionTitle);
    }
  }

  async analyzeBidProbability(contractData, companyProfile, historicalData) {
    try {
      if (!this.apiKey) {
        console.warn('OpenRouter API key not configured, using fallback analysis');
        return this.getFallbackBidAnalysis();
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl,
          'X-Title': 'Government Contracts Platform'
        },
        body: JSON.stringify({
          model: this.chatModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert bid analysis AI. Analyze contract opportunities and company capabilities to predict bid success probability. Consider past performance, technical fit, competition, and market factors.'
            },
            {
              role: 'user',
              content: `Analyze this bid opportunity:

Contract: ${JSON.stringify(contractData)}
Company Profile: ${JSON.stringify(companyProfile)}
Historical Performance: ${JSON.stringify(historicalData)}

Provide analysis with:
1. Win probability (0-100)
2. Confidence level (0-100)
3. Key factors affecting success (with scores and impact)
4. Actionable recommendations
5. Competitive analysis

Return structured data that can be parsed into factors, recommendations, and competitive analysis.`
            }
          ],
          max_tokens: 1500,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`AI bid analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      const analysisText = data.choices[0].message.content;
      
      return this.parseBidAnalysis(analysisText);
    } catch (error) {
      console.error('AI bid analysis error:', error);
      return this.getFallbackBidAnalysis();
    }
  }

  parseAnalysisResponse(analysisText) {
    // Try to extract JSON from the response
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse AI response as JSON, using fallback');
    }

    throw new Error('AI analysis response did not contain valid structured JSON');
  }

  parseBidAnalysis(analysisText) {
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Bid analysis response must contain structured JSON');
    const parsed = JSON.parse(jsonMatch[0]);
    if (
      !Number.isFinite(parsed.probability) ||
      !Number.isFinite(parsed.confidence) ||
      !Array.isArray(parsed.factors) ||
      !Array.isArray(parsed.recommendations)
    ) {
      throw new Error('Bid analysis JSON is missing required fields');
    }
    return parsed;
  }

  getFallbackAnalysis(documentType) {
    throw new Error(`AI analysis unavailable for ${documentType}; fabricated fallback output is disabled`);
  }

  getFallbackSectionContent(sectionTitle) {
    throw new Error(`AI content unavailable for ${sectionTitle}; fabricated fallback output is disabled`);
  }

  async generateEmbedding(text) {
    try {
      // Try OpenAI embeddings first if API key is available
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        console.log('Using OpenAI embeddings service');
        return await this.generateOpenAIEmbedding(text, openaiKey);
      }

      // Try Hugging Face embeddings as fallback
      const hfKey = process.env.HUGGINGFACE_API_KEY;
      if (hfKey) {
        console.log('Using Hugging Face embeddings service');
        return await this.generateHuggingFaceEmbedding(text, hfKey);
      }

      // Use local transformer model if available
      if (this.vectorService && this.vectorService.embedder) {
        console.log('Using local transformer embeddings');
        return await this.vectorService.generateEmbedding(text);
      }

      throw new Error('No embedding service is configured');
    } catch (error) {
      console.error('AI embedding generation error:', error);
      throw error;
    }
  }

  async generateOpenAIEmbedding(text, apiKey) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000) // Limit text length
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async generateHuggingFaceEmbedding(text, apiKey) {
    const response = await fetch('https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: text.substring(0, 8000)
      })
    });

    if (!response.ok) {
      throw new Error(`Hugging Face embedding failed: ${response.statusText}`);
    }

    const embedding = await response.json();
    return Array.isArray(embedding[0]) ? embedding[0] : embedding;
  }

  async summarizeDocument(text) {
    try {
      if (!this.apiKey) {
        console.warn('OpenRouter API key not configured, using fallback summary');
        return this.getFallbackSummary(text);
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl,
          'X-Title': 'Government Contracts Platform'
        },
        body: JSON.stringify({
          model: this.chatModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at summarizing government contract documents. Provide concise, informative summaries.'
            },
            {
              role: 'user',
              content: `Summarize this document in 2-3 sentences, focusing on key requirements and opportunities:\n\n${text.substring(0, 4000)}`
            }
          ],
          max_tokens: 200,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`Document summarization failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI document summarization error:', error);
      return this.getFallbackSummary(text);
    }
  }

  async generateChatCompletion(messages, options = {}) {
    try {
      if (!this.apiKey) {
        console.warn('OpenRouter API key not configured, using fallback response');
        return 'AI analysis not available - API key not configured';
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl,
          'X-Title': 'Government Contracts Platform'
        },
        body: JSON.stringify({
          model: this.chatModel,
          messages,
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`Chat completion failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI chat completion error:', error);
      throw error;
    }
  }

  getFallbackEmbedding(text) {
    throw new Error(`Embedding unavailable for ${text.length} characters; fabricated vectors are disabled`);
  }

  getFallbackSummary(text) {
    throw new Error(`Summary unavailable for ${text.length} characters; fabricated summaries are disabled`);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  getFallbackBidAnalysis() {
    throw new Error('Bid analysis unavailable; fabricated probabilities are disabled');
  }
}

module.exports = new AIService();
