const nlpService = require('./nlpService');
const { PrismaClient } = require('@prisma/client');

class SemanticEnhancer {
  constructor() {
    this.prisma = new PrismaClient();
    
    // Technical term mappings
    this.termMappings = {
      'IT': {
        synonyms: ['information technology', 'tech', 'computer', 'software', 'cyber', 'digital'],
        naics: ['541511', '541512', '541519', '518210'],
        related: ['cloud computing', 'cybersecurity', 'data analytics', 'AI', 'machine learning']
      },
      'construction': {
        synonyms: ['building', 'infrastructure', 'civil', 'engineering', 'contractor'],
        naics: ['236220', '236118', '237310', '238990'],
        related: ['general contractor', 'subcontractor', 'design-build', 'renovation']
      },
      'consulting': {
        synonyms: ['advisory', 'professional services', 'management consulting', 'strategy'],
        naics: ['541611', '541690', '541990'],
        related: ['business consulting', 'IT consulting', 'financial advisory']
      },
      'cybersecurity': {
        synonyms: ['cyber security', 'infosec', 'network security', 'data protection'],
        naics: ['541519', '541512'],
        related: ['penetration testing', 'risk assessment', 'compliance', 'incident response']
      },
      'software': {
        synonyms: ['application', 'program', 'system', 'platform', 'solution'],
        naics: ['541511', '511210'],
        related: ['custom software', 'SaaS', 'enterprise software', 'mobile apps']
      }
    };

    // Government-specific terms
    this.govTerms = {
      'rfp': ['request for proposal', 'solicitation', 'bid', 'tender'],
      'set-aside': ['small business preference', '8(a)', 'hubzone', 'women-owned', 'veteran-owned'],
      'naics': ['north american industry classification system', 'industry code'],
      'sam': ['system for award management', 'registration'],
      'past performance': ['experience', 'track record', 'references']
    };
  }

  async expandQueryTerms(terms) {
    const expanded = new Set();
    
    // Add original terms
    terms.forEach(term => expanded.add(term.toLowerCase()));
    
    // Add synonyms and related terms
    for (const [mainTerm, mapping] of Object.entries(this.termMappings)) {
      if (terms.some(term => term.toLowerCase().includes(mainTerm))) {
        mapping.synonyms.forEach(syn => expanded.add(syn));
        mapping.related.forEach(rel => expanded.add(rel));
      }
    }
    
    return Array.from(expanded);
  }

  async classifyIntentWithContext(query, userContext = {}) {
    const baseIntent = await nlpService.classifyIntent(query);
    
    // Enhance with user context
    const enhancedIntent = {
      ...baseIntent,
      context: {
        userType: userContext.userType || 'general',
        preferences: userContext.preferences || {},
        searchHistory: userContext.searchHistory || []
      },
      subIntents: this.detectSubIntents(query, baseIntent)
    };
    
    return enhancedIntent;
  }

  detectSubIntents(query, intent) {
    const subIntents = [];
    
    if (intent.intent === 'DISCOVERY') {
      if (/new|latest|recent/i.test(query)) {
        subIntents.push('new_opportunities');
      }
      if (/small|minority|women|veteran/i.test(query)) {
        subIntents.push('set_aside_focus');
      }
      if (/(under|below|less than)\s*\$?\d+/i.test(query)) {
        subIntents.push('budget_conscious');
      }
    }
    
    if (intent.intent === 'ANALYTICS') {
      if (/trend|pattern|history/i.test(query)) {
        subIntents.push('historical_analysis');
      }
      if (/market|competition/i.test(query)) {
        subIntents.push('competitive_analysis');
      }
    }
    
    return subIntents;
  }

  async getPersonalizedSuggestions(userContext) {
    const suggestions = [];
    
    // Based on search history
    if (userContext.searchHistory && userContext.searchHistory.length > 0) {
      const recentSearches = userContext.searchHistory.slice(-5);
      const patterns = this.analyzeSearchPatterns(recentSearches);
      
      patterns.forEach(pattern => {
        suggestions.push({
          type: 'based_on_history',
          query: pattern.suggestedQuery,
          reason: pattern.reason
        });
      });
    }
    
    // Based on preferences
    if (userContext.preferences) {
      const prefSuggestions = this.buildPreferenceSuggestions(userContext.preferences);
      suggestions.push(...prefSuggestions);
    }
    
    return suggestions.slice(0, 5);
  }

  analyzeSearchPatterns(searchHistory) {
    const patterns = [];
    const naicsCounts = {};
    const locationCounts = {};
    const amountRanges = [];
    
    searchHistory.forEach(search => {
      if (search.parsedCriteria) {
        search.parsedCriteria.naicsCodes?.forEach(code => {
          naicsCounts[code] = (naicsCounts[code] || 0) + 1;
        });
        
        search.parsedCriteria.locations?.forEach(loc => {
          locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        });
        
        if (search.parsedCriteria.amountRange) {
          amountRanges.push(search.parsedCriteria.amountRange);
        }
      }
    });
    
    // Most common NAICS codes
    const topNaics = Object.entries(naicsCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2);
    
    if (topNaics.length > 0) {
      patterns.push({
        suggestedQuery: `Find ${this.getNaicsDescription(topNaics[0][0])} contracts`,
        reason: 'Based on your recent searches'
      });
    }
    
    // Most common locations
    const topLocations = Object.entries(locationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2);
    
    if (topLocations.length > 0) {
      patterns.push({
        suggestedQuery: `Contracts in ${topLocations[0][0]}`,
        reason: 'You frequently search this location'
      });
    }
    
    return patterns;
  }

  buildPreferenceSuggestions(preferences) {
    const suggestions = [];
    
    if (preferences.preferredStates && preferences.preferredStates.length > 0) {
      suggestions.push({
        type: 'location_based',
        query: `New contracts in ${preferences.preferredStates[0]}`,
        reason: 'Based on your location preferences'
      });
    }
    
    if (preferences.amountRange) {
      suggestions.push({
        type: 'budget_based',
        query: `Contracts ${preferences.amountRange.max ? 'under $' + preferences.amountRange.max.toLocaleString() : 'over $' + preferences.amountRange.min.toLocaleString()}`,
        reason: 'Matches your budget preferences'
      });
    }
    
    return suggestions;
  }

  getNaicsDescription(code) {
    const descriptions = {
      '541511': 'custom computer programming',
      '541512': 'computer systems design',
      '541519': 'other computer related services',
      '236220': 'commercial construction',
      '541611': 'administrative management',
      '541330': 'engineering services'
    };
    
    return descriptions[code] || `NAICS ${code}`;
  }

  async calculateRelevanceScore(contract, searchCriteria, userContext = {}) {
    let score = 0;
    let factors = 0;

    // Base relevance from search criteria
    if (searchCriteria.keywords?.length > 0) {
      const keywordScore = this.calculateKeywordRelevance(contract, searchCriteria.keywords);
      score += keywordScore * 0.3;
      factors++;
    }

    // Location relevance
    if (searchCriteria.locations?.length > 0) {
      const locationScore = this.calculateLocationRelevance(contract, searchCriteria.locations);
      score += locationScore * 0.2;
      factors++;
    }

    // NAICS code relevance
    if (searchCriteria.naicsCodes?.length > 0) {
      const naicsScore = this.calculateNaicsRelevance(contract, searchCriteria.naicsCodes);
      score += naicsScore * 0.25;
      factors++;
    }

    // Amount relevance
    if (searchCriteria.amountRange) {
      const amountScore = this.calculateAmountRelevance(contract, searchCriteria.amountRange);
      score += amountScore * 0.15;
      factors++;
    }

    // User preference boost
    if (userContext.preferences) {
      const preferenceScore = this.calculatePreferenceRelevance(contract, userContext.preferences);
      score += preferenceScore * 0.1;
      factors++;
    }

    // Time-based boost (newer contracts get slight boost)
    const daysSincePosted = (new Date() - new Date(contract.postedDate)) / (1000 * 60 * 60 * 24);
    const timeBoost = Math.max(0, 1 - (daysSincePosted / 90)); // Boost contracts posted within 90 days
    score += timeBoost * 0.1;

    return Math.min(score / Math.max(factors, 1), 1);
  }

  calculateKeywordRelevance(contract, keywords) {
    const text = `${contract.title} ${contract.description} ${contract.agency}`.toLowerCase();
    let score = 0;
    
    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const occurrences = (text.match(new RegExp(keywordLower, 'gi')) || []).length;
      
      if (occurrences > 0) {
        score += 1 + (occurrences * 0.1);
        
        // Boost for title matches
        if (contract.title.toLowerCase().includes(keywordLower)) {
          score += 2;
        }
      }
    });
    
    return Math.min(score / keywords.length, 1);
  }

  calculateLocationRelevance(contract, locations) {
    const location = contract.placeOfPerformance?.toLowerCase() || '';
    return locations.some(loc => location.includes(loc.toLowerCase())) ? 1 : 0;
  }

  calculateNaicsRelevance(contract, naicsCodes) {
    return naicsCodes.includes(contract.naicsCode) ? 1 : 0;
  }

  calculateAmountRelevance(contract, amountRange) {
    const amount = parseFloat(contract.awardAmount) || 0;
    
    if (amountRange.min && amount < amountRange.min) return 0;
    if (amountRange.max && amount > amountRange.max) return 0;
    
    // Calculate relative position in range
    if (amountRange.min && amountRange.max) {
      const range = amountRange.max - amountRange.min;
      const position = (amount - amountRange.min) / range;
      return Math.max(0, 1 - Math.abs(position - 0.5) * 2);
    }
    
    return 0.5;
  }

  calculatePreferenceRelevance(contract, preferences) {
    let score = 0;
    let matches = 0;
    
    if (preferences.preferredStates?.includes(contract.placeOfPerformance)) {
      score += 1;
      matches++;
    }
    
    if (preferences.preferredNaics?.includes(contract.naicsCode)) {
      score += 1;
      matches++;
    }
    
    return matches > 0 ? score / matches : 0;
  }

  async getContextualInsights(query, results, userContext) {
    const insights = [];
    
    // Market insights
    const avgAmount = results.reduce((sum, r) => sum + (parseFloat(r.awardAmount) || 0), 0) / results.length;
    insights.push({
      type: 'market_insight',
      title: 'Market Overview',
      description: `Average contract value: $${avgAmount.toLocaleString()}`
    });
    
    // Time-based insights
    const recentResults = results.filter(r => {
      const daysSincePosted = (new Date() - new Date(r.postedDate)) / (1000 * 60 * 60 * 24);
      return daysSincePosted <= 30;
    });
    
    if (recentResults.length > 0) {
      insights.push({
        type: 'timing_insight',
        title: 'Recent Opportunities',
        description: `${recentResults.length} contracts posted in the last 30 days`
      });
    }
    
    // Competitive insights
    const agencies = [...new Set(results.map(r => r.agency))];
    if (agencies.length > 1) {
      insights.push({
        type: 'competitive_insight',
        title: 'Agency Diversity',
        description: `Contracts from ${agencies.length} different agencies`
      });
    }
    
    return insights;
  }
}

module.exports = new SemanticEnhancer();