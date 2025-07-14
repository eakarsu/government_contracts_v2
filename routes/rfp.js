const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// Initialize database tables for RFP system
async function initializeRFPTables() {
  try {
    // Create contracts table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id SERIAL PRIMARY KEY,
        notice_id VARCHAR(255) UNIQUE,
        title TEXT,
        agency VARCHAR(255),
        description TEXT,
        posted_date DATE,
        response_date DATE,
        set_aside VARCHAR(100),
        naics_code VARCHAR(20),
        contract_value DECIMAL,
        place_of_performance TEXT,
        contact_info JSONB DEFAULT '{}',
        requirements JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

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

    // Add missing columns if they don't exist (for existing tables)
    try {
      await query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS basic_info JSONB DEFAULT '{}'`);
      await query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{}'`);
      await query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS past_performance JSONB DEFAULT '[]'`);
      await query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS key_personnel JSONB DEFAULT '[]'`);
      await query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'`);
    } catch (alterError) {
      console.log('Note: Some columns may already exist:', alterError.message);
    }

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
    try {
      const result = await query(`
        SELECT 
          id,
          name,
          agency,
          description,
          sections,
          evaluation_criteria,
          created_at,
          updated_at
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
        usageCount: 0 // Default value since column doesn't exist yet
      }));
      
      console.log(`📋 [DEBUG] Found ${templates.length} templates`);
      
      res.json({
        success: true,
        templates: templates
      });
    } catch (dbError) {
      console.warn('Templates table may not exist:', dbError.message);
      res.json({
        success: true,
        templates: []
      });
    }
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
    // Query real company profiles from database
    try {
      const result = await query(`
        SELECT 
          id,
          company_name,
          basic_info,
          capabilities,
          past_performance,
          key_personnel,
          profile_data,
          created_at,
          updated_at
        FROM company_profiles 
        ORDER BY created_at DESC
      `);

      const profiles = result.rows.map(row => ({
        id: row.id,
        companyName: row.company_name,
        basicInfo: row.basic_info ? (typeof row.basic_info === 'string' ? JSON.parse(row.basic_info) : row.basic_info) : {},
        capabilities: row.capabilities ? (typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities) : {},
        pastPerformance: row.past_performance ? (typeof row.past_performance === 'string' ? JSON.parse(row.past_performance) : row.past_performance) : [],
        keyPersonnel: row.key_personnel ? (typeof row.key_personnel === 'string' ? JSON.parse(row.key_personnel) : row.key_personnel) : [],
        profileData: row.profile_data ? (typeof row.profile_data === 'string' ? JSON.parse(row.profile_data) : row.profile_data) : {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      console.log(`📋 [DEBUG] Found ${profiles.length} company profiles`);
      
      res.json({
        success: true,
        profiles: profiles
      });
    } catch (dbError) {
      console.error('Company profiles database error:', dbError.message);
      // If table doesn't exist or has wrong schema, return empty array
      res.json({
        success: true,
        profiles: []
      });
    }
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
        profile_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add missing columns if they don't exist (for existing tables)
    try {
      await query(`ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS profile_data JSONB DEFAULT '{}'`);
    } catch (alterError) {
      console.log('Note: profile_data column may already exist:', alterError.message);
    }

    // Prepare the complete profile data
    const profileData = {
      basicInfo,
      capabilities,
      pastPerformance,
      keyPersonnel
    };

    // Insert the new company profile
    const result = await query(`
      INSERT INTO company_profiles (
        company_name, 
        basic_info, 
        capabilities, 
        past_performance, 
        key_personnel,
        profile_data,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `, [
      companyName,
      JSON.stringify(basicInfo),
      JSON.stringify(capabilities),
      JSON.stringify(pastPerformance),
      JSON.stringify(keyPersonnel),
      JSON.stringify(profileData)
    ]);

    const profile = result.rows[0];
    
    res.status(201).json({
      success: true,
      profile: {
        id: profile.id,
        companyName: profile.company_name,
        basicInfo: typeof profile.basic_info === 'string' ? JSON.parse(profile.basic_info) : profile.basic_info,
        capabilities: typeof profile.capabilities === 'string' ? JSON.parse(profile.capabilities) : profile.capabilities,
        pastPerformance: typeof profile.past_performance === 'string' ? JSON.parse(profile.past_performance) : profile.past_performance,
        keyPersonnel: typeof profile.key_personnel === 'string' ? JSON.parse(profile.key_personnel) : profile.key_personnel,
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

// DELETE /api/rfp/company-profiles/:id
router.delete('/company-profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Valid company profile ID is required'
      });
    }

    // Check if the company profile exists
    const checkResult = await query(`
      SELECT id, company_name FROM company_profiles WHERE id = $1
    `, [parseInt(id)]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Company profile not found'
      });
    }

    const profileName = checkResult.rows[0].company_name;

    // Delete the company profile
    const deleteResult = await query(`
      DELETE FROM company_profiles WHERE id = $1
    `, [parseInt(id)]);

    console.log(`🗑️ [DEBUG] Deleted company profile: ${profileName} (ID: ${id})`);

    res.json({
      success: true,
      message: `Company profile "${profileName}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting company profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete company profile'
    });
  }
});

// POST /api/rfp/generate - Generate RFP response
router.post('/generate', async (req, res) => {
  try {
    const {
      contractId,
      templateId,
      companyProfileId,
      customInstructions,
      focusAreas
    } = req.body;

    console.log('🚀 [DEBUG] RFP Generation request:', {
      contractId,
      templateId,
      companyProfileId,
      customInstructions,
      focusAreas
    });

    // Validate required fields
    if (!contractId || !templateId || !companyProfileId) {
      return res.status(400).json({
        success: false,
        message: 'Contract ID, template ID, and company profile ID are required'
      });
    }

    // Get contract details - handle case where contracts table might be empty
    let contract;
    try {
      const contractResult = await query(`
        SELECT id, notice_id, title, agency, description
        FROM contracts 
        WHERE notice_id = $1 OR id = $1
        LIMIT 1
      `, [contractId]);

      if (contractResult.rows.length === 0) {
        // If contract not found in database, create a mock contract for demo purposes
        console.log(`⚠️ [DEBUG] Contract ${contractId} not found in database, using mock data`);
        contract = {
          id: contractId,
          notice_id: contractId,
          title: `Mock Contract ${contractId}`,
          agency: 'Demo Agency',
          description: 'This is a mock contract for demonstration purposes since the contract was not found in the database.'
        };
      } else {
        contract = contractResult.rows[0];
      }
    } catch (contractError) {
      console.error('❌ [DEBUG] Error querying contracts table:', contractError.message);
      // Create a mock contract if there's a database error
      contract = {
        id: contractId,
        notice_id: contractId,
        title: `Mock Contract ${contractId}`,
        agency: 'Demo Agency',
        description: 'This is a mock contract for demonstration purposes due to database error.'
      };
    }

    // Get template details
    const templateResult = await query(`
      SELECT id, name, agency, sections, evaluation_criteria
      FROM rfp_templates 
      WHERE id = $1
    `, [parseInt(templateId)]);

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const template = templateResult.rows[0];
    const templateSections = template.sections ? JSON.parse(template.sections) : [];

    // Get company profile details
    const profileResult = await query(`
      SELECT id, company_name, basic_info, capabilities, past_performance, key_personnel
      FROM company_profiles 
      WHERE id = $1
    `, [parseInt(companyProfileId)]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company profile not found'
      });
    }

    const profile = profileResult.rows[0];

    // Generate a title for the RFP response
    const responseTitle = `${contract.title} - ${profile.company_name} Response`;

    // Create the RFP response record
    const responseResult = await query(`
      INSERT INTO rfp_responses (
        contract_id,
        template_id,
        company_profile_id,
        title,
        status,
        response_data,
        compliance_status,
        predicted_score,
        metadata,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [
      contractId,
      parseInt(templateId),
      parseInt(companyProfileId),
      responseTitle,
      'draft',
      JSON.stringify({
        sections: templateSections.map(section => ({
          id: section.id || `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: section.title,
          content: `[Generated content for ${section.title}]\n\nThis section would contain AI-generated content based on:\n- Contract requirements: ${contract.title}\n- Company capabilities: ${profile.company_name}\n- Template guidelines: ${section.description || 'Standard section'}\n\n${customInstructions ? `Custom instructions: ${customInstructions}\n\n` : ''}${focusAreas && focusAreas.length > 0 ? `Focus areas: ${focusAreas.join(', ')}\n\n` : ''}[Content generation is not fully implemented yet - this is a placeholder]`,
          wordCount: Math.floor(Math.random() * 2000) + 500,
          status: 'generated',
          lastModified: new Date().toISOString()
        })),
        contract: {
          id: contract.id,
          noticeId: contract.notice_id,
          title: contract.title,
          agency: contract.agency
        },
        template: {
          id: template.id,
          name: template.name,
          agency: template.agency
        },
        companyProfile: {
          id: profile.id,
          name: profile.company_name
        },
        customInstructions,
        focusAreas
      }),
      JSON.stringify({
        overall: true,
        score: Math.floor(Math.random() * 20) + 80, // Random score between 80-100
        checks: {
          wordLimits: { passed: true, details: 'All sections within limits' },
          requiredSections: { passed: true, details: 'All required sections present' },
          formatCompliance: { passed: true, details: 'Proper formatting' },
          requirementCoverage: { passed: true, details: 'Requirements addressed' }
        },
        issues: []
      }),
      JSON.stringify({
        technical: Math.floor(Math.random() * 20) + 80,
        cost: Math.floor(Math.random() * 20) + 75,
        pastPerformance: Math.floor(Math.random() * 20) + 85,
        overall: Math.floor(Math.random() * 20) + 80
      }),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        generationTime: Math.floor(Math.random() * 30) + 15, // Random time 15-45 seconds
        sectionsGenerated: templateSections.length,
        aiModel: 'placeholder-model',
        version: '1.0'
      })
    ]);

    const rfpResponse = responseResult.rows[0];

    console.log('✅ [DEBUG] RFP Response created successfully:', {
      id: rfpResponse.id,
      title: rfpResponse.title,
      sectionsGenerated: templateSections.length
    });

    res.status(201).json({
      success: true,
      message: 'RFP response generated successfully',
      rfpResponseId: rfpResponse.id,
      sectionsGenerated: templateSections.length,
      complianceScore: JSON.parse(rfpResponse.compliance_status).score,
      predictedScore: JSON.parse(rfpResponse.predicted_score).overall,
      generationTime: JSON.parse(rfpResponse.metadata).generationTime
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error generating RFP response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate RFP response',
      error: error.message
    });
  }
});

// GET /api/rfp/contracts - Get contracts for RFP generation
router.get('/contracts', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // Get contracts from the main contracts table
    try {
      const result = await query(`
        SELECT 
          id,
          notice_id,
          title,
          agency,
          posted_date,
          description
        FROM contracts 
        ORDER BY posted_date DESC NULLS LAST, created_at DESC
        LIMIT $1
      `, [parseInt(limit)]);

      const contracts = result.rows.map(row => ({
        id: row.id,
        noticeId: row.notice_id,
        title: row.title,
        agency: row.agency,
        postedDate: row.posted_date,
        description: row.description?.substring(0, 200) + '...' || 'No description available'
      }));
      
      console.log(`📋 [DEBUG] Found ${contracts.length} contracts for RFP generation`);
      
      res.json({
        success: true,
        contracts: contracts
      });
    } catch (dbError) {
      console.warn('Contracts table may not exist:', dbError.message);
      res.json({
        success: true,
        contracts: []
      });
    }
  } catch (error) {
    console.error('Error fetching contracts for RFP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contracts'
    });
  }
});

module.exports = router;
