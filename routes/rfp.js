const express = require('express');
const { prisma } = require('../config/database');

const router = express.Router();

// ========================================
// RFP SYSTEM ENDPOINTS
// ========================================

// RFP Templates Management
router.get('/templates', async (req, res) => {
  try {
    console.log('📋 [DEBUG] Getting RFP templates');
    
    const templates = await prisma.rfpTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { rfpResponses: true }
        }
      }
    });

    res.json({
      success: true,
      templates: templates.map(template => ({
        ...template,
        sections: JSON.parse(template.sections || '[]'),
        evaluationCriteria: JSON.parse(template.evaluationCriteria || '{}'),
        usageCount: template._count.rfpResponses
      }))
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error getting RFP templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    console.log('📋 [DEBUG] Creating RFP template:', req.body.name);
    
    const { name, agency, description, sections, evaluationCriteria } = req.body;
    
    const template = await prisma.rfpTemplate.create({
      data: {
        name,
        agency,
        description,
        sections: JSON.stringify(sections),
        evaluationCriteria: JSON.stringify(evaluationCriteria)
      }
    });

    res.json({
      success: true,
      template: {
        ...template,
        sections: JSON.parse(template.sections),
        evaluationCriteria: JSON.parse(template.evaluationCriteria)
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error creating RFP template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Company Profiles Management
router.get('/company-profiles', async (req, res) => {
  try {
    console.log('🏢 [DEBUG] Getting company profiles');
    
    const profiles = await prisma.companyProfile.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      success: true,
      profiles: profiles.map(profile => ({
        ...profile,
        ...JSON.parse(profile.profileData || '{}')
      }))
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error getting company profiles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/company-profiles', async (req, res) => {
  try {
    console.log('🏢 [DEBUG] Creating company profile:', req.body.companyName);
    
    const profileData = req.body;
    
    const profile = await prisma.companyProfile.create({
      data: {
        companyName: profileData.companyName,
        profileData: JSON.stringify(profileData)
      }
    });

    res.json({
      success: true,
      profile: {
        ...profile,
        ...JSON.parse(profile.profileData)
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error creating company profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/company-profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🏢 [DEBUG] Updating company profile:', id);
    
    const profileData = req.body;
    
    const profile = await prisma.companyProfile.update({
      where: { id: parseInt(id) },
      data: {
        companyName: profileData.companyName,
        profileData: JSON.stringify(profileData)
      }
    });

    res.json({
      success: true,
      profile: {
        ...profile,
        ...JSON.parse(profile.profileData)
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error updating company profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// RFP Contract Analysis
router.post('/analyze/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params;
    console.log(`🔍 [DEBUG] Analyzing contract for RFP: ${contractId}`);

    const rfpService = require('../services/rfpService');
    const analysis = await rfpService.analyzeContractForRFP(contractId);

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error(`❌ [DEBUG] Error analyzing contract for RFP ${req.params.contractId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// RFP Generation
router.post('/generate', async (req, res) => {
  try {
    const { contractId, templateId, companyProfileId, customInstructions, focusAreas } = req.body;
    console.log(`🚀 [DEBUG] Generating RFP response for contract: ${contractId}`);

    const startTime = Date.now();
    const rfpService = require('../services/rfpService');

    // Create RFP response record first
    const rfpResponse = await prisma.rfpResponse.create({
      data: {
        contractId: contractId,
        templateId: templateId,
        companyProfileId: companyProfileId,
        title: `RFP Response - Contract ${contractId}`,
        status: 'draft',
        responseData: JSON.stringify({
          sections: [],
          metadata: {
            generatedAt: new Date().toISOString(),
            customInstructions,
            focusAreas
          }
        }),
        complianceStatus: JSON.stringify({ overall: false, score: 0, checks: {}, issues: [] }),
        predictedScore: 0
      }
    });

    // Generate RFP content using service
    const generationResult = await rfpService.generateRFPResponse(
      contractId, 
      templateId, 
      companyProfileId, 
      { customInstructions, focusAreas }
    );

    // Update RFP response with generated content
    await prisma.rfpResponse.update({
      where: { id: rfpResponse.id },
      data: {
        responseData: JSON.stringify({
          sections: generationResult.sections,
          metadata: {
            ...generationResult.metadata,
            customInstructions,
            focusAreas
          }
        }),
        complianceStatus: JSON.stringify(generationResult.compliance),
        predictedScore: generationResult.predictedScore.overall || generationResult.predictedScore
      }
    });

    console.log(`📊 [DEBUG] Updated RFP response ${rfpResponse.id} with ${generationResult.sections.length} sections`);
    console.log(`📊 [DEBUG] First section preview:`, generationResult.sections[0]?.title, generationResult.sections[0]?.content?.substring(0, 100));

    const generationTime = Date.now() - startTime;

    console.log(`✅ [DEBUG] RFP generation completed in ${generationTime}ms`);

    res.json({
      success: true,
      rfpResponseId: rfpResponse.id,
      generationTime,
      sectionsGenerated: generationResult.sections.length,
      complianceScore: generationResult.compliance.score,
      predictedScore: generationResult.predictedScore.overall,
      message: `Successfully generated ${generationResult.sections.length} sections for RFP response`
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error generating RFP response:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// RFP Response Management
router.get('/responses', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    console.log(`📋 [DEBUG] Getting RFP responses (page ${page}, limit ${limit})`);

    const responses = await prisma.rfpResponse.findMany({
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { updatedAt: 'desc' },
      include: {
        contract: {
          select: { title: true, agency: true }
        },
        template: {
          select: { name: true, agency: true }
        },
        companyProfile: {
          select: { companyName: true }
        }
      }
    });

    const total = await prisma.rfpResponse.count();

    res.json({
      success: true,
      responses: responses.map(response => ({
        ...response,
        responseData: JSON.parse(response.responseData || '{}'),
        complianceStatus: JSON.parse(response.complianceStatus || '{}')
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error getting RFP responses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/responses/:responseId', async (req, res) => {
  try {
    const { responseId } = req.params;
    console.log(`📋 [DEBUG] Getting RFP response: ${responseId}`);

    const response = await prisma.rfpResponse.findUnique({
      where: { id: parseInt(responseId) },
      include: {
        contract: true,
        template: true,
        companyProfile: true
      }
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'RFP response not found'
      });
    }

    const parsedResponseData = JSON.parse(response.responseData || '{}');
    console.log(`📊 [DEBUG] Retrieved RFP response ${responseId}:`);
    console.log(`📊 [DEBUG] - Response data keys:`, Object.keys(parsedResponseData));
    console.log(`📊 [DEBUG] - Sections count:`, parsedResponseData.sections?.length || 0);
    console.log(`📊 [DEBUG] - First section:`, parsedResponseData.sections?.[0]?.title);

    res.json({
      success: true,
      response: {
        ...response,
        responseData: parsedResponseData,
        complianceStatus: JSON.parse(response.complianceStatus || '{}'),
        template: {
          ...response.template,
          sections: JSON.parse(response.template.sections || '[]'),
          evaluationCriteria: JSON.parse(response.template.evaluationCriteria || '{}')
        },
        companyProfile: {
          ...response.companyProfile,
          profileData: JSON.parse(response.companyProfile.profileData || '{}')
        }
      }
    });

  } catch (error) {
    console.error(`❌ [DEBUG] Error getting RFP response ${req.params.responseId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// RFP Competitive Analysis
router.post('/competitive-analysis', async (req, res) => {
  try {
    const { contractId, companyProfileId } = req.body;
    console.log(`📊 [DEBUG] Getting competitive analysis for contract: ${contractId}`);

    const rfpService = require('../services/rfpService');
    const analysis = await rfpService.getCompetitiveAnalysis(contractId, companyProfileId);

    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error getting competitive analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// RFP Compliance Check
router.post('/responses/:responseId/compliance', async (req, res) => {
  try {
    const { responseId } = req.params;
    console.log(`✅ [DEBUG] Checking compliance for RFP response: ${responseId}`);

    const response = await prisma.rfpResponse.findUnique({
      where: { id: parseInt(responseId) },
      include: { template: true }
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'RFP response not found'
      });
    }

    const rfpService = require('../services/rfpService');
    const responseData = JSON.parse(response.responseData || '{}');
    const compliance = rfpService.checkCompliance(responseData, response.template);

    // Update compliance status in database
    await prisma.rfpResponse.update({
      where: { id: parseInt(responseId) },
      data: {
        complianceStatus: JSON.stringify(compliance)
      }
    });

    res.json({
      success: true,
      compliance
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error checking compliance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// RFP Score Prediction
router.post('/responses/:responseId/score-prediction', async (req, res) => {
  try {
    const { responseId } = req.params;
    console.log(`🎯 [DEBUG] Predicting score for RFP response: ${responseId}`);

    const response = await prisma.rfpResponse.findUnique({
      where: { id: parseInt(responseId) },
      include: { 
        template: true,
        companyProfile: true
      }
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'RFP response not found'
      });
    }

    const rfpService = require('../services/rfpService');
    const responseData = JSON.parse(response.responseData || '{}');
    const companyData = JSON.parse(response.companyProfile.profileData || '{}');
    const templateData = {
      ...response.template,
      sections: JSON.parse(response.template.sections || '[]'),
      evaluationCriteria: JSON.parse(response.template.evaluationCriteria || '{}')
    };

    const prediction = rfpService.predictScore(responseData.sections, templateData, companyData);

    // Update predicted score in database
    await prisma.rfpResponse.update({
      where: { id: parseInt(responseId) },
      data: {
        predictedScore: prediction.overall
      }
    });

    res.json({
      success: true,
      prediction
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error predicting score:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete RFP Response
router.delete('/responses/:responseId', async (req, res) => {
  try {
    const { responseId } = req.params;
    console.log(`🗑️ [DEBUG] Deleting RFP response: ${responseId}`);

    const response = await prisma.rfpResponse.findUnique({
      where: { id: parseInt(responseId) }
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'RFP response not found'
      });
    }

    await prisma.rfpResponse.delete({
      where: { id: parseInt(responseId) }
    });

    res.json({
      success: true,
      message: 'RFP response deleted successfully'
    });

  } catch (error) {
    console.error(`❌ [DEBUG] Error deleting RFP response ${req.params.responseId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// RFP Dashboard Stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    console.log('📊 [DEBUG] Getting RFP dashboard stats');

    const [totalRFPs, activeRFPs, submittedRFPs, recentActivity] = await Promise.all([
      prisma.rfpResponse.count(),
      prisma.rfpResponse.count({ where: { status: { in: ['draft', 'in_review'] } } }),
      prisma.rfpResponse.count({ where: { status: 'submitted' } }),
      prisma.rfpResponse.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true
        }
      })
    ]);

    // Calculate win rate (placeholder - would need actual win/loss tracking)
    const winRate = submittedRFPs > 0 ? Math.round((submittedRFPs * 0.3) * 100) / 100 : 0;
    const averageScore = 85; // Placeholder

    res.json({
      success: true,
      stats: {
        totalRFPs,
        activeRFPs,
        submittedRFPs,
        winRate,
        averageScore,
        recentActivity: recentActivity.map(rfp => ({
          rfpId: rfp.id,
          title: rfp.title,
          status: rfp.status,
          lastModified: rfp.updatedAt.toISOString()
        }))
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error getting RFP dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

console.log('📋 [DEBUG] RFP router module loaded successfully');
module.exports = router;
