const express = require('express');
const router = express.Router();

// Mock data storage
let mockRFPResponses = [
  {
    id: 1,
    title: 'DOD Cybersecurity Services Response',
    contractId: 'W52P1J-24-R-0001',
    status: 'in_review',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-16T14:30:00Z',
    submittedAt: null,
    complianceScore: 85,
    estimatedValue: 2500000,
    sections: 4,
    wordCount: 12500
  },
  {
    id: 2,
    title: 'NASA Software Development Proposal',
    contractId: 'NNH24ZHA001N',
    status: 'draft',
    createdAt: '2024-01-18T10:15:00Z',
    updatedAt: '2024-01-20T16:45:00Z',
    submittedAt: null,
    complianceScore: 72,
    estimatedValue: 1800000,
    sections: 3,
    wordCount: 8900
  },
  {
    id: 3,
    title: 'GSA IT Services Contract Response',
    contractId: 'GS-35F-0119Y',
    status: 'submitted',
    createdAt: '2024-01-10T09:30:00Z',
    updatedAt: '2024-01-12T11:20:00Z',
    submittedAt: '2024-01-12T17:00:00Z',
    complianceScore: 92,
    estimatedValue: 3200000,
    sections: 5,
    wordCount: 15200
  },
  {
    id: 4,
    title: 'DHS Border Security Technology',
    contractId: 'HSBP1013D0024',
    status: 'approved',
    createdAt: '2024-01-05T14:20:00Z',
    updatedAt: '2024-01-08T10:15:00Z',
    submittedAt: '2024-01-08T16:30:00Z',
    complianceScore: 88,
    estimatedValue: 4100000,
    sections: 6,
    wordCount: 18750
  }
];

let mockTemplates = [
  {
    id: 1,
    name: 'DOD Standard RFP Template',
    agency: 'Department of Defense',
    description: 'Standard template for DOD contract proposals including security requirements',
    sections: [
      { id: 'exec', title: 'Executive Summary', wordLimit: 1000, required: true },
      { id: 'tech', title: 'Technical Approach', wordLimit: 5000, required: true },
      { id: 'mgmt', title: 'Management Plan', wordLimit: 3000, required: true },
      { id: 'past', title: 'Past Performance', wordLimit: 2000, required: true },
      { id: 'cost', title: 'Cost Proposal', wordLimit: 1500, required: true }
    ],
    evaluationCriteria: {
      technical: 60,
      cost: 25,
      pastPerformance: 15
    },
    createdAt: '2024-01-01T00:00:00Z',
    usageCount: 12
  },
  {
    id: 2,
    name: 'NASA Research & Development Template',
    agency: 'NASA',
    description: 'Template for NASA R&D contracts with emphasis on innovation',
    sections: [
      { id: 'innovation', title: 'Innovation Approach', wordLimit: 4000, required: true },
      { id: 'technical', title: 'Technical Merit', wordLimit: 3500, required: true },
      { id: 'team', title: 'Team Qualifications', wordLimit: 2000, required: true },
      { id: 'timeline', title: 'Project Timeline', wordLimit: 1500, required: true }
    ],
    evaluationCriteria: {
      technical: 70,
      innovation: 20,
      team: 10
    },
    createdAt: '2024-01-02T00:00:00Z',
    usageCount: 8
  }
];

let mockCompanyProfiles = [
  {
    id: 1,
    companyName: 'TechSolutions Inc.',
    basicInfo: {
      dunsNumber: '123456789',
      cageCode: '1A2B3',
      certifications: ['ISO 27001', 'CMMI Level 3', '8(a) Certified'],
      sizeStandard: 'Small Business',
      naicsCode: ['541511', '541512']
    },
    capabilities: [
      'Cybersecurity Services',
      'Software Development',
      'Cloud Migration',
      'AI/ML Solutions'
    ],
    pastPerformance: {
      totalContracts: 45,
      totalValue: 125000000,
      avgRating: 4.7,
      recentProjects: [
        { title: 'DOD Network Security', value: 2500000, year: 2023 },
        { title: 'NASA Data Analytics', value: 1800000, year: 2023 }
      ]
    },
    createdAt: '2024-01-01T00:00:00Z'
  }
];

// GET /api/rfp/dashboard/stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const totalRFPs = mockRFPResponses.length;
    const activeRFPs = mockRFPResponses.filter(r => ['draft', 'in_review'].includes(r.status)).length;
    const completedRFPs = mockRFPResponses.filter(r => ['submitted', 'approved'].includes(r.status)).length;
    const submittedRFPs = mockRFPResponses.filter(r => r.status === 'submitted').length;
    const approvedRFPs = mockRFPResponses.filter(r => r.status === 'approved').length;
    
    const winRate = submittedRFPs > 0 ? Math.round((approvedRFPs / submittedRFPs) * 100) : 0;
    const totalValue = mockRFPResponses.reduce((sum, r) => sum + (r.estimatedValue || 0), 0);
    
    const recentActivity = mockRFPResponses
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(rfp => ({
        rfpId: rfp.id,
        title: rfp.title,
        status: rfp.status,
        lastModified: rfp.updatedAt,
        action: getLastAction(rfp.status)
      }));
    
    const stats = {
      totalRFPs,
      activeRFPs,
      completedRFPs,
      winRate,
      totalValue,
      averageScore: Math.round(mockRFPResponses.reduce((sum, r) => sum + r.complianceScore, 0) / totalRFPs),
      recentActivity
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard stats'
    });
  }
});

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
