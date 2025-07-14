const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// Initialize database tables for RFP system
async function initializeRFPTables() {
  try {
    // Create company_profiles table
    await query(`
      CREATE TABLE IF NOT EXISTS company_profiles (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        basic_info JSONB DEFAULT '{}',
        capabilities JSONB DEFAULT '{}',
        past_performance JSONB DEFAULT '[]',
        key_personnel JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create rfp_templates table
    await query(`
      CREATE TABLE IF NOT EXISTS rfp_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        agency VARCHAR(255) NOT NULL,
        description TEXT,
        sections JSONB DEFAULT '[]',
        evaluation_criteria JSONB DEFAULT '{}',
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create rfp_responses table
    await query(`
      CREATE TABLE IF NOT EXISTS rfp_responses (
        id SERIAL PRIMARY KEY,
        contract_id VARCHAR(255),
        template_id INTEGER REFERENCES rfp_templates(id),
        company_profile_id INTEGER REFERENCES company_profiles(id),
        title VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        response_data JSONB DEFAULT '{}',
        compliance_status JSONB DEFAULT '{}',
        predicted_score JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ RFP database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing RFP tables:', error);
  }
}

// Initialize tables when the module loads
initializeRFPTables();

// GET /api/rfp/dashboard/stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Return basic stats since we don't have proposals table yet
    // In a real implementation, you would create the proposals table first
    res.json({
      success: true,
      stats: {
        totalRFPs: 0,
        activeRFPs: 0,
        completedRFPs: 0,
        winRate: 0,
        totalValue: 0,
        averageScore: 0,
        recentActivity: []
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
    
    // Mock RFP responses data
    const mockRFPResponses = [
      {
        id: 1,
        title: 'IT Infrastructure Modernization Response',
        contractId: 'CONTRACT_001',
        status: 'draft',
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z'
      },
      {
        id: 2,
        title: 'Cybersecurity Assessment Response',
        contractId: 'CONTRACT_002',
        status: 'submitted',
        createdAt: '2025-01-10T00:00:00Z',
        updatedAt: '2025-01-12T00:00:00Z'
      }
    ];
    
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
    // Query real templates from database
    const result = await query(`
      SELECT 
        id,
        name,
        agency,
        description,
        sections,
        evaluation_criteria,
        created_at,
        updated_at,
        usage_count
      FROM rfp_templates 
      ORDER BY created_at DESC
    `);

    const templates = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      agency: row.agency,
      description: row.description,
      sections: row.sections ? JSON.parse(row.sections) : [],
      evaluationCriteria: row.evaluation_criteria ? JSON.parse(row.evaluation_criteria) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      usageCount: row.usage_count || 0
    }));
    
    res.json({
      success: true,
      templates: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    // If table doesn't exist, return empty array instead of error
    res.json({
      success: true,
      templates: []
    });
  }
});

// GET /api/rfp/company-profiles
router.get('/company-profiles', async (req, res) => {
  try {
    // Query real company profiles from database
    const result = await query(`
      SELECT 
        id,
        company_name,
        basic_info,
        capabilities,
        past_performance,
        key_personnel,
        created_at,
        updated_at
      FROM company_profiles 
      ORDER BY created_at DESC
    `);

    const profiles = result.rows.map(row => ({
      id: row.id,
      companyName: row.company_name,
      basicInfo: row.basic_info ? JSON.parse(row.basic_info) : {},
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : {},
      pastPerformance: row.past_performance ? JSON.parse(row.past_performance) : [],
      keyPersonnel: row.key_personnel ? JSON.parse(row.key_personnel) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json({
      success: true,
      profiles: profiles
    });
  } catch (error) {
    console.error('Error fetching company profiles:', error);
    // If table doesn't exist, return empty array instead of error
    res.json({
      success: true,
      profiles: []
    });
  }
});

// POST /api/rfp/templates
router.post('/templates', async (req, res) => {
  try {
    const {
      name,
      agency,
      description,
      sections = [],
      evaluationCriteria = {}
    } = req.body;

    if (!name || !agency) {
      return res.status(400).json({
        success: false,
        error: 'Template name and agency are required'
      });
    }

    // Create rfp_templates table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS rfp_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        agency VARCHAR(255) NOT NULL,
        description TEXT,
        sections JSONB DEFAULT '[]',
        evaluation_criteria JSONB DEFAULT '{}',
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert the new template
    const result = await query(`
      INSERT INTO rfp_templates (
        name, 
        agency, 
        description, 
        sections, 
        evaluation_criteria
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      name,
      agency,
      description,
      JSON.stringify(sections),
      JSON.stringify(evaluationCriteria)
    ]);

    const template = result.rows[0];
    
    res.status(201).json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        agency: template.agency,
        description: template.description,
        sections: JSON.parse(template.sections),
        evaluationCriteria: JSON.parse(template.evaluation_criteria),
        usageCount: template.usage_count,
        createdAt: template.created_at,
        updatedAt: template.updated_at
      }
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
    const {
      companyName,
      basicInfo = {},
      capabilities = {},
      pastPerformance = [],
      keyPersonnel = []
    } = req.body;

    if (!companyName) {
      return res.status(400).json({
        success: false,
        error: 'Company name is required'
      });
    }

    // Create company_profiles table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS company_profiles (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        basic_info JSONB DEFAULT '{}',
        capabilities JSONB DEFAULT '{}',
        past_performance JSONB DEFAULT '[]',
        key_personnel JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert the new company profile
    const result = await query(`
      INSERT INTO company_profiles (
        company_name, 
        basic_info, 
        capabilities, 
        past_performance, 
        key_personnel
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      companyName,
      JSON.stringify(basicInfo),
      JSON.stringify(capabilities),
      JSON.stringify(pastPerformance),
      JSON.stringify(keyPersonnel)
    ]);

    const profile = result.rows[0];
    
    res.status(201).json({
      success: true,
      profile: {
        id: profile.id,
        companyName: profile.company_name,
        basicInfo: JSON.parse(profile.basic_info),
        capabilities: JSON.parse(profile.capabilities),
        pastPerformance: JSON.parse(profile.past_performance),
        keyPersonnel: JSON.parse(profile.key_personnel),
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
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
    // Mock RFP responses data (same as above)
    const mockRFPResponses = [
      {
        id: 1,
        title: 'IT Infrastructure Modernization Response',
        contractId: 'CONTRACT_001',
        status: 'draft',
        sections: 5,
        complianceScore: 85,
        createdAt: '2025-01-15T00:00:00Z',
        updatedAt: '2025-01-15T00:00:00Z'
      },
      {
        id: 2,
        title: 'Cybersecurity Assessment Response',
        contractId: 'CONTRACT_002',
        status: 'submitted',
        sections: 4,
        complianceScore: 92,
        createdAt: '2025-01-10T00:00:00Z',
        updatedAt: '2025-01-12T00:00:00Z'
      }
    ];
    
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
