const nlpService = require('./nlpService');
const { PrismaClient } = require('@prisma/client');

class QueryParser {
  constructor() {
    this.prisma = new PrismaClient();
    
    // NAICS code mappings for common terms
    this.naicsMappings = {
      'IT': ['541511', '541512', '541519'],
      'software': ['541511', '541512'],
      'cybersecurity': ['541519', '541512'],
      'construction': ['236220', '236118', '237310'],
      'consulting': ['541611', '541690'],
      'engineering': ['541330', '541340'],
      'professional services': ['541611', '541990'],
      'manufacturing': ['31-33'],
      'healthcare': ['62'],
      'education': ['61']
    };

    // State code mappings
    this.stateMappings = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };
  }

  async parseNaturalLanguageQuery(query, userContext = {}) {
    try {
      // Step 1: Extract entities with NLP
      const entities = await nlpService.extractEntities(query);
      const intent = await nlpService.classifyIntent(query);
      
      // Step 2: Build structured search criteria
      const searchCriteria = await this.buildSearchCriteria(entities, intent, userContext, query);
      
      // Step 3: Convert to Prisma query
      const prismaQuery = this.buildPrismaQuery(searchCriteria);
      
      return {
        originalQuery: query,
        parsedCriteria: searchCriteria,
        prismaQuery,
        intent,
        userContext
      };
    } catch (error) {
      console.error('Query parsing error:', error);
      return this.createBasicQuery(query);
    }
  }

  async buildSearchCriteria(entities, intent, userContext, originalQuery = 'projects') {
    const criteria = {
      keywords: [],
      amountRange: null,
      locations: [],
      naicsCodes: [],
      setAsideCodes: [],
      dateRange: null,
      sortBy: 'postedDate',
      sortOrder: 'desc',
      limit: 50,
      offset: 0
    };

    // Handle amounts
    if (entities.amounts && entities.amounts.length > 0) {
      const amount = entities.amounts[0];
      criteria.amountRange = this.parseAmountRange(amount);
    }

    // Handle locations
    if (entities.locations && entities.locations.length > 0) {
      criteria.locations = entities.locations.map(loc => 
        this.stateMappings[loc.toLowerCase()] || loc.toUpperCase()
      );
    }

    // Handle NAICS codes
    if (entities.naics_codes && entities.naics_codes.length > 0) {
      criteria.naicsCodes = this.expandNaicsCodes(entities.naics_codes);
    } else {
      // Try to infer from keywords
      criteria.naicsCodes = this.inferNaicsFromKeywords(entities.keywords || []);
    }

    // Handle set-aside codes
    if (entities.set_aside_codes && entities.set_aside_codes.length > 0) {
      criteria.setAsideCodes = this.mapSetAsideCodes(entities.set_aside_codes);
    }

    // Handle dates
    if (entities.dates && entities.dates.length > 0) {
      criteria.dateRange = this.parseDateRange(entities.dates[0]);
    }

    // Handle keywords - ensure we always have at least one keyword
    if (!entities.keywords || entities.keywords.length === 0) {
      // If no keywords extracted, use the original query as fallback
      criteria.keywords = [originalQuery.toLowerCase().replace(/[^\w\s]/g, '').split(' ').filter(word => word.length > 2).slice(0, 3)].flat();
    } else {
      criteria.keywords = entities.keywords;
    }

    // Apply user context
    if (userContext.preferences) {
      criteria = this.applyUserPreferences(criteria, userContext.preferences);
    }

    return criteria;
  }

  buildPrismaQuery(criteria) {
    const where = {};
    const orderBy = {};

    // Skip amount range filtering as awardAmount field doesn't exist in Contract model
    // Amount range is not available in Prisma schema

    // Locations - using agency field only as placeOfPerformance doesn't exist
    if (criteria.locations.length > 0) {
      where.OR = [
        { agency: { contains: criteria.locations.join('|') } }
      ];
    }

    // NAICS codes
    if (criteria.naicsCodes.length > 0) {
      where.naicsCode = { in: criteria.naicsCodes };
    }

    // Set-aside codes
    if (criteria.setAsideCodes.length > 0) {
      where.setAsideCode = { in: criteria.setAsideCodes };
    }

    // Date range
    if (criteria.dateRange) {
      where.postedDate = {};
      if (criteria.dateRange.from) {
        where.postedDate.gte = criteria.dateRange.from;
      }
      if (criteria.dateRange.to) {
        where.postedDate.lte = criteria.dateRange.to;
      }
    }

    // Keywords
    if (criteria.keywords.length > 0) {
      where.OR = where.OR || [];
      criteria.keywords.forEach(keyword => {
        where.OR.push(
          { title: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
          { agency: { contains: keyword, mode: 'insensitive' } }
        );
      });
    }

    // Sorting
    orderBy[criteria.sortBy] = criteria.sortOrder;

    return {
      where,
      orderBy,
      take: criteria.limit,
      skip: criteria.offset
    };
  }

  parseAmountRange(amount) {
    const range = { min: null, max: null };
    
    switch (amount.operator) {
      case 'lt':
      case 'lte':
        range.max = amount.value;
        break;
      case 'gt':
      case 'gte':
        range.min = amount.value;
        break;
      case 'eq':
        range.min = amount.value * 0.9;
        range.max = amount.value * 1.1;
        break;
      default:
        range.min = 0;
        range.max = amount.value;
    }
    
    return range;
  }

  expandNaicsCodes(codes) {
    const expanded = [];
    codes.forEach(code => {
      if (this.naicsMappings[code.toLowerCase()]) {
        expanded.push(...this.naicsMappings[code.toLowerCase()]);
      } else {
        expanded.push(code);
      }
    });
    return [...new Set(expanded)];
  }

  inferNaicsFromKeywords(keywords) {
    const naicsCodes = [];
    keywords.forEach(keyword => {
      const mapped = this.naicsMappings[keyword.toLowerCase()];
      if (mapped) {
        naicsCodes.push(...mapped);
      }
    });
    return [...new Set(naicsCodes)];
  }

  mapSetAsideCodes(codes) {
    const mapping = {
      'small business': ['SBA', 'SB'],
      '8(a)': ['8(A)', 'SDB'],
      'hubzone': ['HZ'],
      'women-owned': ['WO'],
      'veteran': ['VOSB', 'SDVOSB'],
      'sdvosb': ['SDVOSB']
    };

    const mapped = [];
    codes.forEach(code => {
      const normalized = code.toLowerCase();
      if (mapping[normalized]) {
        mapped.push(...mapping[normalized]);
      } else {
        mapped.push(code.toUpperCase());
      }
    });
    return [...new Set(mapped)];
  }

  parseDateRange(dateEntity) {
    const now = new Date();
    const range = { from: null, to: null };

    if (dateEntity.type === 'relative') {
      switch (dateEntity.value.toLowerCase()) {
        case 'next week':
          range.from = now;
          range.to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'next month':
          range.from = now;
          range.to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
          break;
        case 'this month':
          range.from = new Date(now.getFullYear(), now.getMonth(), 1);
          range.to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'within 30 days':
        case 'next 30 days':
          range.from = now;
          range.to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          range.from = now;
          range.to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    return range;
  }

  extractKeywordsFromQuery(entities) {
    // Extract remaining keywords that aren't covered by structured fields
    const keywords = [];
    
    // Add any terms that didn't match specific entities
    const entityTerms = [
      ...(entities.naics_codes || []),
      ...(entities.locations || []),
      ...(entities.set_aside_codes || [])
    ];
    
    return keywords.filter(k => !entityTerms.includes(k));
  }

  applyUserPreferences(criteria, preferences) {
    // Apply user preferences and historical data
    if (preferences.preferredStates && criteria.locations.length === 0) {
      criteria.locations = preferences.preferredStates;
    }
    
    if (preferences.preferredNaics && criteria.naicsCodes.length === 0) {
      criteria.naicsCodes = preferences.preferredNaics;
    }
    
    if (preferences.amountRange && !criteria.amountRange) {
      criteria.amountRange = preferences.amountRange;
    }
    
    return criteria;
  }

  createBasicQuery(query) {
    return {
      originalQuery: query,
      parsedCriteria: {
        keywords: [query],
        amountRange: null,
        locations: [],
        naicsCodes: [],
        setAsideCodes: [],
        dateRange: null,
        sortBy: 'postedDate',
        sortOrder: 'desc',
        limit: 50,
        offset: 0
      },
      prismaQuery: {
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        orderBy: { postedDate: 'desc' },
        take: 50
      },
      intent: { intent: 'DISCOVERY', confidence: 0.3, sub_intent: 'general' },
      userContext: {}
    };
  }

  async generateQueryExplanation(parsedQuery) {
    const { parsedCriteria, intent } = parsedQuery;
    
    let explanation = `Searching for contracts`;
    
    if (parsedCriteria.keywords.length > 0) {
      explanation += ` related to "${parsedCriteria.keywords.join(', ')}"`;
    }
    
    if (parsedCriteria.amountRange) {
      if (parsedCriteria.amountRange.max) {
        explanation += ` under $${parsedCriteria.amountRange.max.toLocaleString()}`;
      }
      if (parsedCriteria.amountRange.min) {
        explanation += ` over $${parsedCriteria.amountRange.min.toLocaleString()}`;
      }
    }
    
    if (parsedCriteria.locations.length > 0) {
      explanation += ` in ${parsedCriteria.locations.join(', ')}`;
    }
    
    if (parsedCriteria.naicsCodes.length > 0) {
      explanation += ` for ${parsedCriteria.naicsCodes.length} industry categories`;
    }
    
    if (parsedCriteria.dateRange) {
      explanation += ` posted ${this.formatDateRange(parsedCriteria.dateRange)}`;
    }
    
    return explanation;
  }

  formatDateRange(range) {
    if (!range.from && !range.to) return '';
    
    if (range.from && range.to) {
      return `between ${range.from.toLocaleDateString()} and ${range.to.toLocaleDateString()}`;
    }
    
    if (range.from) {
      return `after ${range.from.toLocaleDateString()}`;
    }
    
    return `before ${range.to.toLocaleDateString()}`;
  }
}

module.exports = new QueryParser();