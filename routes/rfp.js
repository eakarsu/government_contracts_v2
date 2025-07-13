const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// GET /api/rfp/dashboard/stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_rfps,
        COUNT(CASE WHEN status IN ('draft', 'in_review') THEN 1 END) as active_rfps,
        COUNT(CASE WHEN status IN ('submitted', 'approved') THEN 1 END) as completed_rfps,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_rfps,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_rfps,
        AVG(compliance_score) as avg_score,
        SUM(estimated_value) as total_value
      FROM proposals 
      WHERE user_id = $1
    `, [req.user.id]);

    const recentResult = await query(`
      SELECT id, title, status, updated_at
      FROM proposals 
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 5
    `, [req.user.id]);

    const stats = statsResult.rows[0];
    const totalRFPs = parseInt(stats.total_rfps || 0);
    const submittedRFPs = parseInt(stats.submitted_rfps || 0);
    const approvedRFPs = parseInt(stats.approved_rfps || 0);
    
    const winRate = submittedRFPs > 0 ? Math.round((approvedRFPs / submittedRFPs) * 100) : 0;
    
    const recentActivity = recentResult.rows.map(rfp => ({
      rfpId: rfp.id,
      title: rfp.title,
      status: rfp.status,
      lastModified: rfp.updated_at,
      action: getLastAction(rfp.status)
    }));
    
    res.json({
      success: true,
      stats: {
        totalRFPs,
        activeRFPs: parseInt(stats.active_rfps || 0),
        completedRFPs: parseInt(stats.completed_rfps || 0),
        winRate,
        totalValue: parseFloat(stats.total_value || 0),
        averageScore: Math.round(parseFloat(stats.avg_score || 0)),
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats'
    });
  }
});

function getLastAction(status) {
  const actions = {
    'draft': 'Created draft',
    'in_review': 'Under review',
    'submitted': 'Submitted to agency',
    'approved': 'Contract awarded'
  };
  return actions[status] || 'Updated';
}

// GET /api/rfp/responses
router.get('/responses', async (req, res) => {
  try {
    const { page = 1, limit = 5 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    const sortedResponses = mockRFPResponses.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    const paginatedResponses = sortedResponses.slice(offset, offset + limitNum);
    const totalPages = Math.ceil(mockRFPResponses.length / limitNum);
    
    res.json({
      success: true,
      responses: paginatedResponses,
      pagination: {
        total: mockRFPResponses.length,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching RFP responses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RFP responses'
    });
  }
});

function getLastAction(status) {
  const actions = {
    'draft': 'Created draft',
    'in_review': 'Under review',
    'submitted': 'Submitted to agency',
    'approved': 'Contract awarded'
  };
  return actions[status] || 'Updated';
}

// GET /api/rfp/templates
router.get('/templates', async (req, res) => {
  try {
    res.json({
      success: true,
      templates: mockTemplates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

// GET /api/rfp/company-profiles
router.get('/company-profiles', async (req, res) => {
  try {
    res.json({
      success: true,
      profiles: mockCompanyProfiles
    });
  } catch (error) {
    console.error('Error fetching company profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company profiles'
    });
  }
});

// POST /api/rfp/templates
router.post('/templates', async (req, res) => {
  try {
    const { name, agency, description, sections, evaluationCriteria } = req.body;
    
    const template = {
      id: mockTemplates.length + 1,
      name,
      agency,
      description,
      sections: sections || [],
      evaluationCriteria: evaluationCriteria || {},
      createdAt: new Date().toISOString(),
      usageCount: 0
    };
    
    mockTemplates.push(template);
    
    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template'
    });
  }
});

// POST /api/rfp/company-profiles
router.post('/company-profiles', async (req, res) => {
  try {
    const profileData = req.body;
    
    const profile = {
      id: mockCompanyProfiles.length + 1,
      companyName: profileData.companyName,
      basicInfo: profileData.basicInfo || {},
      capabilities: profileData.capabilities || [],
      pastPerformance: profileData.pastPerformance || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    mockCompanyProfiles.push(profile);
    
    res.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Error creating company profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create company profile'
    });
  }
});

// GET /api/rfp/responses/:id
router.get('/responses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = mockRFPResponses.find(r => r.id === parseInt(id));
    
    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'RFP response not found'
      });
    }
    
    // Add detailed response data
    const detailedResponse = {
      ...response,
      sections: generateDetailedSections(response.sections),
      complianceDetails: generateComplianceDetails(response.complianceScore),
      timeline: generateTimeline(response),
      attachments: generateAttachments()
    };
    
    res.json({
      success: true,
      response: detailedResponse
    });
  } catch (error) {
    console.error('Error fetching RFP response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RFP response'
    });
  }
});

// Helper functions
function generateDetailedSections(sectionCount) {
  const sectionTemplates = [
    { id: 'exec', title: 'Executive Summary', wordCount: 950, status: 'approved' },
    { id: 'tech', title: 'Technical Approach', wordCount: 4800, status: 'reviewed' },
    { id: 'mgmt', title: 'Management Plan', wordCount: 2900, status: 'reviewed' },
    { id: 'past', title: 'Past Performance', wordCount: 1950, status: 'approved' },
    { id: 'cost', title: 'Cost Proposal', wordCount: 1400, status: 'draft' }
  ];
  
  return sectionTemplates.slice(0, sectionCount).map(section => ({
    ...section,
    lastModified: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    compliance: {
      wordLimit: { compliant: section.wordCount <= 5000 },
      requirements: { covered: Math.floor(Math.random() * 5) + 3 }
    }
  }));
}

function generateComplianceDetails(score) {
  return {
    overall: score >= 80,
    score,
    checks: {
      wordLimits: { passed: score >= 85, details: 'All sections within word limits' },
      requiredSections: { passed: score >= 75, details: 'All required sections present' },
      formatCompliance: { passed: score >= 90, details: 'Proper formatting maintained' },
      requirementCoverage: { passed: score >= 80, details: 'Key requirements addressed' }
    },
    issues: score < 80 ? [
      { type: 'warning', message: 'Consider expanding technical approach section' },
      { type: 'info', message: 'Review cost justification details' }
    ] : []
  };
}

function generateTimeline(response) {
  const events = [
    { date: response.createdAt, event: 'RFP response created', type: 'created' },
    { date: response.updatedAt, event: 'Last updated', type: 'updated' }
  ];
  
  if (response.submittedAt) {
    events.push({ date: response.submittedAt, event: 'Submitted to agency', type: 'submitted' });
  }
  
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function generateAttachments() {
  return [
    { name: 'Technical_Diagrams.pdf', size: '2.4 MB', type: 'pdf' },
    { name: 'Cost_Breakdown.xlsx', size: '156 KB', type: 'excel' },
    { name: 'Team_Resumes.pdf', size: '1.8 MB', type: 'pdf' }
  ];
}

module.exports = router;
