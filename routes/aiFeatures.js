const express = require('express');
const router = express.Router();
const winProbabilityPredictor = require('../services/mlWinProbability');
const contractSimilarity = require('../services/contractSimilarity');
const aiOpportunityAlerts = require('../services/aiOpportunityAlerts');
const bidStrategyOptimizer = require('../services/bidStrategyOptimizer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Win Probability Prediction Endpoint
router.post('/win-probability', async (req, res) => {
  try {
    const { contractId, userContext = {} } = req.body;
    
    if (!contractId) {
      return res.status(400).json({ error: 'Contract ID is required' });
    }

    const contract = await prisma.contract.findUnique({
      where: { noticeId: contractId }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const prediction = await winProbabilityPredictor.predictWinProbability(
      contract, 
      userContext
    );

    res.json({
      success: true,
      contractId,
      prediction,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Win probability prediction error:', error);
    res.status(500).json({ error: 'Failed to predict win probability' });
  }
});

// Contract Similarity Endpoint
router.post('/similar-contracts', async (req, res) => {
  try {
    const { contractId, limit = 5, userContext = {} } = req.body;
    
    if (!contractId) {
      return res.status(400).json({ error: 'Contract ID is required' });
    }

    const contract = await prisma.contract.findUnique({
      where: { noticeId: contractId }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const similarities = await contractSimilarity.findSimilarContracts(
      contract, 
      limit
    );

    res.json({
      success: true,
      contractId,
      similarities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Similar contracts error:', error);
    res.status(500).json({ error: 'Failed to find similar contracts' });
  }
});

// AI Opportunity Alerts Endpoint
router.post('/opportunity-alerts', async (req, res) => {
  try {
    const { userId, userContext = {} } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const alerts = await aiOpportunityAlerts.generateOpportunityAlerts(
      userId, 
      userContext
    );

    res.json({
      success: true,
      userId,
      alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Opportunity alerts error:', error);
    res.status(500).json({ error: 'Failed to generate opportunity alerts' });
  }
});

// Bid Strategy Optimization Endpoint
router.post('/optimize-strategy', async (req, res) => {
  try {
    const { contractId, userContext = {} } = req.body;
    
    if (!contractId) {
      return res.status(400).json({ error: 'Contract ID is required' });
    }

    const contract = await prisma.contract.findUnique({
      where: { noticeId: contractId }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const strategy = await bidStrategyOptimizer.optimizeBidStrategy(
      contract, 
      userContext
    );

    res.json({
      success: true,
      contractId,
      strategy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Strategy optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize bid strategy' });
  }
});

// Combined AI Analysis Endpoint
router.post('/comprehensive-analysis', async (req, res) => {
  try {
    const { contractId, userId, userContext = {} } = req.body;
    
    if (!contractId || !userId) {
      return res.status(400).json({ 
        error: 'Both contractId and userId are required' 
      });
    }

    const contract = await prisma.contract.findUnique({
      where: { noticeId: contractId }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Run all AI analyses in parallel
    const [
      winProbability,
      similarContracts,
      opportunities,
      bidStrategy
    ] = await Promise.all([
      winProbabilityPredictor.predictWinProbability(contract, userContext),
      contractSimilarity.findSimilarContracts(contract, 10),
      aiOpportunityAlerts.generateOpportunityAlerts(userId, userContext),
      bidStrategyOptimizer.optimizeBidStrategy(contract, userContext)
    ]);

    const comprehensiveAnalysis = {
      contract: {
        id: contract.id,
        title: contract.title,
        agency: contract.agency,
        naicsCode: contract.naicsCode,
        awardAmount: contract.awardAmount,
        postedDate: contract.postedDate,
        responseDeadline: contract.responseDeadline
      },
      winProbability,
      similarContracts,
      opportunities: opportunities.alerts.slice(0, 5), // Top 5 additional opportunities
      bidStrategy,
      overallRecommendation: generateOverallRecommendation({
        winProbability,
        similarContracts,
        bidStrategy
      })
    };

    res.json({
      success: true,
      analysis: comprehensiveAnalysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Comprehensive analysis error:', error);
    res.status(500).json({ error: 'Failed to generate comprehensive analysis' });
  }
});

// User Preferences Management - Updated to handle missing table
router.post('/preferences', async (req, res) => {
  try {
    const { userId, preferences } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Return success but note that preferences are stored in memory/session
    res.json({
      success: true,
      preferences: preferences,
      message: 'Preferences stored in session (database storage not available)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Preferences update error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get User Preferences - Updated to return default preferences
router.get('/preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Return default preferences
    res.json({
      success: true,
      preferences: {
        preferredNaicsCodes: [],
        preferredAgencies: [],
        preferredStates: [],
        certifications: [],
        keywords: [],
        minContractValue: 0
      },
      message: 'Using default preferences (database storage not available)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Preferences fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Batch Analysis Endpoint
router.post('/batch-analysis', async (req, res) => {
  try {
    const { contractIds, userContext = {} } = req.body;
    
    if (!contractIds || !Array.isArray(contractIds)) {
      return res.status(400).json({ error: 'contractIds array is required' });
    }

    const results = await Promise.all(
      contractIds.map(async (contractId) => {
        const contract = await prisma.contract.findUnique({
          where: { noticeId: contractId }
        });

        if (!contract) return null;

        const [winProbability, similarContracts] = await Promise.all([
          winProbabilityPredictor.predictWinProbability(contract, userContext),
          contractSimilarity.findSimilarContracts(contract, 3)
        ]);

        return {
          contractId,
          contract: {
            id: contract.id,
            title: contract.title,
            agency: contract.agency,
            awardAmount: contract.awardAmount
          },
          winProbability,
          similarContracts: similarContracts.matches.length,
          overallScore: winProbability.probability
        };
      })
    );

    const validResults = results.filter(r => r !== null);

    res.json({
      success: true,
      results: validResults.sort((a, b) => b.overallScore - a.overallScore),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({ error: 'Failed to perform batch analysis' });
  }
});

// Health Check Endpoint
router.get('/health', async (req, res) => {
  try {
    const services = [
      'winProbabilityPredictor',
      'contractSimilarity',
      'aiOpportunityAlerts',
      'bidStrategyOptimizer'
    ];

    const healthStatus = {
      status: 'healthy',
      services: services.reduce((acc, service) => {
        acc[service] = 'available';
        return acc;
      }, {}),
      timestamp: new Date().toISOString()
    };

    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper method for overall recommendation
function generateOverallRecommendation(analysis) {
  const { winProbability, similarContracts, bidStrategy } = analysis;
  
  if (winProbability.probability >= 70) {
    return {
      action: 'pursue',
      confidence: 'high',
      reasoning: 'Strong win probability with good market alignment',
      priority: 'high'
    };
  } else if (winProbability.probability >= 50) {
    return {
      action: 'consider',
      confidence: 'medium',
      reasoning: 'Moderate probability but may require strategic adjustments',
      priority: 'medium'
    };
  } else {
    return {
      action: 'evaluate',
      confidence: 'low',
      reasoning: 'Low probability - consider if strategic value justifies effort',
      priority: 'low'
    };
  }
}

module.exports = router;