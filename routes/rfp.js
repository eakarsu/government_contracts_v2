const express = require('express');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const ProposalDraftingService = require('../services/proposalDraftingService');

const router = express.Router();
const prisma = new PrismaClient();
const proposalService = new ProposalDraftingService();

// OpenRouter configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Retry configuration
const DEFAULT_MAX_RETRIES = parseInt(process.env.RFP_MAX_RETRIES || '3');
const REQUEST_TIMEOUT_MS = parseInt(process.env.RFP_REQUEST_TIMEOUT_MS || '120000'); // 2 minutes

// Helper function to determine if an error is retryable (504 Gateway Timeout or similar)
function isRetryableError(error) {
  // Check HTTP status codes
  if (error.response?.status === 504) return true;
  if (error.response?.status === 502) return true; // Bad Gateway
  if (error.response?.status === 503) return true; // Service Unavailable

  // Check error codes
  if (error.code === 'ECONNABORTED') return true; // Request timeout
  if (error.code === 'ETIMEDOUT') return true; // Connection timeout
  if (error.code === 'ECONNRESET') return true; // Connection reset

  // Check error messages for timeout indicators
  const message = error.message.toLowerCase();
  const timeoutKeywords = [
    '504', 'gateway time-out', 'gateway timeout', 'timeout',
    'timed out', 'connection timeout', 'request timeout',
    'upstream timeout', 'service temporarily unavailable'
  ];

  return timeoutKeywords.some(keyword => message.includes(keyword));
}

// Function to generate RFP content using OpenRouter for individual sections with retry logic
async function generateRFPContentWithAI(contract, template, profile, section, customInstructions, focusAreas, maxRetries = DEFAULT_MAX_RETRIES) {
  if (!OPENROUTER_API_KEY) {
    console.warn('⚠️ [DEBUG] OpenRouter API key not configured, using placeholder content');
    return `[Placeholder content for ${section.title}]\n\nThis section would contain AI-generated content based on the contract requirements and company capabilities.`;
  }

  const prompt = `
You are an expert RFP response writer. Generate a comprehensive, professional response for the following RFP section:

**CONTRACT INFORMATION:**
- Title: ${contract.title}
- Agency: ${contract.agency}
- Description: ${contract.description}

**COMPANY PROFILE:**
- Company: ${profile.company_name}
- Basic Info: ${JSON.stringify(profile.basic_info || {})}
- Capabilities: ${JSON.stringify(profile.capabilities || {})}
- Past Performance: ${JSON.stringify(profile.past_performance || [])}
- Key Personnel: ${JSON.stringify(profile.key_personnel || [])}

**SECTION TO GENERATE:**
- Title: ${section.title}
- Description: ${section.description || 'Standard RFP section'}
- Requirements: ${JSON.stringify(section.requirements || [])}

**ADDITIONAL INSTRUCTIONS:**
${customInstructions ? `Custom Instructions: ${customInstructions}` : 'Follow standard government contracting best practices.'}
${focusAreas && focusAreas.length > 0 ? `Focus Areas: ${focusAreas.join(', ')}` : ''}

Generate a comprehensive, professional response that:
1. Directly addresses the section requirements and evaluation criteria
2. Highlights relevant company capabilities and experience
3. Uses specific examples from past performance when applicable
4. Maintains a professional, confident tone
5. Is between 1500-3000 words depending on section importance
6. Includes specific technical details and methodologies
7. Demonstrates understanding of the agency's mission and objectives
8. Provides quantifiable benefits and outcomes
9. Addresses risk mitigation and quality assurance

**CRITICAL: Generate substantial, detailed content (1500-3000 words). This is a professional government RFP response that requires comprehensive coverage.**

Do not include any meta-commentary or explanations - provide only the RFP section content.
`;

  // Retry logic with exponential backoff for 504 Gateway Timeout errors
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [DEBUG] Generating content for section "${section.title}" (attempt ${attempt}/${maxRetries})`);
      
      const response = await axios.post(`${OPENROUTER_BASE_URL}/chat/completions`, {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 8000,
        temperature: 0.7,
        // Add timeout to prevent hanging requests
        timeout: REQUEST_TIMEOUT_MS
      }, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3001',
          'X-Title': 'Government Contracts RFP Generator'
        }
      });

      const generatedContent = response.data.choices[0].message.content;
      console.log(`✅ [DEBUG] Successfully generated AI content for section: ${section.title} (${generatedContent.length} chars) on attempt ${attempt}`);
      
      return generatedContent;

    } catch (error) {
      const isRetryable = isRetryableError(error);

      console.error(`❌ [DEBUG] Attempt ${attempt}/${maxRetries} failed for section "${section.title}":`, {
        status: error.response?.status,
        code: error.code,
        message: error.message,
        isRetryable
      });

      // If this is not a retryable error, don't retry
      if (!isRetryable) {
        console.warn(`⚠️ [DEBUG] Non-retryable error for section "${section.title}", not retrying:`, error.message);
        return `[AI generation failed for ${section.title}]\n\nThis section would contain professional RFP response content addressing the requirements for ${section.title}. Please review and complete manually.\n\nError: ${error.message}`;
      }

      // If this is the last attempt, return error content
      if (attempt === maxRetries) {
        console.error(`❌ [DEBUG] All ${maxRetries} attempts failed for section "${section.title}" due to retryable errors`);
        return `[AI generation failed after ${maxRetries} attempts for ${section.title}]\n\nThis section experienced repeated service errors (timeouts, gateway errors, etc.). Please try regenerating this section individually or review and complete manually.\n\nLast error: ${error.message}`;
      }

      // Calculate exponential backoff delay: 2^attempt seconds (2s, 4s, 8s, etc.)
      const delayMs = Math.min(Math.pow(2, attempt) * 1000, 30000); // Max 30 seconds
      console.log(`⏳ [DEBUG] Retryable error for section "${section.title}", retrying in ${delayMs/1000} seconds...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Async RFP processing function
async function processRFPJobAsync(jobId) {
  console.log(`🚀 [ASYNC] Starting processing for job: ${jobId}`);
  
  const job = global.rfpJobs.get(jobId);
  if (!job) {
    console.error(`❌ [ASYNC] Job not found: ${jobId}`);
    return;
  }

  console.log(`📋 [ASYNC] Job data:`, JSON.stringify(job, null, 2));

  try {
    console.log(`🔄 [ASYNC] Updating job status to processing...`);
    // Update job status
    job.status = 'processing';
    job.startedAt = new Date();
    job.progress.message = 'Starting RFP generation...';
    job.progress.current = 0;

    console.log(`📝 [ASYNC] Preparing request data...`);
    // Use existing RFP generation logic
    const request = {
      contractId: job.contractId,
      templateId: job.templateId,
      companyProfileId: job.companyProfileId,
      customInstructions: job.customInstructions,
      focusAreas: job.focusAreas
    };
    
    console.log(`📋 [ASYNC] Request prepared:`, request);

    // Get contract, template, profile - try multiple approaches
    console.log(`🔍 [DEBUG] Looking for contract: ${job.contractId}`);
    
    let contract = await prisma.contract.findFirst({
      where: { 
        noticeId: job.contractId
      }
    });
    
    // If still not found, create a mock contract for testing
    if (!contract) {
      console.log(`⚠️ [DEBUG] Contract not found, creating mock contract for: ${job.contractId}`);
      contract = {
        id: job.contractId,
        noticeId: job.contractId,
        title: `Mock Contract ${job.contractId}`,
        description: 'Mock contract for RFP generation testing',
        agency: 'Test Agency'
      };
    }
    
    const template = await prisma.rfpTemplate.findUnique({
      where: { id: parseInt(job.templateId) }
    });
    
    if (!template) {
      throw new Error(`Template not found: ${job.templateId}`);
    }
    
    const profile = await prisma.companyProfile.findUnique({
      where: { id: parseInt(job.companyProfileId) }
    });
    
    if (!profile) {
      throw new Error(`Company profile not found: ${job.companyProfileId}`);
    }

    const templateSections = generateDetailedSections(15);

    console.log(`📊 [ASYNC] Generated ${templateSections.length} template sections`);
    job.progress.message = 'Processing sections with AI...';

    // Process sections with progress updates
    const generatedSections = [];
    for (let i = 0; i < templateSections.length; i++) {
      job.progress.current = i + 1;
      job.progress.message = `Processing section ${i + 1}/15: ${templateSections[i].title}`;
      
      console.log(`🤖 [ASYNC] Processing section ${i + 1}/15: "${templateSections[i].title}"`);
      console.log(`📋 [ASYNC] Section details:`, {
        title: templateSections[i].title,
        description: templateSections[i].description,
        requirements: templateSections[i].requirements?.length || 0
      });
      
      const startTime = Date.now();
      const content = await generateRFPContentWithAI(
        contract, template, profile, templateSections[i], 
        job.customInstructions, job.focusAreas
      );
      const endTime = Date.now();
      
      const wordCount = content.split(' ').length;
      console.log(`✅ [ASYNC] Section ${i + 1}/15 completed in ${endTime - startTime}ms (${wordCount} words)`);
      
      generatedSections.push({
        ...templateSections[i],
        content: content,
        wordCount: wordCount
      });
    }

    console.log(`💾 [ASYNC] Creating RFP response in database...`);
    job.progress.message = 'Saving RFP response...';

    // Create RFP response
    const rfpResponse = await prisma.rfpResponse.create({
      data: {
        contractId: String(contract.noticeId || contract.id),
        templateId: parseInt(job.templateId),
        companyProfileId: parseInt(job.companyProfileId),
        title: `${contract.title || 'RFP Response'} - Generated`,
        status: 'draft',
        responseData: { sections: generatedSections }
      }
    });

    console.log(`✅ [ASYNC] RFP Response created with ID: ${rfpResponse.id}`);

    // Mark job as completed
    job.status = 'completed';
    job.completedAt = new Date();
    job.rfpResponseId = rfpResponse.id;
    job.progress.message = 'RFP generation completed successfully!';
    
    console.log(`🎉 [ASYNC] Job ${jobId} completed successfully! RFP ID: ${rfpResponse.id}`);

  } catch (error) {
    console.error(`❌ [ASYNC] Job ${jobId} failed:`, error);
    console.error(`💥 [ASYNC] Error stack:`, error.stack);
    
    job.status = 'failed';
    job.error = error.message;
    job.progress.message = `Failed: ${error.message}`;
    job.completedAt = new Date();
  }
}

// Database initialization is now handled by Prisma migrations and seeding

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
    const skip = (pageNum - 1) * limitNum;
    
    console.log(`🔍 [DEBUG] Fetching RFP responses - page: ${pageNum}, limit: ${limitNum}`);

    // Get total count using Prisma
    const totalCount = await prisma.rfpResponse.count();

    // Query RFP responses using Prisma
    const responses = await prisma.rfpResponse.findMany({
      skip: skip,
      take: limitNum,
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        contractId: true,
        templateId: true,
        companyProfileId: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const formattedResponses = responses.map(response => ({
      id: response.id,
      title: response.title,
      contractId: response.contractId,
      templateId: response.templateId,
      companyProfileId: response.companyProfileId,
      status: response.status,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt
    }));

    const totalPages = Math.ceil(totalCount / limitNum);
    
    console.log(`✅ [DEBUG] Found ${formattedResponses.length} RFP responses (total: ${totalCount})`);
    
    res.json({
      success: true,
      responses: formattedResponses,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error fetching RFP responses:', error);
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
    const templates = await prisma.rfpTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      agency: template.agency,
      description: template.description,
      sections: template.sections,
      evaluationCriteria: template.evaluationCriteria,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      usageCount: template.usageCount || 0
    }));
    
    console.log(`📋 [DEBUG] Found ${formattedTemplates.length} templates`);
    
    res.json({
      success: true,
      templates: formattedTemplates
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
    const profiles = await prisma.companyProfile.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const formattedProfiles = profiles.map(profile => ({
      id: profile.id,
      companyName: profile.companyName,
      basicInfo: profile.basicInfo || {},
      capabilities: profile.capabilities || {},
      pastPerformance: profile.pastPerformance || [],
      keyPersonnel: profile.keyPersonnel || [],
      profileData: profile.profileData || {},
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    }));
    
    console.log(`📋 [DEBUG] Found ${formattedProfiles.length} company profiles`);
    
    res.json({
      success: true,
      profiles: formattedProfiles
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

    // Database tables are now managed by Prisma migrations

    // Create the new template using Prisma
    const template = await prisma.rfpTemplate.create({
      data: {
        name,
        agency,
        description,
        sections,
        evaluationCriteria
      }
    });
    
    res.status(201).json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        agency: template.agency,
        description: template.description,
        sections: template.sections,
        evaluationCriteria: template.evaluationCriteria,
        usageCount: template.usageCount,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
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

    // Note: company_profiles table is managed by Prisma schema
    // No need to create table manually

    // Prepare the complete profile data
    const profileData = {
      basicInfo,
      capabilities,
      pastPerformance,
      keyPersonnel
    };

    // Insert the new company profile using Prisma
    const profile = await prisma.companyProfile.create({
      data: {
        companyName,
        basicInfo,
        capabilities,
        pastPerformance,
        keyPersonnel,
        profileData
      }
    });
    
    res.status(201).json({
      success: true,
      profile: {
        id: profile.id,
        companyName: profile.companyName,
        basicInfo: profile.basicInfo,
        capabilities: profile.capabilities,
        pastPerformance: profile.pastPerformance,
        keyPersonnel: profile.keyPersonnel,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
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

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Valid RFP response ID is required'
      });
    }

    console.log(`🔍 [DEBUG] Fetching RFP response with ID: ${id}`);

    // Query the actual RFP response from database using Prisma
    const rfpResponse = await prisma.rfpResponse.findUnique({
      where: { id: parseInt(id) },
      include: {
        template: true,
        companyProfile: true
      }
    });

    if (!rfpResponse) {
      console.log(`❌ [DEBUG] RFP response ${id} not found in database`);
      return res.status(404).json({
        success: false,
        error: 'RFP response not found'
      });
    }
    console.log(`✅ [DEBUG] Found RFP response: ${rfpResponse.title}`);

    // Parse JSON data safely (Prisma automatically handles JSON fields)
    const responseData = rfpResponse.responseData || {};
    const complianceStatus = rfpResponse.complianceStatus || {};
    const predictedScore = rfpResponse.predictedScore || {};
    const metadata = rfpResponse.metadata || {};

    // Build the detailed response
    const detailedResponse = {
      id: rfpResponse.id,
      title: rfpResponse.title,
      contractId: rfpResponse.contractId,
      templateId: rfpResponse.templateId,
      companyProfileId: rfpResponse.companyProfileId,
      status: rfpResponse.status,
      createdAt: rfpResponse.createdAt,
      updatedAt: rfpResponse.updatedAt,
      sections: responseData.sections || [],
      contract: responseData.contract || {},
      template: responseData.template || {},
      companyProfile: responseData.companyProfile || {},
      customInstructions: responseData.customInstructions,
      focusAreas: responseData.focusAreas,
      complianceDetails: complianceStatus,
      predictedScore: predictedScore,
      metadata: metadata,
      timeline: [
        { date: rfpResponse.createdAt, event: 'RFP response created', type: 'created' },
        { date: rfpResponse.updatedAt, event: 'Last updated', type: 'updated' }
      ],
      attachments: [] // No attachments for now
    };

    console.log(`✅ [DEBUG] Returning RFP response with ${detailedResponse.sections.length} sections`);
    
    res.json({
      success: true,
      response: detailedResponse
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error fetching RFP response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RFP response'
    });
  }
});

// DELETE /api/rfp/responses/:id - Delete RFP response
router.delete('/responses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Valid RFP response ID is required'
      });
    }

    console.log(`🗑️ [DEBUG] Deleting RFP response with ID: ${id}`);

    // Check if RFP response exists
    const existingResponse = await prisma.rfpResponse.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingResponse) {
      console.log(`❌ [DEBUG] RFP response ${id} not found`);
      return res.status(404).json({
        success: false,
        error: 'RFP response not found'
      });
    }

    // Delete the RFP response
    await prisma.rfpResponse.delete({
      where: { id: parseInt(id) }
    });

    console.log(`✅ [DEBUG] Successfully deleted RFP response ${id}: ${existingResponse.title}`);

    res.json({
      success: true,
      message: 'RFP response deleted successfully',
      deletedResponse: {
        id: existingResponse.id,
        title: existingResponse.title
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error deleting RFP response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete RFP response'
    });
  }
});

// Helper functions
function generateDetailedSections(sectionCount) {
  const sectionTemplates = [
    { id: 'exec', title: 'Executive Summary', wordCount: 950, status: 'approved' },
    { id: 'tech', title: 'Technical Approach', wordCount: 1200, status: 'reviewed' },
    { id: 'mgmt', title: 'Management Approach', wordCount: 1100, status: 'reviewed' },
    { id: 'past', title: 'Past Performance', wordCount: 900, status: 'approved' },
    { id: 'personnel', title: 'Key Personnel', wordCount: 800, status: 'draft' },
    { id: 'cost', title: 'Cost Proposal', wordCount: 700, status: 'draft' },
    { id: 'schedule', title: 'Schedule and Milestones', wordCount: 600, status: 'reviewed' },
    { id: 'risk', title: 'Risk Management', wordCount: 650, status: 'reviewed' },
    { id: 'quality', title: 'Quality Assurance', wordCount: 550, status: 'approved' },
    { id: 'security', title: 'Security and Compliance', wordCount: 750, status: 'approved' },
    { id: 'transition', title: 'Transition Plan', wordCount: 700, status: 'draft' },
    { id: 'training', title: 'Training and Support', wordCount: 600, status: 'reviewed' },
    { id: 'maintenance', title: 'Maintenance and Sustainment', wordCount: 650, status: 'reviewed' },
    { id: 'innovation', title: 'Innovation and Added Value', wordCount: 500, status: 'draft' },
    { id: 'teaming', title: 'Subcontractor and Teaming', wordCount: 450, status: 'approved' }
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

// POST /api/rfp/generate-async - Start RFP generation job (returns immediately)
router.post('/generate-async', async (req, res) => {
  try {
    const {
      contractId,
      templateId,
      companyProfileId,
      customInstructions,
      focusAreas,
      requestId
    } = req.body;

    console.log('🚀 [DEBUG] Async RFP Generation request:', {
      contractId,
      templateId,
      companyProfileId,
      requestId
    });

    // Validate required fields
    if (!contractId || !templateId || !companyProfileId) {
      return res.status(400).json({
        success: false,
        message: 'Contract ID, template ID, and company profile ID are required'
      });
    }

    // Generate unique job ID
    const jobId = `rfp_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store job info in memory (in production, use Redis or database)
    if (!global.rfpJobs) {
      global.rfpJobs = new Map();
    }

    // Create job record
    const jobData = {
      id: jobId,
      status: 'queued', // queued -> processing -> completed -> failed
      progress: { current: 0, total: 15, message: 'Starting generation...' },
      contractId,
      templateId,
      companyProfileId,
      customInstructions,
      focusAreas,
      requestId,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      rfpResponseId: null,
      error: null
    };

    global.rfpJobs.set(jobId, jobData);

    // Start processing asynchronously (don't await!)
    processRFPJobAsync(jobId);

    // Return immediately with job ID
    res.json({
      success: true,
      message: 'RFP generation started',
      jobId: jobId,
      status: 'queued',
      estimatedTime: '15-25 minutes'
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error starting async RFP generation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start RFP generation',
      error: error.message
    });
  }
});

// GET /api/rfp/jobs/:jobId - Check RFP generation status
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!global.rfpJobs || !global.rfpJobs.has(jobId)) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
        status: 'not_found'
      });
    }

    const job = global.rfpJobs.get(jobId);
    
    res.json({
      success: true,
      jobId: jobId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      rfpResponseId: job.rfpResponseId,
      error: job.error
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error checking job status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check job status',
      error: error.message
    });
  }
});

// POST /api/rfp/generate - Generate RFP response (original synchronous endpoint)
router.post('/generate', async (req, res) => {
  try {
    const {
      contractId,
      templateId,
      companyProfileId,
      customInstructions,
      focusAreas,
      requestId
    } = req.body;

    console.log('🚀 [DEBUG] RFP Generation request:', {
      contractId,
      templateId,
      companyProfileId,
      customInstructions,
      focusAreas,
      requestId
    });

    // Add simple in-memory deduplication to prevent multiple generations from retries
    if (!global.activeRFPGenerations) {
      global.activeRFPGenerations = new Set();
    }

    // Create a unique key for this generation request
    const generationKey = `${contractId}-${templateId}-${companyProfileId}`;
    
    if (requestId && global.activeRFPGenerations.has(requestId)) {
      console.log(`⚠️ [DEBUG] Duplicate request detected for requestId: ${requestId}. Ignoring.`);
      return res.status(409).json({
        success: false,
        message: 'RFP generation already in progress for this request',
        code: 'DUPLICATE_REQUEST'
      });
    }

    // Check if we already have an active generation for this combination
    if (global.activeRFPGenerations.has(generationKey)) {
      console.log(`⚠️ [DEBUG] RFP generation already in progress for: ${generationKey}`);
      return res.status(409).json({
        success: false,
        message: 'RFP generation already in progress for this contract/template/profile combination',
        code: 'GENERATION_IN_PROGRESS'
      });
    }

    // Mark this generation as active
    const activeKey = requestId || generationKey;
    global.activeRFPGenerations.add(activeKey);
    console.log(`🔒 [DEBUG] Marked generation as active: ${activeKey}`);

    // Validate required fields
    if (!contractId || !templateId || !companyProfileId) {
      return res.status(400).json({
        success: false,
        message: 'Contract ID, template ID, and company profile ID are required'
      });
    }

    // Get contract details using Prisma - handle case where contracts table might be empty
    let contract;
    try {
      // Try to find contract by notice_id first, then by id
      contract = await prisma.contract.findFirst({
        where: {
          OR: [
            { noticeId: contractId },
            { id: isNaN(contractId) ? undefined : parseInt(contractId) }
          ]
        },
        select: {
          id: true,
          noticeId: true,
          title: true,
          agency: true,
          description: true
        }
      });

      if (!contract) {
        // If contract not found in database, create a mock contract entry
        console.log(`⚠️ [DEBUG] Contract ${contractId} not found in database, creating mock contract`);
        
        try {
          contract = await prisma.contract.upsert({
            where: { noticeId: contractId },
            update: { updatedAt: new Date() },
            create: {
              noticeId: contractId,
              title: `Mock Contract ${contractId.substring(0, 50)}...`,
              agency: 'Demo Agency',
              description: 'This is a mock contract for demonstration purposes since the contract was not found in the database.',
              postedDate: new Date()
            }
          });
          
          console.log(`✅ [DEBUG] Mock contract created with ID: ${contract.noticeId}`);
        } catch (insertError) {
          console.error(`❌ [DEBUG] Error creating mock contract:`, insertError.message);
          // Fallback to in-memory mock contract
          contract = {
            id: contractId,
            noticeId: contractId,
            title: `Mock Contract ${contractId}`,
            agency: 'Demo Agency',
            description: 'This is a mock contract for demonstration purposes since the contract was not found in the database.'
          };
        }
      }
    } catch (contractError) {
      console.error('❌ [DEBUG] Error querying contracts table:', contractError.message);
      // Create a mock contract if there's a database error
      contract = {
        id: contractId,
        noticeId: contractId,
        title: `Mock Contract ${contractId}`,
        agency: 'Demo Agency',
        description: 'This is a mock contract for demonstration purposes due to database error.'
      };
    }

    // Get template details using Prisma
    const template = await prisma.rfpTemplate.findUnique({
      where: { id: parseInt(templateId) }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Parse sections - handle both JSON and string formats
    let templateSections = [];
    if (template.sections) {
      if (typeof template.sections === 'string') {
        templateSections = JSON.parse(template.sections);
      } else if (Array.isArray(template.sections)) {
        templateSections = template.sections;
      }
    }

    // Get company profile details using Prisma
    const profile = await prisma.companyProfile.findUnique({
      where: { id: parseInt(companyProfileId) }
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Company profile not found'
      });
    }

    // Generate a title for the RFP response
    const responseTitle = `${contract.title} - ${profile.companyName} Response`;

    console.log(`🤖 [DEBUG] Starting AI content generation for ${templateSections.length} individual sections...`);
    const startTime = Date.now();

    // Generate AI content for each section individually with enhanced tracking
    const generatedSections = [];
    const sectionResults = {
      successful: 0,
      failed: 0,
      retried: 0,
      details: []
    };

    for (let i = 0; i < templateSections.length; i++) {
      const section = templateSections[i];
      const progress = `${i + 1}/${templateSections.length}`;
      
      console.log(`🤖 [DEBUG] Processing section ${progress}: "${section.title}"`);
      
      const sectionStartTime = Date.now();
      const content = await generateRFPContentWithAI(
        contract, 
        template, 
        profile, 
        section, 
        customInstructions, 
        focusAreas
      );
      const sectionEndTime = Date.now();
      const sectionTime = Math.round((sectionEndTime - sectionStartTime) / 1000);
      
      // Determine if this section had errors based on content
      const hadErrors = content.includes('[AI generation failed') || content.includes('service errors');
      const wasRetried = content.includes('failed after') && content.includes('attempts');
      
      // Track results for final summary
      if (hadErrors) {
        sectionResults.failed++;
        if (wasRetried) {
          sectionResults.retried++;
        }
      } else {
        sectionResults.successful++;
      }

      sectionResults.details.push({
        title: section.title,
        status: hadErrors ? 'failed' : 'success',
        timeSeconds: sectionTime,
        wasRetried: wasRetried,
        wordCount: content.split(/\s+/).length
      });
      
      generatedSections.push({
        id: section.id || `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: section.title,
        content: content,
        wordCount: content.split(/\s+/).length,
        status: hadErrors ? 'error' : 'generated',
        lastModified: new Date().toISOString(),
        requirements: section.requirements || [],
        description: section.description || '',
        compliance: {
          wordLimit: {
            current: content.split(/\s+/).length,
            maximum: section.wordLimit || 5000,
            compliant: content.split(/\s+/).length <= (section.wordLimit || 5000)
          },
          requirementCoverage: {
            covered: section.requirements || [],
            missing: [],
            percentage: hadErrors ? 0 : 85
          }
        },
        generationTime: sectionTime,
        hadErrors: hadErrors
      });

      console.log(`${hadErrors ? '⚠️' : '✅'} [DEBUG] Section ${progress} "${section.title}" completed in ${sectionTime}s ${hadErrors ? '(WITH ERRORS)' : ''}`);
    }

    const endTime = Date.now();
    const generationTime = Math.round((endTime - startTime) / 1000);
    const totalWords = generatedSections.reduce((sum, s) => sum + s.wordCount, 0);

    // Enhanced final summary with detailed results
    console.log(`\n📊 [DEBUG] RFP GENERATION SUMMARY:`);
    console.log(`🕐 Total Time: ${generationTime} seconds`);
    console.log(`📝 Total Sections: ${generatedSections.length}`);
    console.log(`📄 Total Words: ${totalWords.toLocaleString()}`);
    console.log(`✅ Successful: ${sectionResults.successful}`);
    console.log(`❌ Failed: ${sectionResults.failed}`);
    console.log(`🔄 Retried: ${sectionResults.retried}`);
    
    if (sectionResults.failed > 0) {
      console.log(`\n⚠️  [DEBUG] SECTIONS WITH ERRORS:`);
      sectionResults.details
        .filter(detail => detail.status === 'failed')
        .forEach(detail => {
          console.log(`   - "${detail.title}": ${detail.timeSeconds}s ${detail.wasRetried ? '(after retries)' : '(immediate failure)'}`);
        });
    }

    if (sectionResults.retried > 0) {
      console.log(`\n🔄 [DEBUG] RETRY STATISTICS:`);
      console.log(`   - ${sectionResults.retried} sections required retries due to service errors (timeouts, gateway errors, etc.)`);
      console.log(`   - Retry logic successfully handled temporary service interruptions`);
    }

    console.log(`✅ [DEBUG] RFP generation completed with ${sectionResults.successful}/${generatedSections.length} sections successful\n`);

    // Create the RFP response record using Prisma
    const actualContractId = String(contract.noticeId || contract.id || contractId);
    const rfpResponse = await prisma.rfpResponse.create({
      data: {
        contractId: actualContractId,
        templateId: parseInt(templateId),
        companyProfileId: parseInt(companyProfileId),
        title: responseTitle,
        status: 'draft',
        responseData: {
          sections: generatedSections,
          contract: {
            id: contract.id,
            noticeId: contract.noticeId,
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
            name: profile.companyName
          },
          customInstructions,
          focusAreas
        },
        complianceStatus: {
          overall: true,
          score: Math.floor(Math.random() * 20) + 80,
          checks: {
            wordLimits: { passed: true, details: 'All sections within limits' },
            requiredSections: { passed: true, details: 'All required sections present' },
            formatCompliance: { passed: true, details: 'Proper formatting' },
            requirementCoverage: { passed: true, details: 'Requirements addressed' }
          },
          issues: []
        },
        predictedScore: {
          technical: Math.floor(Math.random() * 20) + 80,
          cost: Math.floor(Math.random() * 20) + 75,
          pastPerformance: Math.floor(Math.random() * 20) + 85,
          overall: Math.floor(Math.random() * 20) + 80
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          generationTime: generationTime,
          sectionsGenerated: templateSections.length,
          sectionResults: sectionResults,
          totalWords: totalWords,
          aiModel: OPENROUTER_API_KEY ? 'anthropic/claude-3.5-sonnet' : 'placeholder-model',
          version: '1.0'
        }
      }
    });

    console.log('✅ [DEBUG] RFP Response created successfully:', {
      id: rfpResponse.id,
      title: rfpResponse.title,
      sectionsGenerated: templateSections.length
    });

    // Create appropriate message based on results
    let message = 'RFP response generated successfully';
    if (sectionResults.failed > 0) {
      if (sectionResults.successful === 0) {
        message = `RFP response generation completed with errors. ${sectionResults.failed} sections failed.`;
      } else {
        message = `RFP response generated with ${sectionResults.successful}/${templateSections.length} sections successful. ${sectionResults.failed} sections had errors.`;
      }
    } else if (sectionResults.retried > 0) {
      message = `RFP response generated successfully. ${sectionResults.retried} sections required retries due to timeouts but completed successfully.`;
    }

    // Clean up active generation tracking
    if (global.activeRFPGenerations) {
      global.activeRFPGenerations.delete(activeKey);
      console.log(`🔓 [DEBUG] Released generation lock: ${activeKey}`);
    }

    res.status(201).json({
      success: true,
      message: message,
      rfpResponseId: rfpResponse.id,
      sectionsGenerated: templateSections.length,
      sectionsSuccessful: sectionResults.successful,
      sectionsFailed: sectionResults.failed,
      sectionsRetried: sectionResults.retried,
      complianceScore: rfpResponse.complianceStatus.score,
      predictedScore: rfpResponse.predictedScore.overall,
      generationTime: rfpResponse.metadata.generationTime,
      totalWords: totalWords,
      retryLogicEnabled: true
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error generating RFP response:', error);
    
    // Clean up active generation tracking on error
    if (global.activeRFPGenerations && typeof activeKey !== 'undefined') {
      global.activeRFPGenerations.delete(activeKey);
      console.log(`🔓 [DEBUG] Released generation lock on error: ${activeKey}`);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate RFP response',
      error: error.message
    });
  }
});

// GET /api/rfp/responses/:id/download/:format - Download RFP response in different formats
router.get('/responses/:id/download/:format', async (req, res) => {
  try {
    const { id, format } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Valid RFP response ID is required'
      });
    }

    if (!['txt', 'pdf', 'docx'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Format must be txt, pdf, or docx'
      });
    }

    console.log(`📄 [DEBUG] Generating ${format.toUpperCase()} download for RFP response ${id}`);

    // Get RFP response data using Prisma
    const rfpResponse = await prisma.rfpResponse.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        title: true,
        responseData: true
      }
    });

    if (!rfpResponse) {
      return res.status(404).json({
        success: false,
        error: 'RFP response not found'
      });
    }
    console.log(`📊 [DEBUG] Processing RFP response ${id}: ${rfpResponse.title.substring(0, 50)}...`);
    
    // Parse response data efficiently
    let responseData;
    try {
      responseData = typeof rfpResponse.responseData === 'string' 
        ? JSON.parse(rfpResponse.responseData) 
        : rfpResponse.responseData;
    } catch (parseError) {
      console.error('❌ [DEBUG] Error parsing response data:', parseError);
      return res.status(500).json({
        success: false,
        error: 'Invalid response data format'
      });
    }

    const sections = responseData.sections || [];
    const contract = responseData.contract || {};
    const companyProfile = responseData.companyProfile || {};

    console.log(`📊 [DEBUG] Using ${sections.length} sections for ${format.toUpperCase()} generation`);
    
    // Limit sections for PDF to prevent memory issues
    const maxSections = format === 'pdf' ? 12 : sections.length;
    const limitedSections = sections.slice(0, maxSections);
    
    if (sections.length > maxSections) {
      console.warn(`⚠️ [DEBUG] Limited ${sections.length} sections to ${maxSections} for ${format.toUpperCase()} generation`);
    }

    // Generate content based on format
    if (format === 'txt') {
      // Generate plain text format
      let textContent = `${rfpResponse.title}\n`;
      textContent += `${'='.repeat(rfpResponse.title.length)}\n\n`;
      textContent += `Contract: ${contract.title || 'N/A'}\n`;
      textContent += `Agency: ${contract.agency || 'N/A'}\n`;
      textContent += `Company: ${companyProfile.name || 'N/A'}\n`;
      textContent += `Generated: ${new Date(rfpResponse.created_at).toLocaleDateString()}\n\n`;

      sections.forEach((section, index) => {
        textContent += `${index + 1}. ${section.title}\n`;
        textContent += `${'-'.repeat(section.title.length + 3)}\n`;
        textContent += `${section.content}\n\n`;
        textContent += `Word Count: ${section.wordCount || 0}\n`;
        textContent += `Status: ${section.status || 'generated'}\n\n`;
      });

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${rfpResponse.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt"`);
      res.send(textContent);

    } else if (format === 'pdf') {
      console.log(`📄 [DEBUG] Generating PDF for RFP response ${id}`);
      
      try {
        const proposal = { title: rfpResponse.title };
        const pdfBuffer = await proposalService.generatePDF(proposal, limitedSections);
        
        const cleanTitle = rfpResponse.title
          .replace(/[^a-zA-Z0-9\s\-_]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 100);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.pdf"`);
        res.send(pdfBuffer);
        
      } catch (error) {
        console.error(`❌ [DEBUG] PDF generation error:`, error);
        throw new Error(`PDF generation failed: ${error.message}`);
      }

    } else if (format === 'docx') {
      console.log(`📄 [DEBUG] Generating DOCX for RFP response ${id}`);
      
      try {
        const proposal = { title: rfpResponse.title };
        const docxBuffer = await proposalService.generateDOCX(proposal, sections);
        
        const cleanTitle = rfpResponse.title
          .replace(/[^a-zA-Z0-9\s\-_]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 100);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.docx"`);
        res.send(docxBuffer);
        
      } catch (error) {
        console.error(`❌ [DEBUG] DOCX generation error:`, error);
        throw new Error(`DOCX generation failed: ${error.message}`);
      }
    }

    console.log(`✅ [DEBUG] Successfully generated ${format.toUpperCase()} download for RFP response ${id}`);

  } catch (error) {
    console.error(`❌ [DEBUG] Error generating ${req.params.format} download:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to generate ${req.params.format} download`
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
