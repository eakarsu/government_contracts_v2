const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// GET /api/bid-prediction/predictions
router.get('/predictions', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    
    // Simple function to ensure level properties are strings
    const ensureStringLevel = (obj, defaultLevel = 'medium') => {
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(item => ensureStringLevel(item, defaultLevel));
      }
      
      const result = { ...obj };
      
      // Ensure level is a string
      if (result.level !== undefined) {
        result.level = String(result.level);
      } else {
        result.level = defaultLevel;
      }
      
      // Process nested objects
      Object.keys(result).forEach(key => {
        if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = ensureStringLevel(result[key], defaultLevel);
        }
      });
      
      return result;
    };
    
    // Create completely safe mock data
    const safeMockPredictions = [
      {
        id: 1,
        contractId: 'SAMPLE_001',
        contractTitle: 'IT Services Contract',
        agency: 'Department of Defense',
        probability: 75,
        confidence: 'high',
        confidenceLevel: 85,
        level: 'high',
        factors: [
          { 
            factor: 'Past Performance', 
            impact: 'positive', 
            score: 85, 
            description: 'Strong track record in similar projects', 
            level: 'high' 
          },
          { 
            factor: 'Technical Capability', 
            impact: 'positive', 
            score: 80, 
            description: 'Excellent technical expertise', 
            level: 'high' 
          },
          { 
            factor: 'Price Competitiveness', 
            impact: 'neutral', 
            score: 70, 
            description: 'Competitive pricing strategy', 
            level: 'medium' 
          }
        ],
        recommendations: [
          { 
            type: 'strength', 
            title: 'Leverage Past Performance', 
            description: 'Emphasize your strong track record in proposal', 
            level: 'high' 
          },
          { 
            type: 'improvement', 
            title: 'Enhance Price Strategy', 
            description: 'Consider more competitive pricing approach', 
            level: 'medium' 
          }
        ],
        competitiveAnalysis: { 
          estimatedCompetitors: 8, 
          marketPosition: 'strong',
          level: 'high',
          keyDifferentiators: [
            { name: 'Technical expertise', level: 'high' },
            { name: 'Past performance', level: 'high' }
          ],
          threats: [
            { name: 'Price competition', level: 'medium' },
            { name: 'Established incumbents', level: 'medium' }
          ]
        },
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        contractId: 'SAMPLE_002',
        contractTitle: 'Cybersecurity Services',
        agency: 'Department of Homeland Security',
        probability: 60,
        confidence: 'medium',
        confidenceLevel: 70,
        level: 'medium',
        factors: [
          { 
            factor: 'Security Clearance', 
            impact: 'positive', 
            score: 90, 
            description: 'All required clearances in place', 
            level: 'high' 
          },
          { 
            factor: 'Technical Capability', 
            impact: 'positive', 
            score: 75, 
            description: 'Good cybersecurity expertise', 
            level: 'medium' 
          },
          { 
            factor: 'Competition Level', 
            impact: 'negative', 
            score: 45, 
            description: 'High competition expected', 
            level: 'low' 
          }
        ],
        recommendations: [
          { 
            type: 'strength', 
            title: 'Highlight Security Clearances', 
            description: 'Emphasize clearance advantages', 
            level: 'high' 
          },
          { 
            type: 'risk', 
            title: 'Address Competition', 
            description: 'Develop strong differentiation strategy', 
            level: 'medium' 
          }
        ],
        competitiveAnalysis: { 
          estimatedCompetitors: 12, 
          marketPosition: 'moderate',
          level: 'medium',
          keyDifferentiators: [
            { name: 'Security clearances', level: 'high' },
            { name: 'Specialized expertise', level: 'medium' }
          ],
          threats: [
            { name: 'Many qualified competitors', level: 'high' },
            { name: 'Price pressure', level: 'medium' }
          ]
        },
        createdAt: new Date().toISOString()
      }
    ];
    
    // Ensure all level properties are strings
    const processedPredictions = ensureStringLevel(safeMockPredictions, 'medium');
    
    const responseData = {
      success: true,
      predictions: processedPredictions,
      pagination: {
        total: processedPredictions.length,
        limit: limitNum,
        offset: offsetNum,
        hasMore: false
      }
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching bid predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bid predictions'
    });
  }
});

// GET /api/bid-prediction/history
router.get('/history', async (req, res) => {
  try {
    // Return mock analytics data since tables don't exist in Prisma schema
    const mockAnalytics = {
      totalBids: 15,
      wonBids: 8,
      winRate: 53,
      avgBidAmount: 250000,
      predictionAccuracy: 78,
      monthlyTrends: [
        { month: 'Jul', bids: 3, wins: 2, accuracy: 67, level: 'medium' },
        { month: 'Aug', bids: 4, wins: 2, accuracy: 50, level: 'medium' },
        { month: 'Sep', bids: 2, wins: 1, accuracy: 50, level: 'low' },
        { month: 'Oct', bids: 3, wins: 2, accuracy: 67, level: 'medium' },
        { month: 'Nov', bids: 2, wins: 1, accuracy: 50, level: 'low' },
        { month: 'Dec', bids: 1, wins: 0, accuracy: 0, level: 'low' }
      ],
      topFactors: [
        { factor: 'Past Performance', avgImpact: 85, level: 'high' },
        { factor: 'Technical Capability', avgImpact: 82, level: 'high' },
        { factor: 'Price Competitiveness', avgImpact: 78, level: 'medium' },
        { factor: 'Team Qualifications', avgImpact: 76, level: 'medium' }
      ]
    };

    res.json({
      success: true,
      analytics: mockAnalytics
    });
  } catch (error) {
    console.error('Error fetching bid history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bid history'
    });
  }
});

// POST /api/bid-prediction/analyze
router.post('/analyze', async (req, res) => {
  try {
    const { contractId, contractTitle, agency, estimatedValue } = req.body;
    
    
    // Simulate AI analysis with realistic factors
    const analysisFactors = generateAnalysisFactors(agency, estimatedValue);
    const probability = calculateProbability(analysisFactors);
    const confidenceResult = calculateConfidence(analysisFactors);
    const recommendations = generateRecommendations(analysisFactors, probability);
    const competitiveAnalysis = generateCompetitiveAnalysis(agency, estimatedValue);
    
    let prediction = {
      id: `pred-${Date.now()}`,
      contractId,
      contractTitle: contractTitle || `Contract ${contractId}`,
      agency: agency || 'Unknown Agency',
      probability,
      confidence: String(confidenceResult.level || 'medium'),
      confidenceLevel: confidenceResult.score,
      level: String(confidenceResult.level || 'medium'),
      factors: analysisFactors,
      recommendations,
      competitiveAnalysis,
      createdAt: new Date().toISOString()
    };
    
    // Ensure all nested objects have proper string level properties
    prediction = ensureLevel(prediction, 'medium');
    
    res.json({
      success: true,
      prediction
    });
  } catch (error) {
    console.error('Error analyzing bid:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze bid'
    });
  }
});

// POST /api/bid-prediction/predict/:contractId
router.post('/predict/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params;
    const { companyProfile } = req.body;
    
    // Helper function to ensure all objects have a string level property
    const ensureLevel = (obj, defaultLevel = 'medium') => {
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(item => ensureLevel(item, defaultLevel));
      }
      
      const result = { ...obj };
      if (!result.level || typeof result.level !== 'string') {
        result.level = String(defaultLevel);
      }
      
      Object.keys(result).forEach(key => {
        if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = ensureLevel(result[key], defaultLevel);
        }
      });
      
      return result;
    };
    
    // Create new prediction with enhanced analysis
    const analysisFactors = generateAnalysisFactors('Federal Agency', 1000000);
    const probability = calculateProbability(analysisFactors);
    const confidenceResult = calculateConfidence(analysisFactors);
    
    let prediction = {
      id: `pred-${Date.now()}`,
      contractId,
      contractTitle: `Contract ${contractId}`,
      agency: 'Federal Agency',
      probability: probability,
      probabilityScore: probability,
      confidence: String(confidenceResult.level || 'medium'),
      confidenceLevel: confidenceResult.score,
      level: String(confidenceResult.level || 'medium'),
      factors: analysisFactors,
      recommendations: generateRecommendations(analysisFactors, probability),
      competitiveAnalysis: generateCompetitiveAnalysis('Federal Agency', 1000000),
      predictedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    // Ensure all nested objects have proper string level properties
    prediction = ensureLevel(prediction, 'medium');
    
    res.json({
      success: true,
      contractId,
      prediction
    });
  } catch (error) {
    console.error('Error predicting bid:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict bid success'
    });
  }
});

// Helper functions for realistic analysis
function generateAnalysisFactors(agency, estimatedValue) {
  const baseFactors = [
    { factor: 'Past Performance Match', impact: 'positive', score: Math.floor(Math.random() * 20) + 75 },
    { factor: 'Technical Capability', impact: 'positive', score: Math.floor(Math.random() * 25) + 70 },
    { factor: 'Team Qualifications', impact: 'positive', score: Math.floor(Math.random() * 20) + 75 },
    { factor: 'Price Competitiveness', impact: 'neutral', score: Math.floor(Math.random() * 30) + 60 },
    { factor: 'Competition Level', impact: 'negative', score: Math.floor(Math.random() * 25) + 50 }
  ];
  
  // Adjust factors based on agency and contract value
  if (agency?.includes('DOD') || agency?.includes('Defense')) {
    baseFactors.push({ factor: 'Security Clearance', impact: 'positive', score: Math.floor(Math.random() * 15) + 80 });
  }
  
  if (estimatedValue > 5000000) {
    baseFactors.push({ factor: 'Large Contract Experience', impact: 'positive', score: Math.floor(Math.random() * 20) + 70 });
  }
  
  return baseFactors.map(factor => {
    const score = factor.score;
    let level = 'low';
    if (score >= 80) level = 'high';
    else if (score >= 60) level = 'medium';
    
    return {
      ...factor,
      level: level,
      description: getFactorDescription(factor.factor, factor.score)
    };
  });
}

function getFactorDescription(factor, score) {
  const descriptions = {
    'Past Performance Match': score > 80 ? 'Excellent track record in similar projects' : score > 60 ? 'Good relevant experience' : 'Limited relevant experience',
    'Technical Capability': score > 80 ? 'Strong technical expertise and innovation' : score > 60 ? 'Adequate technical capabilities' : 'Technical gaps identified',
    'Team Qualifications': score > 80 ? 'Highly qualified team with relevant certifications' : score > 60 ? 'Qualified team members' : 'Team augmentation may be needed',
    'Price Competitiveness': score > 80 ? 'Competitive pricing strategy' : score > 60 ? 'Reasonable pricing' : 'Pricing concerns identified',
    'Competition Level': score > 70 ? 'Moderate competition expected' : score > 50 ? 'High competition anticipated' : 'Very competitive environment',
    'Security Clearance': score > 80 ? 'All required clearances in place' : score > 60 ? 'Most clearances available' : 'Clearance gaps exist',
    'Large Contract Experience': score > 80 ? 'Proven large contract management' : score > 60 ? 'Some large contract experience' : 'Limited large contract experience'
  };
  
  return descriptions[factor] || 'Analysis pending';
}

function calculateProbability(factors) {
  const positiveFactors = factors.filter(f => f.impact === 'positive');
  const negativeFactors = factors.filter(f => f.impact === 'negative');
  const neutralFactors = factors.filter(f => f.impact === 'neutral');
  
  const positiveScore = positiveFactors.reduce((sum, f) => sum + f.score, 0) / positiveFactors.length;
  const negativeScore = negativeFactors.reduce((sum, f) => sum + f.score, 0) / negativeFactors.length;
  const neutralScore = neutralFactors.reduce((sum, f) => sum + f.score, 0) / neutralFactors.length;
  
  const weightedScore = (positiveScore * 0.5) + (neutralScore * 0.3) - (negativeScore * 0.2);
  return Math.max(20, Math.min(95, Math.floor(weightedScore)));
}

function calculateConfidence(factors) {
  const avgScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;
  const variance = factors.reduce((sum, f) => sum + Math.pow(f.score - avgScore, 2), 0) / factors.length;
  const confidenceScore = Math.max(60, Math.min(95, 100 - Math.sqrt(variance)));
  
  // Return both numeric score and text level
  let confidenceLevel;
  if (confidenceScore >= 80) {
    confidenceLevel = 'high';
  } else if (confidenceScore >= 60) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }
  
  return {
    score: Math.floor(confidenceScore),
    level: confidenceLevel
  };
}

function generateRecommendations(factors, probability) {
  const recommendations = [];
  
  factors.forEach(factor => {
    let level = 'medium';
    if (factor.score < 70) {
      level = 'high';
      recommendations.push({
        type: 'improvement',
        title: `Improve ${factor.factor}`,
        description: `Focus on strengthening ${factor.factor.toLowerCase()} to increase win probability`,
        level: level
      });
    } else if (factor.score > 85) {
      level = 'high';
      recommendations.push({
        type: 'strength',
        title: `Leverage ${factor.factor}`,
        description: `Emphasize ${factor.factor.toLowerCase()} as a key differentiator in your proposal`,
        level: level
      });
    }
  });
  
  if (probability < 60) {
    recommendations.push({
      type: 'risk',
      title: 'Consider No-Bid Decision',
      description: 'Low probability suggests significant challenges. Evaluate if resources are better allocated elsewhere.',
      level: 'high'
    });
  } else if (probability > 80) {
    recommendations.push({
      type: 'opportunity',
      title: 'High Win Probability',
      description: 'Strong position identified. Ensure proposal quality matches the opportunity.',
      level: 'high'
    });
  }
  
  return recommendations.slice(0, 5); // Limit to 5 recommendations
}

function generateCompetitiveAnalysis(agency, estimatedValue) {
  const competitorCount = Math.floor(Math.random() * 10) + 5;
  const positions = ['strong', 'moderate', 'weak'];
  const position = positions[Math.floor(Math.random() * positions.length)];
  
  // Determine level based on market position
  let level = 'medium';
  if (position === 'strong') level = 'high';
  else if (position === 'weak') level = 'low';
  
  return {
    estimatedCompetitors: competitorCount,
    marketPosition: position,
    level: level,
    keyDifferentiators: [
      { name: 'Technical innovation', level: 'high' },
      { name: 'Cost effectiveness', level: 'medium' },
      { name: 'Past performance', level: 'high' },
      { name: 'Team expertise', level: 'medium' }
    ].slice(0, Math.floor(Math.random() * 3) + 2),
    threats: [
      { name: 'Established incumbents', level: 'medium' },
      { name: 'Price competition', level: 'high' },
      { name: 'Technical requirements', level: 'medium' },
      { name: 'Timeline constraints', level: 'low' }
    ].slice(0, Math.floor(Math.random() * 2) + 2)
  };
}

module.exports = router;
