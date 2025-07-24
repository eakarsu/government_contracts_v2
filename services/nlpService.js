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

      if (!this.apiKey) {
        console.warn('OpenRouter API key not configured, using fallback extraction');
        return this.fallbackEntityExtraction(text);
      }

      console.log('🔍 Sending to OpenRouter for entity extraction:', text);
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: "anthropic/claude-sonnet-4",
        messages: [
          {
            role: "system",
            content: "You are a contract search assistant. Extract entities from queries and return valid JSON only."
          },
          {
            role: "user",
            content: `Extract entities from: "${text}"

Return valid JSON with:
{
  "amounts": [],
  "locations": [],
  "dates": [],
  "naics_codes": [],
  "set_aside_codes": [],
  "contract_types": [],
  "keywords": []
}`
          }
        ],
        max_tokens: 400,
        temperature: 0.1,
        response_format: { "type": "json_object" }
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl || 'http://localhost:3010',
          'X-Title': 'Government Contracts NLP'
        },
        timeout: 15000
      });

      console.log('✅ OpenRouter entity extraction successful');
      return this.parseEntityResponse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('❌ Entity extraction error:', error.message);
      console.error('❌ Using fallback extraction');
      return this.fallbackEntityExtraction(text);
    }
  }

  async classifyIntent(query) {
    try {
      // Handle empty or very short text
      if (!query || query.trim().length < 2) {
        return { intent: 'DISCOVERY', confidence: 0.5, sub_intent: 'general' };
      }

      if (!this.apiKey) {
        console.warn('OpenRouter API key not configured, using fallback classification');
        return { intent: 'DISCOVERY', confidence: 0.5, sub_intent: 'general' };
      }

      console.log('🔍 Sending to OpenRouter for intent classification:', query);
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: "anthropic/claude-sonnet-4",
        messages: [
          {
            role: "system",
            content: "You are a contract search assistant. Classify user intent and return valid JSON only."
          },
          {
            role: "user",
            content: `Classify intent for: "${query}"

Return valid JSON:
{
  "intent": "DISCOVERY|COMPARISON|ALERT|ANALYTICS|DETAILS",
  "confidence": 0.8,
  "sub_intent": "specific_type"
}`
          }
        ],
        max_tokens: 200,
        temperature: 0.1,
        response_format: { "type": "json_object" }
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.apiBaseUrl || 'http://localhost:3010',
          'X-Title': 'Government Contracts NLP'
        },
        timeout: 15000
      });

      console.log('✅ OpenRouter intent classification successful');
      const content = response.data.choices[0].message.content;
      // Clean up markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error('❌ JSON parsing failed for intent classification:', parseError.message);
          console.error('❌ Invalid JSON:', jsonMatch[0]);
        }
      }
      return { intent: 'DISCOVERY', confidence: 0.5, sub_intent: 'general' };
    } catch (error) {
      console.error('❌ Intent classification error:', error.message);
      console.error('❌ Using fallback classification');
      return { intent: 'DISCOVERY', confidence: 0.5, sub_intent: 'general' };
    }
  }

  async expandTerms(terms) {
    try {
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: "anthropic/claude-sonnet-4",
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
      console.log('📄 Parsing OpenRouter response:', content);
      
      // Clean up markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Extract JSON from response
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ Successfully parsed entities:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('❌ JSON parsing error:', error);
      console.error('❌ Response content:', content);
    }
    
    console.log('⚠️ Using fallback entity extraction');
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
      amounts: /\$(\d+(?:,\d{3})*(?:\.\d{2})?)(?:[KkMm])?|(\d+(?:,\d{3})*)(?:[KkMm])?\s*(?:dollars?|USD)/gi,
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
      let value = parseInt(match[1] || match[2].replace(/,/g, ''));
      
      // Handle K (thousands) and M (millions)
      const amountText = match[0] || '';
      if (amountText.toLowerCase().includes('k')) {
        value = value * 1000;
      } else if (amountText.toLowerCase().includes('m')) {
        value = value * 1000000;
      }
      
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