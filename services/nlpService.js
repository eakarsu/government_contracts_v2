const axios = require('axios');
const config = require('../config/env');

class NLPService {
  constructor() {
    this.apiKey = config.openRouterApiKey;
    this.baseURL = 'https://openrouter.ai/api/v1';
  }

  async extractEntities(text) {
    try {
      // Handle empty or very short text
      if (!text || text.trim().length < 2) {
        return {
          amounts: [],
          locations: [],
          dates: [],
          naics_codes: [],
          set_aside_codes: [],
          contract_types: [],
          keywords: [text || 'projects']
        };
      }

      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: "anthropic/claude-3-haiku-20240307",
        messages: [{
          role: "user",
          content: `Extract entities from this search query: "${text}"
          
Return JSON with these fields:
- amounts: array of objects with {value, currency, operator}
- locations: array of strings (states, cities, regions)
- dates: array of objects with {type, value, relative}
- naics_codes: array of strings or descriptions
- set_aside_codes: array of strings
- contract_types: array of strings
- keywords: array of important keywords

Query: "${text}"`
        }],
        max_tokens: 300,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl || 'http://localhost:3010'
        }
      });

      return this.parseEntityResponse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Entity extraction error:', error.message);
      return this.fallbackEntityExtraction(text);
    }
  }

  async classifyIntent(query) {
    try {
      // Handle empty or very short text
      if (!query || query.trim().length < 2) {
        return { intent: 'DISCOVERY', confidence: 0.5, sub_intent: 'general' };
      }

      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: "anthropic/claude-3-haiku-20240307",
        messages: [{
          role: "user",
          content: `Classify the intent of this contract search query: "${query}"

Possible intents:
- DISCOVERY: looking for new opportunities
- COMPARISON: comparing contracts or vendors
- ALERT: setting up notifications
- ANALYTICS: seeking trends or statistics
- DETAILS: wanting specific contract information

Return JSON: {"intent": "DISCOVERY", "confidence": 0.85, "sub_intent": "new_opportunities"}`
        }],
        max_tokens: 150,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl || 'http://localhost:3010'
        }
      });

      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Intent classification error:', error.message);
      return { intent: 'DISCOVERY', confidence: 0.5, sub_intent: 'general' };
    }
  }

  async expandTerms(terms) {
    try {
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: "anthropic/claude-3-haiku-20240307",
        messages: [{
          role: "user",
          content: `Expand these contract search terms with synonyms and related concepts:
          ${JSON.stringify(terms)}

Return JSON with original terms and expanded terms including:
- Synonyms
- Related NAICS codes
- Technical terms
- Common abbreviations
- Related government terms

Format: {"original": ["expanded", "terms"]}`
        }],
        max_tokens: 400,
        temperature: 0.2
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl || 'http://localhost:3010'
        }
      });

      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Term expansion error:', error);
      return this.basicTermExpansion(terms);
    }
  }

  parseEntityResponse(content) {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('JSON parsing error:', error);
    }
    return this.fallbackEntityExtraction(content);
  }

  fallbackEntityExtraction(text) {
    // Handle empty text
    if (!text || text.trim().length === 0) {
      return {
        amounts: [],
        locations: [],
        dates: [],
        naics_codes: [],
        set_aside_codes: [],
        contract_types: [],
        keywords: []
      };
    }
    
    // Regex-based fallback for common patterns
    const patterns = {
      amounts: /\$(\d+(?:,\d{3})*(?:\.\d{2})?)|(\d+(?:,\d{3})*)\s*(?:dollars?|USD)/gi,
      locations: /\b(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming)\b/gi,
      dates: /\b(?:next\s+week|next\s+month|this\s+month|within\s+\d+\s+days?)\b/gi,
      naics: /\b(?:54\d{3}|56\d{3}|62\d{3}|81\d{3})\b/g,
      set_aside: /\b(?:small\s+business|8\(\d\)|hubzone|women-owned|veteran|sdvosb)\b/gi
    };

    const entities = {
      amounts: [],
      locations: [],
      dates: [],
      naics_codes: [],
      set_aside_codes: [],
      contract_types: []
    };

    // Extract amounts
    let match;
    while ((match = patterns.amounts.exec(text)) !== null) {
      const value = parseInt(match[1] || match[2].replace(/,/g, ''));
      entities.amounts.push({
        value,
        currency: 'USD',
        operator: text.includes('under') || text.includes('below') ? 'lt' : 
                 text.includes('over') || text.includes('above') ? 'gt' : 'eq'
      });
    }

    // Extract locations
    while ((match = patterns.locations.exec(text)) !== null) {
      entities.locations.push(match[0]);
    }

    // Extract dates
    while ((match = patterns.dates.exec(text)) !== null) {
      entities.dates.push({
        type: 'relative',
        value: match[0],
        relative: this.parseRelativeDate(match[0])
      });
    }

    return entities;
  }

  basicTermExpansion(terms) {
    const expansionMap = {
      'IT': ['information technology', 'software', 'computer systems', 'cybersecurity', '541511'],
      'construction': ['building', 'infrastructure', 'engineering', '236220'],
      'consulting': ['advisory', 'professional services', 'management consulting', '541611'],
      'small business': ['small business set-aside', 'sb', 'small disadvantaged', '8(a)']
    };

    const expanded = {};
    terms.forEach(term => {
      expanded[term] = expansionMap[term.toLowerCase()] || [term];
    });

    return expanded;
  }

  parseRelativeDate(relativeStr) {
    const now = new Date();
    switch (relativeStr.toLowerCase()) {
      case 'next week':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'next month':
        return new Date(now.getFullYear(), now.getMonth() + 2, 0);
      case 'this month':
        return new Date(now.getFullYear(), now.getMonth() + 1, 0);
      default:
        return now;
    }
  }
}

module.exports = new NLPService();