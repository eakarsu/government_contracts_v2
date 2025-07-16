const express = require('express');
const nlpService = require('../services/nlpService');
const queryParser = require('../services/queryParser');
const logger = require('../utils/logger');
const config = require('../config/env');

const router = express.Router();

// Natural language search endpoint
router.post('/natural', async (req, res) => {
  try {
    const { query, userContext = {}, includeSemantic = true } = req.body;
    const userId = req.user?.id;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query is required',
        success: false
      });
    }

    logger.info(`Natural language search: "${query}" by user ${userId}`);

    // Step 1: Parse natural language query
    const parsedQuery = await queryParser.parseNaturalLanguageQuery(query, userContext);
    
    // Ensure we have a valid parsed query even if NLP fails
    if (!parsedQuery.parsedCriteria) {
      parsedQuery.parsedCriteria = {
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
      };
    }
    
    if (!parsedQuery.intent) {
      parsedQuery.intent = { intent: 'DISCOVERY', confidence: 0.5, sub_intent: 'general' };
    }
    
    // Step 2: Execute vector database search
    let vectorResults = [];
    try {
      const vectorService = require('../server').vectorService;
      if (vectorService && vectorService.isConnected) {
        const searchResult = await vectorService.searchContracts(
          parsedQuery.parsedCriteria.keywords.join(' '), 
          { limit: 50, threshold: 0.1 }
        );
        
        // Map vector results to contract format
        vectorResults = searchResult.map(result => ({
          id: result.id,
          noticeId: result.id,
          title: result.title,
          description: result.description,
          agency: result.agency,
          naicsCode: result.naicsCode,
          classificationCode: null,
          postedDate: result.postedDate,
          setAsideCode: result.setAsideCode,
          resourceLinks: result.resourceLinks || [],
          indexedAt: new Date(),
          createdAt: new Date()
        }));
      } else {
        logger.warn('Vector service not available, falling back to empty results');
      }
    } catch (error) {
      logger.warn('Vector search failed:', error.message);
    }

    // Step 3: Semantic search (optional)
    let semanticResults = [];
    if (includeSemantic) {
      try {
        const SemanticSearchService = require('../services/semanticSearchService');
        const semanticSearchService = new SemanticSearchService();
        
        const searchResult = await semanticSearchService.semanticSearch(parsedQuery.parsedCriteria.keywords.join(' '), {
          limit: 20,
          threshold: 0.6
        });
        semanticResults = searchResult.results || [];
      } catch (error) {
        logger.warn('Semantic search failed:', error.message);
      }
    }

    // Step 4: Merge and rank results
    const finalResults = await mergeAndRankResults(vectorResults, semanticResults, parsedQuery);

    // Step 5: Generate explanation
    const explanation = await queryParser.generateQueryExplanation(parsedQuery);

    // Log search for analytics (skip PostgreSQL logging)
    // await logSearch(query, parsedQuery, finalResults.length, userId);

    res.json({
      success: true,
      query: query,
      explanation: explanation,
      results: finalResults,
      totalCount: finalResults.length,
      parsedQuery: {
        intent: parsedQuery.intent,
        criteria: parsedQuery.parsedCriteria,
        explanation: explanation
      }
    });

  } catch (error) {
    logger.error('Natural language search error:', error);
    res.status(500).json({
      error: 'Failed to process natural language query',
      success: false,
      details: config.nodeEnv === 'development' ? error.message : undefined
    });
  }
});

// Quick search suggestions endpoint
router.get('/suggestions', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    // Get popular search patterns based on partial query
    const suggestions = await generateSearchSuggestions(q, limit);
    
    res.json({ suggestions });
  } catch (error) {
    logger.error('Suggestions error:', error);
    res.status(500).json({ suggestions: [] });
  }
});

// Query validation endpoint
router.post('/validate', async (req, res) => {
  try {
    const { query } = req.body;
    const parsedQuery = await queryParser.parseNaturalLanguageQuery(query);
    
    res.json({
      valid: true,
      parsed: parsedQuery,
      issues: validateQuery(parsedQuery)
    });
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: error.message
    });
  }
});

// Intent classification endpoint
router.post('/classify-intent', async (req, res) => {
  try {
    const { query } = req.body;
    const intent = await nlpService.classifyIntent(query);
    
    res.json({
      intent,
      suggestions: getIntentBasedSuggestions(intent)
    });
  } catch (error) {
    logger.error('Intent classification error:', error);
    res.status(500).json({
      error: 'Failed to classify intent'
    });
  }
});

// Entity extraction endpoint
router.post('/extract-entities', async (req, res) => {
  try {
    const { text } = req.body;
    const entities = await nlpService.extractEntities(text);
    
    res.json({
      entities,
      structured: await structureEntities(entities)
    });
  } catch (error) {
    logger.error('Entity extraction error:', error);
    res.status(500).json({
      error: 'Failed to extract entities'
    });
  }
});

// Personalized suggestions endpoint
router.post('/personalized-suggestions', async (req, res) => {
  try {
    const { userId, context = {} } = req.body;
    
    // Generate personalized search suggestions based on user history
    const suggestions = [
      {
        query: "Find IT contracts under $500K in California",
        description: "Based on your recent searches for IT opportunities",
        category: "recommended"
      },
      {
        query: "Small business set-aside cybersecurity contracts",
        description: "Popular among similar users",
        category: "trending"
      },
      {
        query: "Construction projects due this month",
        description: "Time-sensitive opportunities",
        category: "urgent"
      },
      {
        query: "Consulting services under $1M",
        description: "High-value consulting opportunities",
        category: "featured"
      },
      {
        query: "Federal contracts for small businesses",
        description: "Set-aside opportunities",
        category: "featured"
      }
    ];
    
    res.json({ suggestions });
  } catch (error) {
    logger.error('Personalized suggestions error:', error);
    res.status(500).json({
      error: 'Failed to generate personalized suggestions',
      suggestions: []
    });
  }
});

// Helper functions
async function mergeAndRankResults(vectorResults, semanticResults, parsedQuery) {
  const semanticMap = new Map();
  semanticResults.forEach(result => {
    semanticMap.set(result.id, result.score);
  });

  // Combine and score results
  const combined = vectorResults.map(contract => {
    const semanticScore = semanticMap.get(contract.id) || 0;
    const keywordScore = calculateKeywordScore(contract, parsedQuery.parsedCriteria.keywords);
    const relevanceScore = calculateRelevanceScore(contract, parsedQuery.parsedCriteria);
    
    return {
      ...contract,
      scores: {
        semantic: semanticScore,
        keyword: keywordScore,
        relevance: relevanceScore,
        overall: (semanticScore * 0.3 + keywordScore * 0.3 + relevanceScore * 0.4)
      }
    };
  });

  // Sort by overall score
  return combined
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .slice(0, 50); // Limit results
}

function calculateKeywordScore(contract, keywords) {
  if (!keywords || keywords.length === 0) return 0;
  
  let score = 0;
  const text = `${contract.title} ${contract.description} ${contract.agency}`.toLowerCase();
  
  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    if (text.includes(keywordLower)) {
      score += 1;
      if (contract.title.toLowerCase().includes(keywordLower)) {
        score += 2; // Boost for title matches
      }
    }
  });
  
  return Math.min(score / keywords.length, 1);
}

function calculateRelevanceScore(contract, criteria) {
  let score = 0;
  let factors = 0;

  // Location match
  if (criteria.locations.length > 0) {
    const locationMatch = criteria.locations.some(loc => 
      contract.placeOfPerformance?.includes(loc) || 
      contract.agency?.includes(loc)
    );
    score += locationMatch ? 0.3 : 0;
    factors++;
  }

  // NAICS match
  if (criteria.naicsCodes.length > 0) {
    const naicsMatch = criteria.naicsCodes.includes(contract.naicsCode);
    score += naicsMatch ? 0.4 : 0;
    factors++;
  }

  // Amount range match
  if (criteria.amountRange) {
    // Skip amount filtering as we don't have awardAmount field in Contract model
    // This field is not available in Prisma schema
    factors++;
  }

  return factors > 0 ? score / factors : 0.5;
}

async function generateSearchSuggestions(partialQuery, limit) {
  const commonPatterns = [
    'Find IT contracts under $500K',
    'Construction projects in California',
    'Small business set-aside opportunities',
    'Cybersecurity contracts due this month',
    'Consulting services under $1M'
  ];

  return commonPatterns
    .filter(pattern => pattern.toLowerCase().includes(partialQuery.toLowerCase()))
    .slice(0, limit);
}

// PostgreSQL logging function removed - vector-only search

function validateQuery(parsedQuery) {
  const issues = [];
  
  if (!parsedQuery.parsedCriteria.keywords.length && 
      !parsedQuery.parsedCriteria.naicsCodes.length &&
      !parsedQuery.parsedCriteria.locations.length) {
    issues.push('Query too vague - please include specific keywords, locations, or contract types');
  }
  
  return issues;
}

function getIntentBasedSuggestions(intent) {
  const suggestions = {
    DISCOVERY: [
      'Try specifying dollar amounts',
      'Add location filters',
      'Include NAICS codes for better precision'
    ],
    COMPARISON: [
      'Use "vs" to compare specific contracts',
      'Add time ranges for historical comparison'
    ],
    ALERT: [
      'Set up daily alerts for this search',
      'Configure notification preferences'
    ],
    ANALYTICS: [
      'Try "trends" or "statistics" for market insights',
      'Use date ranges for historical analysis'
    ]
  };
  
  return suggestions[intent.intent] || suggestions.DISCOVERY;
}

async function structureEntities(entities) {
  return {
    searchable: {
      amountRange: entities.amounts?.[0] ? {
        min: 0,
        max: entities.amounts[0].value
      } : null,
      locations: entities.locations || [],
      naicsCodes: entities.naics_codes || [],
      setAsideCodes: entities.set_aside_codes || [],
      keywords: entities.keywords || []
    },
    raw: entities
  };
}

module.exports = router;