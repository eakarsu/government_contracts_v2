const express = require('express');
const router = express.Router();

// Mock data storage
let mockPredictions = [
  {
    id: 'pred-1',
    contractId: 'W52P1J-24-R-0001',
    contractTitle: 'DOD Cybersecurity Services',
    agency: 'Department of Defense',
    probability: 78,
    confidence: 85,
    factors: [
      { factor: 'Past Performance Match', impact: 'positive', score: 92, description: 'Strong track record in similar cybersecurity projects' },
      { factor: 'Technical Capability', impact: 'positive', score: 88, description: 'Advanced AI/ML expertise aligns with requirements' },
      { factor: 'Team Qualifications', impact: 'positive', score: 85, description: 'Security clearances and certifications in place' },
      { factor: 'Competition Level', impact: 'negative', score: 65, description: 'High number of qualified competitors expected' },
      { factor: 'Price Competitiveness', impact: 'neutral', score: 75, description: 'Pricing within expected range' }
    ],
    recommendations: [
      { type: 'improvement', title: 'Enhance Cost Proposal', description: 'Consider value-added services to justify premium pricing' },
      { type: 'strength', title: 'Leverage AI Expertise', description: 'Emphasize unique machine learning capabilities in technical approach' },
      { type: 'risk', title: 'Monitor Competition', description: 'Research competitor capabilities and adjust strategy accordingly' }
    ],
    competitiveAnalysis: {
      estimatedCompetitors: 8,
      marketPosition: 'Strong',
      keyDifferentiators: ['AI/ML expertise', 'Security clearances', 'Past performance'],
      threats: ['Established incumbents', 'Price competition']
    },
    createdAt: '2024-01-15T14:30:00Z'
  },
  {
    id: 'pred-2',
    contractId: 'NNH24ZHA001N',
    contractTitle: 'NASA Software Development',
    agency: 'NASA',
    probability: 65,
    confidence: 78,
    factors: [
      { factor: 'Technical Innovation', impact: 'positive', score: 90, description: 'Cutting-edge software development methodologies' },
      { factor: 'NASA Experience', impact: 'neutral', score: 70, description: 'Limited direct NASA project experience' },
      { factor: 'Team Size', impact: 'positive', score: 82, description: 'Adequate team size for project scope' },
      { factor: 'Timeline Constraints', impact: 'negative', score: 60, description: 'Aggressive timeline may be challenging' }
    ],
    recommendations: [
      { type: 'improvement', title: 'Highlight Space Industry Experience', description: 'Emphasize any aerospace or space-related projects' },
      { type: 'partnership', title: 'Consider Teaming', description: 'Partner with NASA-experienced contractors' },
      { type: 'planning', title: 'Detailed Timeline', description: 'Provide comprehensive project schedule with risk mitigation' }
    ],
    competitiveAnalysis: {
      estimatedCompetitors: 12,
      marketPosition: 'Moderate',
      keyDifferentiators: ['Agile methodology', 'Modern tech stack'],
      threats: ['NASA incumbents', 'Timeline concerns']
    },
    createdAt: '2024-01-18T11:15:00Z'
  }
];

let mockAnalytics = {
  totalBids: 24,
  wonBids: 8,
  winRate: 33.3,
  avgBidAmount: 2850000,
  predictionAccuracy: 82.5,
  monthlyTrends: [
    { month: 'Jan', bids: 4, wins: 1, accuracy: 85 },
    { month: 'Feb', bids: 6, wins: 2, accuracy: 80 },
    { month: 'Mar', bids: 5, wins: 2, accuracy: 83 },
    { month: 'Apr', bids: 9, wins: 3, accuracy: 81 }
  ],
  topFactors: [
    { factor: 'Past Performance', avgImpact: 85 },
    { factor: 'Technical Capability', avgImpact: 82 },
    { factor: 'Price Competitiveness', avgImpact: 78 },
    { factor: 'Team Qualifications', avgImpact: 76 }
  ]
};

// GET /api/bid-prediction/predictions
router.get('/predictions', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);
    
    const paginatedPredictions = mockPredictions.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      success: true,
      predictions: paginatedPredictions,
      pagination: {
        total: mockPredictions.length,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < mockPredictions.length
      }
    });
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
    const confidence = calculateConfidence(analysisFactors);
    const recommendations = generateRecommendations(analysisFactors, probability);
    const competitiveAnalysis = generateCompetitiveAnalysis(agency, estimatedValue);
    
    const prediction = {
      id: `pred-${Date.now()}`,
      contractId,
      contractTitle: contractTitle || `Contract ${contractId}`,
      agency: agency || 'Unknown Agency',
      probability,
      confidence,
      factors: analysisFactors,
      recommendations,
      competitiveAnalysis,
      createdAt: new Date().toISOString()
    };
    
    // Add to mock storage
    mockPredictions.unshift(prediction);
    
    // Update analytics
    mockAnalytics.totalBids++;
    
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
    
    // Find existing prediction or create new one
    let prediction = mockPredictions.find(p => p.contractId === contractId);
    
    if (!prediction) {
      // Create new prediction with enhanced analysis
      const analysisFactors = generateAnalysisFactors('Federal Agency', 1000000);
      const probability = calculateProbability(analysisFactors);
      const confidence = calculateConfidence(analysisFactors);
      
      prediction = {
        id: `pred-${Date.now()}`,
        contractId,
        contractTitle: `Contract ${contractId}`,
        agency: 'Federal Agency',
        probabilityScore: probability,
        confidenceLevel: confidence,
        factors: analysisFactors,
        recommendations: generateRecommendations(analysisFactors, probability),
        competitiveAnalysis: generateCompetitiveAnalysis('Federal Agency', 1000000),
        predictedAt: new Date().toISOString()
      };
      
      mockPredictions.unshift(prediction);
    }
    
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
  
  return baseFactors.map(factor => ({
    ...factor,
    description: getFactorDescription(factor.factor, factor.score)
  }));
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
  const confidence = Math.max(60, Math.min(95, 100 - Math.sqrt(variance)));
  return Math.floor(confidence);
}

function generateRecommendations(factors, probability) {
  const recommendations = [];
  
  factors.forEach(factor => {
    if (factor.score < 70) {
      recommendations.push({
        type: 'improvement',
        title: `Improve ${factor.factor}`,
        description: `Focus on strengthening ${factor.factor.toLowerCase()} to increase win probability`
      });
    } else if (factor.score > 85) {
      recommendations.push({
        type: 'strength',
        title: `Leverage ${factor.factor}`,
        description: `Emphasize ${factor.factor.toLowerCase()} as a key differentiator in your proposal`
      });
    }
  });
  
  if (probability < 60) {
    recommendations.push({
      type: 'risk',
      title: 'Consider No-Bid Decision',
      description: 'Low probability suggests significant challenges. Evaluate if resources are better allocated elsewhere.'
    });
  } else if (probability > 80) {
    recommendations.push({
      type: 'opportunity',
      title: 'High Win Probability',
      description: 'Strong position identified. Ensure proposal quality matches the opportunity.'
    });
  }
  
  return recommendations.slice(0, 5); // Limit to 5 recommendations
}

function generateCompetitiveAnalysis(agency, estimatedValue) {
  const competitorCount = Math.floor(Math.random() * 10) + 5;
  const positions = ['Strong', 'Moderate', 'Weak'];
  const position = positions[Math.floor(Math.random() * positions.length)];
  
  return {
    estimatedCompetitors: competitorCount,
    marketPosition: position,
    keyDifferentiators: [
      'Technical innovation',
      'Cost effectiveness',
      'Past performance',
      'Team expertise'
    ].slice(0, Math.floor(Math.random() * 3) + 2),
    threats: [
      'Established incumbents',
      'Price competition',
      'Technical requirements',
      'Timeline constraints'
    ].slice(0, Math.floor(Math.random() * 2) + 2)
  };
}

module.exports = router;
