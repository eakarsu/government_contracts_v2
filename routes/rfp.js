const express = require('express');
const officegen = require('officegen');
const PDFDocument = require('pdfkit');
const { prisma } = require('../config/database');
const config = require('../config/env');
const rfpService = require('../services/rfpService');

const router = express.Router();

const STANDARD_TEMPLATE_NAME = 'Standard Government Proposal Application';
const STANDARD_SECTIONS = [
  ['executive_summary', 'Executive Summary', 'Summarize the proposed solution and value to the agency.', true, 700],
  ['technical_approach', 'Technical Approach', 'Explain the technical methodology and how it addresses the opportunity.', true, 1800],
  ['management_approach', 'Management Approach', 'Describe governance, staffing, communication, and delivery controls.', true, 1200],
  ['past_performance', 'Past Performance', 'Present only verified, relevant company experience.', true, 1000],
  ['key_personnel', 'Key Personnel', 'Identify proposed personnel using verified profile information.', true, 900],
  ['cost_proposal', 'Cost Proposal', 'Provide a review-ready pricing structure without inventing rates.', true, 800],
  ['schedule_milestones', 'Schedule and Milestones', 'Outline phases, milestones, dependencies, and deliverables.', true, 900],
  ['risk_management', 'Risk Management', 'Identify delivery risks and specific mitigations.', false, 800],
  ['quality_assurance', 'Quality Assurance', 'Describe quality controls, measures, and acceptance practices.', false, 800],
  ['security_compliance', 'Security and Compliance', 'Address applicable security and compliance requirements.', false, 1000],
].map(([id, title, description, required, maxWords]) => ({
  id,
  title,
  description,
  required,
  maxWords,
  format: 'narrative',
  mappings: [id]
}));

const STANDARD_EVALUATION_CRITERIA = {
  technicalWeight: 60,
  costWeight: 20,
  pastPerformanceWeight: 20,
  evidenceInstructions: 'Use authoritative solicitation requirements and verified company-profile evidence. Mark unsupported claims REVIEW REQUIRED.',
  factors: []
};

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sectionId(section, index) {
  const candidate = String(section.id || section.title || `section_${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return candidate || `section_${index + 1}`;
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((section, index) => ({
    ...section,
    id: sectionId(section, index),
    title: String(section.title || `Section ${index + 1}`).trim(),
    required: section.required !== false,
    mappings: Array.isArray(section.mappings) ? section.mappings : []
  }));
}

function serializeTemplate(template) {
  return {
    ...template,
    sections: normalizeSections(parseJson(template.sections, [])),
    evaluationCriteria: parseJson(template.evaluationCriteria, STANDARD_EVALUATION_CRITERIA)
  };
}

function serializeCompanyProfile(profile) {
  const data = parseJson(profile.profileData, {});
  return {
    id: profile.id,
    companyName: profile.companyName,
    basicInfo: data.basicInfo || {},
    capabilities: data.capabilities || {},
    businessDetails: data.businessDetails || {},
    pastPerformance: data.pastPerformance || [],
    keyPersonnel: data.keyPersonnel || [],
    additionalSections: data.additionalSections || [],
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function serializeResponse(response) {
  const responseData = parseJson(response.responseData, { sections: [], metadata: {} });
  const complianceStatus = parseJson(response.complianceStatus, {
    overall: false,
    score: 0,
    checks: {},
    issues: []
  });
  return {
    id: response.id,
    contractId: response.contractId,
    templateId: response.templateId,
    companyProfileId: response.companyProfileId,
    title: response.title,
    status: response.status,
    responseData,
    sections: responseData.sections || [],
    complianceStatus,
    predictedScore: responseData.predictedScore || response.predictedScore,
    metadata: responseData.metadata || {},
    createdAt: response.createdAt,
    updatedAt: response.updatedAt
  };
}

function safeDownloadName(title) {
  return String(title || 'proposal-application-draft')
    .normalize('NFKD')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'proposal-application-draft';
}

function cleanExportText(content, sectionTitle = '') {
  const cleaned = String(content || '[No content generated]')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const lines = cleaned.split('\n');
  const normalized = value => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (lines.length > 1 && normalized(lines[0]) === normalized(sectionTitle)) lines.shift();
  return lines.join('\n').trim();
}

function proposalText(response) {
  const serialized = serializeResponse(response);
  const lines = [
    serialized.title,
    `Contract: ${serialized.contractId}`,
    `Status: ${serialized.status}`,
    'REVIEW REQUIRED: This AI-generated draft is not approved for submission.',
    ''
  ];
  for (const section of serialized.sections) {
    lines.push(section.title || section.sectionId || 'Untitled Section');
    lines.push('='.repeat(Math.min(80, String(section.title || 'Section').length)));
    lines.push(cleanExportText(section.content, section.title));
    lines.push('');
  }
  return { serialized, content: lines.join('\n') };
}

function sendPdf(response, databaseResponse) {
  const { serialized } = proposalText(databaseResponse);
  const filename = `${safeDownloadName(serialized.title)}.pdf`;
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const document = new PDFDocument({ size: 'LETTER', margins: { top: 54, right: 54, bottom: 54, left: 54 } });
  document.pipe(response);
  document.fontSize(18).text(serialized.title);
  document.moveDown(0.5).fontSize(10).fillColor('#444444').text(`Contract: ${serialized.contractId}`);
  document.moveDown().fillColor('#9a3412').text('REVIEW REQUIRED: This AI-generated draft is not approved for submission.');
  for (const section of serialized.sections) {
    if (document.y > document.page.height - 150) document.addPage();
    else document.moveDown(1.5);
    document.fillColor('#111827').fontSize(15).text(section.title || section.sectionId || 'Untitled Section');
    document.moveDown(0.5).fontSize(10).text(cleanExportText(section.content, section.title), { lineGap: 3, paragraphGap: 6 });
  }
  document.end();
}

function sendDocx(response, databaseResponse) {
  const { serialized } = proposalText(databaseResponse);
  const filename = `${safeDownloadName(serialized.title)}.docx`;
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const document = officegen('docx');
  document.on('error', error => response.destroy(error));
  let paragraph = document.createP();
  paragraph.addText(serialized.title, { bold: true, font_size: 18 });
  paragraph = document.createP();
  paragraph.addText(`Contract: ${serialized.contractId}`);
  paragraph = document.createP();
  paragraph.addText('REVIEW REQUIRED: This AI-generated draft is not approved for submission.', { bold: true, color: '9A3412' });
  for (const section of serialized.sections) {
    paragraph = document.createP();
    paragraph.addText(section.title || section.sectionId || 'Untitled Section', { bold: true, font_size: 14 });
    paragraph = document.createP();
    paragraph.addText(cleanExportText(section.content, section.title));
  }
  document.generate(response);
}

async function ensureStandardTemplate() {
  const existing = await prisma.rfpTemplate.findFirst({ where: { name: STANDARD_TEMPLATE_NAME } });
  if (existing) return existing;
  return prisma.rfpTemplate.create({
    data: {
      name: STANDARD_TEMPLATE_NAME,
      agency: 'General',
      description: 'Review-required proposal application structure for SAM.gov opportunities.',
      sections: JSON.stringify(STANDARD_SECTIONS),
      evaluationCriteria: JSON.stringify(STANDARD_EVALUATION_CRITERIA)
    }
  });
}

async function generateAndSaveApplication({ contractId, templateId, companyProfileId, customInstructions, focusAreas }) {
  const contract = await prisma.contract.findUnique({ where: { noticeId: contractId } });
  if (!contract) {
    const error = new Error('Selected contract opportunity was not found');
    error.statusCode = 404;
    throw error;
  }

  const template = templateId
    ? await prisma.rfpTemplate.findUnique({ where: { id: templateId } })
    : await ensureStandardTemplate();
  if (!template) {
    const error = new Error('Selected RFP template was not found');
    error.statusCode = 404;
    throw error;
  }

  const companyProfile = companyProfileId
    ? await prisma.companyProfile.findUnique({ where: { id: companyProfileId } })
    : null;
  if (!companyProfile) {
    const error = new Error('Create and select a company profile before generating an application');
    error.statusCode = 409;
    error.code = 'COMPANY_PROFILE_REQUIRED';
    throw error;
  }
  if (!config.openRouterApiKey) {
    const error = new Error('OPENROUTER_API_KEY is required for proposal generation');
    error.statusCode = 503;
    throw error;
  }

  const generated = await rfpService.generateRFPResponse(
    contract.noticeId,
    template.id,
    companyProfile.id,
    { customInstructions, focusAreas }
  );

  const responseData = {
    sections: generated.sections,
    predictedScore: generated.predictedScore,
    metadata: {
      ...generated.metadata,
      customInstructions: customInstructions || null,
      focusAreas: Array.isArray(focusAreas) ? focusAreas : [],
      sourceContractNoticeId: contract.noticeId,
      sourceContractUpdatedAt: contract.updatedAt.toISOString(),
      reviewRequired: true,
      releaseStatus: 'draft_only'
    }
  };

  return prisma.rfpResponse.create({
    data: {
      contractId: contract.noticeId,
      templateId: template.id,
      companyProfileId: companyProfile.id,
      title: `${contract.title || contract.noticeId} — Proposal Application Draft`,
      status: 'draft',
      responseData: JSON.stringify(responseData),
      complianceStatus: JSON.stringify(generated.compliance),
      predictedScore: Number(generated.predictedScore?.overall) || null
    }
  });
}

router.get('/dashboard/stats', async (_req, res) => {
  try {
    const [totalRFPs, activeRFPs, submittedRFPs, score, recent] = await Promise.all([
      prisma.rfpResponse.count(),
      prisma.rfpResponse.count({ where: { status: { in: ['draft', 'in_review', 'approved'] } } }),
      prisma.rfpResponse.count({ where: { status: 'submitted' } }),
      prisma.rfpResponse.aggregate({ _avg: { predictedScore: true } }),
      prisma.rfpResponse.findMany({ orderBy: { updatedAt: 'desc' }, take: 5 })
    ]);
    return res.json({
      success: true,
      stats: {
        totalRFPs,
        activeRFPs,
        submittedRFPs,
        winRate: 0,
        averageScore: Math.round(score._avg.predictedScore || 0),
        recentActivity: recent.map(item => ({
          rfpId: item.id,
          title: item.title,
          status: item.status,
          lastModified: item.updatedAt.toISOString()
        }))
      }
    });
  } catch (error) {
    console.error(`RFP dashboard stats failed: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to load RFP dashboard statistics' });
  }
});

router.get('/templates', async (_req, res) => {
  try {
    await ensureStandardTemplate();
    const templates = await prisma.rfpTemplate.findMany({ orderBy: { createdAt: 'asc' } });
    return res.json({ success: true, templates: templates.map(serializeTemplate) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/templates/:id', async (req, res) => {
  const template = await prisma.rfpTemplate.findUnique({ where: { id: positiveInteger(req.params.id, -1) } });
  return template
    ? res.json({ success: true, template: serializeTemplate(template) })
    : res.status(404).json({ success: false, error: 'RFP template not found' });
});

router.post('/templates', async (req, res) => {
  try {
    const sections = normalizeSections(req.body.sections);
    if (!String(req.body.name || '').trim() || sections.length === 0) {
      return res.status(400).json({ success: false, error: 'Template name and at least one section are required' });
    }
    const template = await prisma.rfpTemplate.create({
      data: {
        name: String(req.body.name).trim(),
        agency: String(req.body.agency || 'General').trim(),
        description: req.body.description ? String(req.body.description).trim() : null,
        sections: JSON.stringify(sections),
        evaluationCriteria: JSON.stringify(req.body.evaluationCriteria || STANDARD_EVALUATION_CRITERIA)
      }
    });
    return res.status(201).json({ success: true, template: serializeTemplate(template) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/templates/:id', async (req, res) => {
  try {
    const current = await prisma.rfpTemplate.findUnique({ where: { id: positiveInteger(req.params.id, -1) } });
    if (!current) return res.status(404).json({ success: false, error: 'RFP template not found' });
    if (
      current.name === STANDARD_TEMPLATE_NAME
      && req.body.name !== undefined
      && String(req.body.name).trim() !== STANDARD_TEMPLATE_NAME
    ) {
      return res.status(400).json({ success: false, error: 'The built-in standard template cannot be renamed' });
    }
    const template = await prisma.rfpTemplate.update({
      where: { id: current.id },
      data: {
        ...(req.body.name !== undefined ? { name: String(req.body.name).trim() } : {}),
        ...(req.body.agency !== undefined ? { agency: String(req.body.agency).trim() } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description ? String(req.body.description).trim() : null } : {}),
        ...(req.body.sections !== undefined ? { sections: JSON.stringify(normalizeSections(req.body.sections)) } : {}),
        ...(req.body.evaluationCriteria !== undefined ? { evaluationCriteria: JSON.stringify(req.body.evaluationCriteria) } : {})
      }
    });
    return res.json({ success: true, template: serializeTemplate(template) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    await prisma.rfpTemplate.delete({ where: { id: positiveInteger(req.params.id, -1) } });
    return res.json({ success: true, message: 'RFP template deleted' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 409).json({ success: false, error: 'Template could not be deleted' });
  }
});

router.get('/company-profiles', async (_req, res) => {
  const profiles = await prisma.companyProfile.findMany({ orderBy: { createdAt: 'asc' } });
  return res.json({ success: true, profiles: profiles.map(serializeCompanyProfile) });
});

router.get('/company-profiles/:id', async (req, res) => {
  const profile = await prisma.companyProfile.findUnique({ where: { id: positiveInteger(req.params.id, -1) } });
  return profile
    ? res.json({ success: true, profile: serializeCompanyProfile(profile) })
    : res.status(404).json({ success: false, error: 'Company profile not found' });
});

router.post('/company-profiles', async (req, res) => {
  try {
    const companyName = String(req.body.companyName || '').trim();
    if (!companyName) return res.status(400).json({ success: false, error: 'Company name is required' });
    const profile = await prisma.companyProfile.create({
      data: {
        companyName,
        profileData: JSON.stringify({
          companyName,
          basicInfo: req.body.basicInfo || {},
          capabilities: req.body.capabilities || {},
          businessDetails: req.body.businessDetails || {},
          pastPerformance: req.body.pastPerformance || [],
          keyPersonnel: req.body.keyPersonnel || [],
          additionalSections: req.body.additionalSections || []
        })
      }
    });
    return res.status(201).json({ success: true, profile: serializeCompanyProfile(profile) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/company-profiles/:id', async (req, res) => {
  try {
    const current = await prisma.companyProfile.findUnique({ where: { id: positiveInteger(req.params.id, -1) } });
    if (!current) return res.status(404).json({ success: false, error: 'Company profile not found' });
    const currentData = parseJson(current.profileData, {});
    const companyName = String(req.body.companyName ?? current.companyName).trim();
    if (!companyName) return res.status(400).json({ success: false, error: 'Company name is required' });
    const profile = await prisma.companyProfile.update({
      where: { id: current.id },
      data: {
        companyName,
        profileData: JSON.stringify({
          ...currentData,
          companyName,
          ...(req.body.basicInfo !== undefined ? { basicInfo: req.body.basicInfo } : {}),
          ...(req.body.capabilities !== undefined ? { capabilities: req.body.capabilities } : {}),
          ...(req.body.businessDetails !== undefined ? { businessDetails: req.body.businessDetails } : {}),
          ...(req.body.pastPerformance !== undefined ? { pastPerformance: req.body.pastPerformance } : {}),
          ...(req.body.keyPersonnel !== undefined ? { keyPersonnel: req.body.keyPersonnel } : {}),
          ...(req.body.additionalSections !== undefined ? { additionalSections: req.body.additionalSections } : {})
        })
      }
    });
    return res.json({ success: true, profile: serializeCompanyProfile(profile) });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/company-profiles/:id', async (req, res) => {
  try {
    await prisma.companyProfile.delete({ where: { id: positiveInteger(req.params.id, -1) } });
    return res.json({ success: true, message: 'Company profile deleted' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 409).json({ success: false, error: 'Company profile could not be deleted' });
  }
});

router.post('/generate', async (req, res) => {
  const startedAt = Date.now();
  try {
    const contractId = String(req.body.contractId || '').trim();
    const templateId = req.body.templateId ? positiveInteger(req.body.templateId, null) : null;
    const companyProfileId = req.body.companyProfileId ? positiveInteger(req.body.companyProfileId, null) : null;
    if (!contractId) return res.status(400).json({ success: false, error: 'contractId is required' });

    const response = await generateAndSaveApplication({
      contractId,
      templateId,
      companyProfileId,
      customInstructions: req.body.customInstructions,
      focusAreas: req.body.focusAreas
    });
    const serialized = serializeResponse(response);
    return res.status(201).json({
      success: true,
      rfpResponseId: response.id,
      generationTime: (Date.now() - startedAt) / 1000,
      sectionsGenerated: serialized.sections.length,
      complianceScore: serialized.complianceStatus.score || 0,
      predictedScore: serialized.predictedScore == null
        ? null
        : typeof serialized.predictedScore === 'object'
        ? serialized.predictedScore.overall || 0
        : serialized.predictedScore || 0,
      message: 'Proposal application draft generated. Human review is required before submission.'
    });
  } catch (error) {
    console.error(`RFP generation failed: ${error.message}`);
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      error: error.message,
      message: error.message
    });
  }
});

router.get('/responses', async (req, res) => {
  const page = positiveInteger(req.query.page, 1);
  const limit = Math.min(100, positiveInteger(req.query.limit, 20));
  const [responses, total] = await Promise.all([
    prisma.rfpResponse.findMany({ orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.rfpResponse.count()
  ]);
  return res.json({
    success: true,
    responses: responses.map(serializeResponse),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

router.get('/responses/:id', async (req, res) => {
  const response = await prisma.rfpResponse.findUnique({ where: { id: positiveInteger(req.params.id, -1) } });
  return response
    ? res.json({ success: true, response: serializeResponse(response) })
    : res.status(404).json({ success: false, error: 'RFP response not found' });
});

router.get('/responses/:id/download/:format', async (req, res) => {
  try {
    const response = await prisma.rfpResponse.findUnique({ where: { id: positiveInteger(req.params.id, -1) } });
    if (!response) return res.status(404).json({ success: false, error: 'RFP response not found' });
    const format = String(req.params.format || '').toLowerCase();
    if (!['txt', 'pdf', 'docx'].includes(format)) {
      return res.status(400).json({ success: false, error: 'Download format must be txt, pdf, or docx' });
    }
    if (format === 'pdf') return sendPdf(res, response);
    if (format === 'docx') return sendDocx(res, response);

    const { serialized, content } = proposalText(response);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(serialized.title)}.txt"`);
    return res.send(content);
  } catch (error) {
    console.error(`RFP download failed: ${error.message}`);
    if (res.headersSent) return res.end();
    return res.status(500).json({ success: false, error: 'Failed to generate RFP download' });
  }
});

router.put('/responses/:id', async (req, res) => {
  try {
    const allowedStatuses = ['draft', 'in_review', 'approved', 'submitted'];
    if (req.body.status !== undefined && !allowedStatuses.includes(req.body.status)) {
      return res.status(400).json({ success: false, error: 'Invalid RFP response status' });
    }
    const response = await prisma.rfpResponse.update({
      where: { id: positiveInteger(req.params.id, -1) },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title).trim() } : {}),
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        ...(req.body.responseData !== undefined ? { responseData: JSON.stringify(req.body.responseData) } : {})
      }
    });
    return res.json({ success: true, response: serializeResponse(response) });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 500).json({ success: false, error: 'RFP response could not be updated' });
  }
});

router.put('/responses/:id/sections/:sectionId', async (req, res) => {
  try {
    const current = await prisma.rfpResponse.findUnique({ where: { id: positiveInteger(req.params.id, -1) } });
    if (!current) return res.status(404).json({ success: false, error: 'RFP response not found' });
    const responseData = parseJson(current.responseData, { sections: [], metadata: {} });
    const index = (responseData.sections || []).findIndex(section => section.sectionId === req.params.sectionId || section.id === req.params.sectionId);
    if (index < 0) return res.status(404).json({ success: false, error: 'RFP section not found' });
    const content = req.body.content !== undefined ? String(req.body.content) : responseData.sections[index].content;
    const section = {
      ...responseData.sections[index],
      content,
      wordCount: content.trim() ? content.trim().split(/\s+/).length : 0,
      status: 'reviewed',
      lastModified: new Date().toISOString(),
      modifiedBy: String(req.user?.email || req.user?.id || 'Authenticated user')
    };
    responseData.sections[index] = section;
    await prisma.rfpResponse.update({
      where: { id: current.id },
      data: { responseData: JSON.stringify(responseData) }
    });
    return res.json({ success: true, section });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/responses/:id', async (req, res) => {
  try {
    await prisma.rfpResponse.delete({ where: { id: positiveInteger(req.params.id, -1) } });
    return res.json({ success: true, message: 'RFP response deleted' });
  } catch (error) {
    return res.status(error.code === 'P2025' ? 404 : 500).json({ success: false, error: 'RFP response not found' });
  }
});

module.exports = router;
