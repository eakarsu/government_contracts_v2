const express = require('express');
const router = express.Router();

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Helper function to call OpenRouter AI
async function callOpenRouterAI(systemPrompt, userPrompt, maxTokens = 2000) {
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'ContractAI'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Try to parse JSON from the response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch {
      return { rawResponse: content };
    }
  } catch (error) {
    console.error('OpenRouter AI error:', error);
    throw error;
  }
}

// POST /api/ai-center/summarize - Contract Summarizer
router.post('/summarize', async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({ success: false, error: 'Contract is required' });
    }

    console.log(`[AI Summarize] Processing contract: ${contract.noticeId}`);

    const systemPrompt = `You are a government contract analyst. Analyze contracts and provide clear, concise summaries.
Always respond with valid JSON in this exact format:
{
  "summary": "2-3 sentence executive summary",
  "keyRequirements": ["requirement 1", "requirement 2", "requirement 3"],
  "eligibility": ["eligibility criteria 1", "criteria 2"],
  "dates": [{"label": "Response Deadline", "value": "date"}, {"label": "Period of Performance", "value": "date range"}],
  "estimatedValue": "dollar amount or 'Not specified'",
  "complexity": "Low/Medium/High"
}`;

    const userPrompt = `Summarize this government contract:
Title: ${contract.title}
Agency: ${contract.agency}
NAICS: ${contract.naicsCode || 'Not specified'}
Posted: ${contract.postedDate || 'Not specified'}
Deadline: ${contract.responseDeadline || 'Not specified'}
Description: ${contract.description || 'No description available'}

Provide a comprehensive summary with key requirements, eligibility criteria, and important dates.`;

    const aiResponse = await callOpenRouterAI(systemPrompt, userPrompt);

    res.json({
      success: true,
      data: {
        summary: aiResponse.summary || 'This contract opportunity requires careful review of the full solicitation.',
        keyRequirements: aiResponse.keyRequirements || ['Review full solicitation', 'Check eligibility requirements', 'Prepare technical approach'],
        eligibility: aiResponse.eligibility || ['Verify business size standards', 'Check set-aside requirements'],
        dates: aiResponse.dates || [
          { label: 'Posted Date', value: contract.postedDate || 'See solicitation' },
          { label: 'Response Deadline', value: contract.responseDeadline || 'See solicitation' }
        ],
        estimatedValue: aiResponse.estimatedValue || 'Not specified',
        complexity: aiResponse.complexity || 'Medium'
      }
    });
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({ success: false, error: 'Failed to summarize contract' });
  }
});

// POST /api/ai-center/compliance - Compliance Checker
router.post('/compliance', async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({ success: false, error: 'Contract is required' });
    }

    console.log(`[AI Compliance] Checking contract: ${contract.noticeId}`);

    const systemPrompt = `You are a government contract compliance expert. Analyze contracts and check compliance requirements.
Always respond with valid JSON in this exact format:
{
  "overallScore": 75,
  "overallStatus": "Partially Compliant",
  "checks": [
    {"requirement": "Business Size", "passed": true, "details": "explanation"},
    {"requirement": "NAICS Code Match", "passed": true, "details": "explanation"},
    {"requirement": "Past Performance", "passed": false, "details": "explanation"}
  ],
  "gaps": ["gap 1 to address", "gap 2 to address"]
}`;

    const userPrompt = `Check compliance requirements for this contract:
Title: ${contract.title}
Agency: ${contract.agency}
NAICS: ${contract.naicsCode || 'Not specified'}
Description: ${contract.description || 'No description'}

Analyze typical compliance requirements for this type of contract and identify potential gaps.`;

    const aiResponse = await callOpenRouterAI(systemPrompt, userPrompt);

    res.json({
      success: true,
      data: {
        overallScore: aiResponse.overallScore || 70,
        overallStatus: aiResponse.overallStatus || 'Review Required',
        checks: aiResponse.checks || [
          { requirement: 'Business Registration', passed: true, details: 'SAM.gov registration required' },
          { requirement: 'NAICS Code Eligibility', passed: true, details: `NAICS ${contract.naicsCode || 'code'} alignment needed` },
          { requirement: 'Past Performance', passed: false, details: 'Relevant past performance documentation needed' },
          { requirement: 'Technical Capability', passed: true, details: 'Technical approach must address requirements' }
        ],
        gaps: aiResponse.gaps || ['Verify specific certifications required', 'Confirm set-aside eligibility']
      }
    });
  } catch (error) {
    console.error('Compliance error:', error);
    res.status(500).json({ success: false, error: 'Failed to check compliance' });
  }
});

// POST /api/ai-center/risk - Risk Assessment
router.post('/risk', async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({ success: false, error: 'Contract is required' });
    }

    console.log(`[AI Risk] Assessing contract: ${contract.noticeId}`);

    const systemPrompt = `You are a government contract risk analyst. Analyze contracts and identify risks.
Always respond with valid JSON in this exact format:
{
  "overallRisk": "Low/Medium/High",
  "riskScore": 45,
  "risks": [
    {"category": "Schedule", "level": "Medium", "description": "risk description", "mitigation": "how to mitigate"},
    {"category": "Technical", "level": "Low", "description": "risk description", "mitigation": "how to mitigate"}
  ]
}`;

    const userPrompt = `Assess risks for this government contract:
Title: ${contract.title}
Agency: ${contract.agency}
NAICS: ${contract.naicsCode || 'Not specified'}
Value: ${contract.contractValue || 'Not specified'}
Deadline: ${contract.responseDeadline || 'Not specified'}
Description: ${contract.description || 'No description'}

Identify schedule, technical, financial, and competitive risks with mitigation strategies.`;

    const aiResponse = await callOpenRouterAI(systemPrompt, userPrompt);

    res.json({
      success: true,
      data: {
        overallRisk: aiResponse.overallRisk || 'Medium',
        riskScore: aiResponse.riskScore || 50,
        risks: aiResponse.risks || [
          { category: 'Competition', level: 'Medium', description: 'Multiple competitors expected for this opportunity', mitigation: 'Develop strong discriminators and competitive pricing' },
          { category: 'Schedule', level: 'Low', description: 'Timeline appears manageable', mitigation: 'Plan proposal development schedule early' },
          { category: 'Technical', level: 'Medium', description: 'Requirements may need clarification', mitigation: 'Submit questions during Q&A period' },
          { category: 'Financial', level: 'Low', description: 'Standard payment terms expected', mitigation: 'Ensure adequate cash flow for performance period' }
        ]
      }
    });
  } catch (error) {
    console.error('Risk error:', error);
    res.status(500).json({ success: false, error: 'Failed to assess risks' });
  }
});

// POST /api/ai-center/pricing - Price Estimator
router.post('/pricing', async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({ success: false, error: 'Contract is required' });
    }

    console.log(`[AI Pricing] Estimating for contract: ${contract.noticeId}`);

    const systemPrompt = `You are a government contract pricing expert. Analyze contracts and provide pricing estimates.
Always respond with valid JSON in this exact format:
{
  "lowEstimate": 100000,
  "recommendedPrice": 150000,
  "highEstimate": 200000,
  "rationale": "Explanation of pricing strategy",
  "competitionLevel": "Low/Medium/High",
  "marketRate": "description of market rates"
}`;

    const userPrompt = `Estimate pricing for this government contract:
Title: ${contract.title}
Agency: ${contract.agency}
NAICS: ${contract.naicsCode || 'Not specified'}
Stated Value: ${contract.contractValue || 'Not specified'}
Description: ${contract.description || 'No description'}

Provide realistic price estimates based on the scope and market conditions.`;

    const aiResponse = await callOpenRouterAI(systemPrompt, userPrompt);

    // Calculate estimates if contract value is available
    const baseValue = contract.contractValue || 500000;
    const lowEst = aiResponse.lowEstimate || Math.round(baseValue * 0.85);
    const highEst = aiResponse.highEstimate || Math.round(baseValue * 1.15);
    const recommended = aiResponse.recommendedPrice || Math.round(baseValue * 0.95);

    res.json({
      success: true,
      data: {
        lowEstimate: lowEst,
        recommendedPrice: recommended,
        highEstimate: highEst,
        rationale: aiResponse.rationale || 'Pricing based on contract scope, market analysis, and competitive positioning. Consider your cost structure and desired margin.',
        competitionLevel: aiResponse.competitionLevel || 'Medium',
        marketRate: aiResponse.marketRate || 'Aligned with current GSA schedule rates for similar services'
      }
    });
  } catch (error) {
    console.error('Pricing error:', error);
    res.status(500).json({ success: false, error: 'Failed to estimate price' });
  }
});

// POST /api/ai-center/chat - Chat with Contract
router.post('/chat', async (req, res) => {
  try {
    const { contract, message, history } = req.body;

    if (!contract || !message) {
      return res.status(400).json({ success: false, error: 'Contract and message are required' });
    }

    console.log(`[AI Chat] Question about contract: ${contract.noticeId}`);

    const systemPrompt = `You are a helpful government contracting assistant. Answer questions about the contract based on the information provided.
Be concise but thorough. If information is not available, say so clearly.
Contract Details:
- Title: ${contract.title}
- Agency: ${contract.agency}
- NAICS: ${contract.naicsCode || 'Not specified'}
- Posted: ${contract.postedDate || 'Not specified'}
- Deadline: ${contract.responseDeadline || 'Not specified'}
- Description: ${contract.description || 'No description available'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-6), // Keep last 6 messages for context
      { role: 'user', content: message }
    ];

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'ContractAI'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    res.json({
      success: true,
      data: {
        response: aiResponse || 'I apologize, but I could not generate a response. Please try again.'
      }
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: 'Failed to process chat message' });
  }
});

// POST /api/ai-center/strategy - Capture Strategy Generator
router.post('/strategy', async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({ success: false, error: 'Contract is required' });
    }

    console.log(`[AI Strategy] Generating for contract: ${contract.noticeId}`);

    const systemPrompt = `You are a capture management expert. Develop winning strategies for government contracts.
Always respond with valid JSON in this exact format:
{
  "winTheme": "One compelling win theme statement",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "differentiators": ["differentiator 1", "differentiator 2"],
  "actionPlan": [
    {"step": "Action step 1", "timeline": "Week 1"},
    {"step": "Action step 2", "timeline": "Week 2"}
  ]
}`;

    const userPrompt = `Develop a capture strategy for this government contract:
Title: ${contract.title}
Agency: ${contract.agency}
NAICS: ${contract.naicsCode || 'Not specified'}
Value: ${contract.contractValue || 'Not specified'}
Description: ${contract.description || 'No description'}

Create a comprehensive capture strategy with win themes, differentiators, and action plan.`;

    const aiResponse = await callOpenRouterAI(systemPrompt, userPrompt);

    res.json({
      success: true,
      data: {
        winTheme: aiResponse.winTheme || 'Deliver mission-critical solutions with proven expertise, innovative approaches, and exceptional value.',
        strengths: aiResponse.strengths || [
          'Deep domain expertise in the required area',
          'Proven track record with similar contracts',
          'Strong technical team and methodology'
        ],
        differentiators: aiResponse.differentiators || [
          'Innovative technical approach',
          'Cost-effective solution delivery',
          'Superior past performance'
        ],
        actionPlan: aiResponse.actionPlan || [
          { step: 'Review full solicitation and develop compliance matrix', timeline: 'Week 1' },
          { step: 'Identify key personnel and teaming partners', timeline: 'Week 1-2' },
          { step: 'Develop technical approach and solution architecture', timeline: 'Week 2-3' },
          { step: 'Prepare pricing strategy and cost volume', timeline: 'Week 3-4' },
          { step: 'Write and review proposal sections', timeline: 'Week 4-5' },
          { step: 'Final review, production, and submission', timeline: 'Week 5-6' }
        ]
      }
    });
  } catch (error) {
    console.error('Strategy error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate strategy' });
  }
});

// POST /api/ai-center/teaming - Teaming Partner Suggestions
router.post('/teaming', async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({ success: false, error: 'Contract is required' });
    }

    console.log(`[AI Teaming] Finding partners for contract: ${contract.noticeId}`);

    const systemPrompt = `You are a government contracting teaming expert. Identify capability gaps and suggest partner types.
Always respond with valid JSON in this exact format:
{
  "capabilityGaps": ["gap 1", "gap 2"],
  "partners": [
    {
      "type": "Partner type/category",
      "matchScore": 85,
      "reason": "Why this partner type is needed",
      "capabilities": ["capability 1", "capability 2"]
    }
  ]
}`;

    const userPrompt = `Identify teaming needs for this government contract:
Title: ${contract.title}
Agency: ${contract.agency}
NAICS: ${contract.naicsCode || 'Not specified'}
Description: ${contract.description || 'No description'}

Analyze capability gaps and suggest types of teaming partners that would strengthen a bid.`;

    const aiResponse = await callOpenRouterAI(systemPrompt, userPrompt);

    res.json({
      success: true,
      data: {
        capabilityGaps: aiResponse.capabilityGaps || [
          'Specialized technical expertise',
          'Past performance in specific area',
          'Security clearances'
        ],
        partners: aiResponse.partners || [
          {
            type: 'Technical Subcontractor',
            matchScore: 90,
            reason: 'Provides specialized technical capabilities and domain expertise',
            capabilities: ['Technical expertise', 'Cleared personnel', 'Relevant experience']
          },
          {
            type: 'Small Business Partner',
            matchScore: 85,
            reason: 'Meets small business subcontracting requirements and adds diverse perspective',
            capabilities: ['Small business certification', 'Specialized skills', 'Competitive pricing']
          },
          {
            type: 'Past Performance Partner',
            matchScore: 80,
            reason: 'Brings relevant past performance to strengthen proposal',
            capabilities: ['Agency relationships', 'Proven delivery', 'Domain knowledge']
          }
        ]
      }
    });
  } catch (error) {
    console.error('Teaming error:', error);
    res.status(500).json({ success: false, error: 'Failed to find partners' });
  }
});

// POST /api/ai-center/tags - Auto-Tagging
router.post('/tags', async (req, res) => {
  try {
    const { contract } = req.body;

    if (!contract) {
      return res.status(400).json({ success: false, error: 'Contract is required' });
    }

    console.log(`[AI Tags] Generating tags for contract: ${contract.noticeId}`);

    const systemPrompt = `You are a government contract classification expert. Analyze and tag contracts.
Always respond with valid JSON in this exact format:
{
  "industry": ["tag1", "tag2"],
  "contractType": ["tag1", "tag2"],
  "skills": ["skill1", "skill2", "skill3"],
  "complexity": "Low/Medium/High",
  "fitScore": 75
}`;

    const userPrompt = `Classify and tag this government contract:
Title: ${contract.title}
Agency: ${contract.agency}
NAICS: ${contract.naicsCode || 'Not specified'}
Description: ${contract.description || 'No description'}

Generate relevant tags for industry, contract type, required skills, complexity level, and fit score.`;

    const aiResponse = await callOpenRouterAI(systemPrompt, userPrompt);

    res.json({
      success: true,
      data: {
        industry: aiResponse.industry || ['Government', 'Federal', contract.agency?.split('.')[0] || 'Public Sector'],
        contractType: aiResponse.contractType || ['Services', 'Professional Services'],
        skills: aiResponse.skills || ['Project Management', 'Technical Writing', 'Compliance', 'Analysis'],
        complexity: aiResponse.complexity || 'Medium',
        fitScore: aiResponse.fitScore || 70
      }
    });
  } catch (error) {
    console.error('Tags error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate tags' });
  }
});

module.exports = router;
