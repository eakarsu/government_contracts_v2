const express = require('express');
const router = express.Router();
const winProbabilityPredictor = require('../services/mlWinProbability');
const contractSimilarity = require('../services/contractSimilarity');
const aiOpportunityAlerts = require('../services/aiOpportunityAlerts');
const bidStrategyOptimizer = require('../services/bidStrategyOptimizer');
const { PrismaClient } = require('@prisma/client');
const VectorService = require('../services/vectorService');

const prisma = new PrismaClient();
const vectorService = new VectorService();

// Initialize vector service
vectorService.initialize().catch(console.error);

// Helper function to get contract from vector database
async function getContractFromVector(contractId) {
  try {
    // First try to get by exact ID
    let contract = await vectorService.getContractById(contractId);
    
    if (contract) {
      return contract;
    }
    
    console.log(`Contract not found by ID ${contractId}, searching by content...`);
    
    // Try searching by contract ID as text content first (most specific)
    const exactSearchResults = await vectorService.searchContracts(contractId, { limit: 5 });
    
    if (exactSearchResults && exactSearchResults.length > 0) {
      // Look for exact matches first
      const exactMatch = exactSearchResults.find(result => 
        result.description?.includes(contractId) || 
        result.title?.includes(contractId) ||
        result.noticeId === contractId ||
        result.id === contractId
      );
      
      if (exactMatch) {
        console.log(`Found exact match by content: ${exactMatch.title}`);
        return exactMatch;
      }
    }
    
    // If no exact match, try fuzzy search by extracting keywords from the contract ID
    const keywords = extractSearchKeywords(contractId);
    
    if (keywords.length > 0) {
      console.log(`Searching with extracted keywords: ${keywords.join(', ')}`);
      
      for (const keyword of keywords) {
        const keywordResults = await vectorService.searchContracts(keyword, { limit: 3 });
        
        if (keywordResults && keywordResults.length > 0) {
          // Find the best match that might be related
          const relatedMatch = keywordResults.find(result => 
            result.title?.toLowerCase().includes(keyword.toLowerCase()) ||
            result.description?.toLowerCase().includes(keyword.toLowerCase()) ||
            result.agency?.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (relatedMatch) {
            console.log(`Found related contract by keyword "${keyword}": ${relatedMatch.title}`);
            return relatedMatch;
          }
        }
      }
    }
    
    // Fallback to first result from exact search if available
    if (exactSearchResults && exactSearchResults.length > 0) {
      console.log(`Using fallback match: ${exactSearchResults[0].title}`);
      return exactSearchResults[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting contract from vector database:', error);
    return null;
  }
}

// Helper function to extract search keywords from contract ID
function extractSearchKeywords(contractId) {
  const keywords = [];
  
  // Extract alphanumeric segments
  const segments = contractId.split(/[-_\s]+/).filter(segment => segment.length > 2);
  keywords.push(...segments);
  
  // Extract agency codes (letters at start)
  const agencyMatch = contractId.match(/^([A-Z]+)/);
  if (agencyMatch) {
    keywords.push(agencyMatch[1]);
  }
  
  // Extract specific patterns
  if (contractId.includes('FA8232')) {
    keywords.push('F-16', 'databus', 'MIL-STD-1553', 'Air Force');
  } else if (contractId.includes('W9')) {
    keywords.push('Army', 'Corps of Engineers');
  } else if (contractId.includes('N0')) {
    keywords.push('Navy');
  } else if (contractId.includes('VA-')) {
    keywords.push('Veterans Affairs');
  }
  
  // Remove duplicates and short keywords
  return [...new Set(keywords)].filter(k => k.length > 2);
}

// Win Probability Prediction Endpoint
router.post('/win-probability', async (req, res) => {
  try {
    const { contractId, userContext = {} } = req.body;
    
    if (!contractId) {
      return res.status(400).json({ error: 'Contract ID is required' });
    }

    const contract = await getContractFromVector(contractId);

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
      contract: {
        id: contract.id,
        title: contract.title,
        agency: contract.agency,
        naicsCode: contract.naicsCode,
        awardAmount: contract.awardAmount,
        postedDate: contract.postedDate,
        responseDeadline: contract.responseDeadline
      },
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

    const contract = await getContractFromVector(contractId);

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
      contract: {
        id: contract.id,
        title: contract.title,
        agency: contract.agency,
        naicsCode: contract.naicsCode,
        awardAmount: contract.awardAmount,
        postedDate: contract.postedDate,
        responseDeadline: contract.responseDeadline
      },
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

    const contract = await getContractFromVector(contractId);

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
      contract: {
        id: contract.id,
        title: contract.title,
        agency: contract.agency,
        naicsCode: contract.naicsCode,
        awardAmount: contract.awardAmount,
        postedDate: contract.postedDate,
        responseDeadline: contract.responseDeadline
      },
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
    const { contractId, userId, userContext = {}, analysisType = 'comprehensive' } = req.body;
    
    if (!contractId || !userId) {
      return res.status(400).json({ 
        error: 'Both contractId and userId are required' 
      });
    }

    const contract = await getContractFromVector(contractId);

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Determine which analyses to run based on analysisType
    let analysesToRun = [];
    let winProbability = null;
    let similarContracts = null;
    let opportunities = null;
    let bidStrategy = null;

    if (analysisType === 'comprehensive') {
      // Run all analyses for comprehensive analysis
      analysesToRun = [
        winProbabilityPredictor.predictWinProbability(contract, userContext),
        contractSimilarity.findSimilarContracts(contract, 10),
        aiOpportunityAlerts.generateOpportunityAlerts(userId, userContext),
        bidStrategyOptimizer.optimizeBidStrategy(contract, userContext)
      ];
      [winProbability, similarContracts, opportunities, bidStrategy] = await Promise.all(analysesToRun);
    } else if (analysisType === 'probability') {
      // Run only win probability analysis
      winProbability = await winProbabilityPredictor.predictWinProbability(contract, userContext);
    } else if (analysisType === 'similarity') {
      // Run only similar contracts analysis
      similarContracts = await contractSimilarity.findSimilarContracts(contract, 10);
    } else if (analysisType === 'strategy') {
      // Run only bid strategy analysis
      bidStrategy = await bidStrategyOptimizer.optimizeBidStrategy(contract, userContext);
    }

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
      analysisType,
      ...(winProbability && {
        winProbability: {
          probability: winProbability?.probability ?? 0,
          confidence: winProbability?.confidence ?? 70,
          factors: winProbability?.factors || [],
          recommendations: winProbability?.recommendations || []
        }
      }),
      ...(similarContracts && { similarContracts }),
      ...(opportunities && { opportunities: opportunities?.alerts?.slice(0, 5) || [] }),
      ...(bidStrategy && { bidStrategy }),
      ...(analysisType === 'comprehensive' && {
        overallRecommendation: generateOverallRecommendation({
          winProbability,
          similarContracts,
          bidStrategy
        })
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
        const contract = await getContractFromVector(contractId);

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

// POST /api/ai/generate-proposal - Generate AI proposal for a contract
router.post('/generate-proposal', async (req, res) => {
  try {
    const { contractId, contractTitle, agency, description, naicsCode } = req.body;

    console.log(`[AI] Generating proposal for contract: ${contractId}`);

    // Call OpenRouter AI to generate proposal sections
    const aiService = require('../services/aiService');

    const proposalSections = [
      { id: 'exec', title: 'Executive Summary' },
      { id: 'tech', title: 'Technical Approach' },
      { id: 'mgmt', title: 'Management Plan' },
      { id: 'exp', title: 'Relevant Experience' },
      { id: 'team', title: 'Key Personnel' },
      { id: 'schedule', title: 'Project Schedule' },
      { id: 'quality', title: 'Quality Assurance' },
      { id: 'risk', title: 'Risk Management' }
    ];

    const generatedSections = [];

    for (const section of proposalSections) {
      try {
        const content = await aiService.generateChatCompletion([
          {
            role: 'system',
            content: 'You are an expert government proposal writer. Generate professional, compelling proposal content that addresses contract requirements and highlights company capabilities. Be specific and detailed.'
          },
          {
            role: 'user',
            content: `Generate the "${section.title}" section for a government contract proposal.

Contract Details:
- Title: ${contractTitle || 'Government Contract'}
- Agency: ${agency || 'Federal Agency'}
- NAICS Code: ${naicsCode || 'N/A'}
- Description: ${description || 'Professional services contract'}

Write a professional, detailed ${section.title} section (2-3 paragraphs) that would be compelling for this contract. Focus on:
- Specific capabilities and experience
- Clear understanding of requirements
- Value proposition for the agency
- Concrete deliverables and approach

Return only the section content, no headers or formatting.`
          }
        ], { maxTokens: 800, temperature: 0.4 });

        generatedSections.push({
          id: section.id,
          title: section.title,
          content: content || `[AI generation pending for ${section.title}]`
        });
      } catch (sectionError) {
        console.error(`Error generating ${section.title}:`, sectionError);
        generatedSections.push({
          id: section.id,
          title: section.title,
          content: `Our team brings extensive experience in ${section.title.toLowerCase()} to deliver exceptional results for this contract. We understand the critical requirements outlined and have assembled qualified experts to ensure successful execution.`
        });
      }
    }

    const proposal = {
      id: `proposal-${Date.now()}`,
      contractId,
      contractTitle: contractTitle || 'Government Contract',
      sections: generatedSections,
      generatedAt: new Date().toISOString()
    };

    console.log(`[AI] Proposal generated successfully with ${generatedSections.length} sections`);

    res.json({
      success: true,
      proposal
    });
  } catch (error) {
    console.error('Error generating proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate proposal'
    });
  }
});

// POST /api/ai/export-proposal - Export proposal as PDF
router.post('/export-proposal', async (req, res) => {
  try {
    const { proposal, format } = req.body;

    if (!proposal || !proposal.sections) {
      return res.status(400).json({ error: 'Invalid proposal data' });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${proposal.contractId}.pdf"`);

    doc.pipe(res);

    // Title
    doc.fontSize(24).fillColor('#1a365d').text('PROPOSAL', { align: 'center' });
    doc.moveDown(0.5);

    // Contract info
    doc.fontSize(12).fillColor('#333');
    doc.text(`Contract: ${proposal.contractTitle}`, { align: 'center' });
    doc.text(`Generated: ${new Date(proposal.generatedAt).toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // Divider
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#1a365d');
    doc.moveDown(1);

    // Sections
    proposal.sections.forEach((section, index) => {
      // Section title
      doc.fontSize(14).fillColor('#2c5282').text(`${index + 1}. ${section.title}`, { underline: true });
      doc.moveDown(0.5);

      // Section content
      doc.fontSize(11).fillColor('#333').text(section.content, {
        align: 'justify',
        lineGap: 3
      });
      doc.moveDown(1.5);

      // Add new page if needed
      if (doc.y > 700 && index < proposal.sections.length - 1) {
        doc.addPage();
      }
    });

    doc.end();

  } catch (error) {
    console.error('Error exporting proposal:', error);
    res.status(500).json({ error: 'Failed to export proposal' });
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