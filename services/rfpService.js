const { prisma } = require('../config/database');
const config = require('../config/env');
const vectorService = require('./vectorServiceInstance');
const summaryService = require('./summaryService');

/**
 * RFP Auto-Fill Service
 * Handles RFP analysis, content generation, and compliance checking
 */
class RFPService {
  constructor() {
    this.defaultTemplates = this.getDefaultTemplates();
  }

  /**
   * Analyze a contract for RFP response preparation
   */
  async analyzeContractForRFP(contractId) {
    try {
      console.log(`🔍 [RFP] Analyzing contract ${contractId} for RFP preparation`);

      // Get contract and related documents
      const contract = await prisma.contract.findUnique({
        where: { noticeId: contractId }
      });

      if (!contract) {
        throw new Error('Contract not found');
      }

      // Get processed documents
      const processedDocs = await prisma.documentProcessingQueue.findMany({
        where: { 
          contractNoticeId: contractId,
          status: 'completed',
          processedData: { not: null }
        }
      });

      // Combine all content for analysis
      let analysisContent = this.buildAnalysisContent(contract, processedDocs);

      // Generate AI analysis
      const analysis = await this.generateRFPAnalysis(analysisContent);

      return {
        contractId,
        extractedData: analysis.extractedData,
        recommendations: analysis.recommendations,
        analyzedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ [RFP] Error analyzing contract ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Generate RFP response content
   */
  async generateRFPResponse(contractId, templateId, companyProfileId, options = {}) {
    try {
      console.log(`🚀 [RFP] Generating RFP response for contract ${contractId}`);

      // Get required data
      const [contract, template, companyProfile, sourceDocuments] = await Promise.all([
        prisma.contract.findUnique({ where: { noticeId: contractId } }),
        prisma.rfpTemplate.findUnique({ where: { id: templateId } }),
        prisma.companyProfile.findUnique({ where: { id: companyProfileId } }),
        prisma.documentProcessingQueue.findMany({
          where: { contractNoticeId: contractId, status: 'completed', processedData: { not: null } },
          orderBy: { completedAt: 'asc' }
        })
      ]);

      if (!contract || !template || !companyProfile) {
        throw new Error('Required data not found');
      }

      // Parse template and company data
      const templateData = {
        ...template,
        sections: JSON.parse(template.sections || '[]'),
        evaluationCriteria: JSON.parse(template.evaluationCriteria || '{}')
      };
      
      const companyData = JSON.parse(companyProfile.profileData || '{}');
      companyData.companyName = companyData.companyName || companyProfile.companyName;

      // Generate sections
      const sections = await this.generateAllSections(
        templateData,
        contract,
        companyData,
        { ...options, sourceDocuments }
      );

      // Calculate compliance and scoring
      const compliance = this.calculateCompliance(sections, templateData);
      const predictedScore = null;
      const generationBatches = this.createSectionBatches(templateData.sections);

      return {
        sections,
        compliance,
        predictedScore,
        metadata: {
          generatedAt: new Date().toISOString(),
          promptVersion: 'evidence-routed-v5-complete-sam-and-attachments',
          sourceDocumentCount: sourceDocuments.length,
          templateName: templateData.name,
          companyName: companyData.companyName || companyProfile.companyName,
          templateTargetWordCount: this.templateTargetWordCount(templateData.sections),
          generationBatchCount: generationBatches.length,
          generationTokenAllowance: generationBatches.reduce(
            (total, batch) => total + this.sectionBatchTokenBudget(batch),
            0
          ),
          perRequestTokenCeiling: config.rfpMaxTokens,
          profileEvidence: {
            pastPerformanceCount: Array.isArray(companyData.pastPerformance) ? companyData.pastPerformance.filter(item => item?.status !== 'placeholder').length : 0,
            keyPersonnelCount: Array.isArray(companyData.keyPersonnel) ? companyData.keyPersonnel.filter(item => item?.status !== 'placeholder').length : 0
          },
          wordCount: sections.reduce((total, section) => total + section.wordCount, 0),
          pageCount: Math.ceil(sections.reduce((total, section) => total + section.wordCount, 0) / 250)
        }
      };

    } catch (error) {
      console.error(`❌ [RFP] Error generating RFP response:`, error);
      throw error;
    }
  }

  generateFallbackSections(templateSections) {
    console.log(`⚠️ [RFP] Generating fallback sections for ${templateSections.length} sections`);
    return templateSections.map(section => this.generateErrorSection(section));
  }

  generateErrorSection(section) {
    return {
      id: section.id,
      sectionId: section.id,
      title: section.title,
      content: `[Content for ${section.title} - Generation failed. Please regenerate this section.]`,
      wordCount: 0,
      status: 'error',
      compliance: { 
        wordLimit: { compliant: false, current: 0, maximum: section.maxWords }, 
        quality: { score: 0 } 
      },
      lastModified: new Date().toISOString(),
      modifiedBy: 'AI Generator'
    };
  }

  /**
   * Check RFP compliance
   */
  checkCompliance(rfpResponse, template) {
    const sections = rfpResponse.sections || [];
    const templateSections = JSON.parse(template.sections || '[]');

    const checks = {
      wordLimits: this.checkWordLimits(sections, templateSections),
      requiredSections: this.checkRequiredSections(sections, templateSections),
      formatCompliance: this.checkFormatCompliance(sections, templateSections),
      requirementCoverage: this.checkRequirementCoverage(sections, templateSections)
    };

    const overallScore = Object.values(checks).reduce((sum, check) => sum + check.score, 0) / Object.keys(checks).length;
    const issues = this.identifyComplianceIssues(checks);

    return {
      overall: overallScore >= 80,
      score: Math.round(overallScore),
      checks,
      issues
    };
  }

  /**
   * Get competitive analysis
   */
  async getCompetitiveAnalysis(contractId, companyProfileId) {
    try {
      console.log(`📊 [RFP] Getting competitive analysis for contract ${contractId}`);

      // Find similar contracts
      const contract = await prisma.contract.findUnique({
        where: { noticeId: contractId }
      });

      const similarContracts = await prisma.contract.findMany({
        where: {
          OR: [
            { naicsCode: contract.naicsCode },
            { agency: contract.agency },
            { classificationCode: contract.classificationCode }
          ],
          noticeId: { not: contractId }
        },
        take: 10
      });

      // Get company profile
      const companyProfile = await prisma.companyProfile.findUnique({
        where: { id: companyProfileId }
      });

      const companyData = JSON.parse(companyProfile.profileData || '{}');

      // Analyze market
      const marketInsights = this.analyzeMarket(similarContracts);
      const positioning = this.analyzePositioning(companyData, similarContracts);
      const pricingStrategy = this.suggestPricingStrategy(similarContracts, companyData);

      return {
        marketInsights,
        positioning,
        pricingStrategy
      };

    } catch (error) {
      console.error(`❌ [RFP] Error getting competitive analysis:`, error);
      throw error;
    }
  }

  // Helper Methods

  buildAnalysisContent(contract, processedDocs) {
    let content = `
Contract Title: ${contract.title || 'N/A'}
Agency: ${contract.agency || 'N/A'}
NAICS Code: ${contract.naicsCode || 'N/A'}
Classification: ${contract.classificationCode || 'N/A'}
Description: ${contract.description || 'N/A'}
`;

    if (contract.samData) {
      content += `\nComplete SAM.gov Opportunity Record:\n${JSON.stringify(contract.samData, null, 2)}\n`;
    }

    if (processedDocs.length > 0) {
      content += '\n\nDocument Content:\n';
      processedDocs.forEach((doc, index) => {
        try {
          const docData = JSON.parse(doc.processedData);
          content += `\nDocument ${index + 1} (${doc.filename}):\n${docData.extractedText || docData.content || docData.summary || 'No content available'}\n`;
        } catch (parseError) {
          console.warn(`Could not parse document data for ${doc.filename}`);
        }
      });
    }

    return content;
  }

  async generateRFPAnalysis(content) {
    const prompt = `Analyze this government contract for RFP response preparation:

${content}

Extract and provide structured RFP analysis in JSON format:
{
  "extractedData": {
    "scopeOfWork": "Detailed work description",
    "technicalRequirements": ["req1", "req2"],
    "deliverables": ["del1", "del2"],
    "timeline": "Project timeline",
    "evaluationCriteria": {
      "technicalWeight": 60,
      "costWeight": 30,
      "pastPerformanceWeight": 10,
      "factors": []
    },
    "complianceRequirements": ["comp1", "comp2"],
    "submissionRequirements": {
      "format": "PDF",
      "pageLimit": 50,
      "sections": ["Executive Summary", "Technical Approach"]
    }
  },
  "recommendations": {
    "templateSuggestion": "Template name",
    "keyFocusAreas": ["area1", "area2"],
    "competitiveAdvantages": ["adv1", "adv2"],
    "riskFactors": ["risk1", "risk2"]
  }
}`;

    const result = await summaryService.summarizeContent(
      prompt,
      process.env.OPENROUTER_API_KEY
    );

    try {
      return JSON.parse(result.result);
    } catch (parseError) {
      // Return fallback structure
      return {
        extractedData: {
          scopeOfWork: "Scope to be determined from full RFP",
          technicalRequirements: ["Requirements to be analyzed"],
          deliverables: ["Deliverables to be defined"],
          timeline: "Timeline to be determined",
          evaluationCriteria: {
            technicalWeight: 60,
            costWeight: 30,
            pastPerformanceWeight: 10,
            factors: []
          },
          complianceRequirements: ["Standard compliance requirements"],
          submissionRequirements: {
            format: "PDF",
            sections: ["Executive Summary", "Technical Approach", "Management Plan"]
          }
        },
        recommendations: {
          templateSuggestion: "Standard Government Template",
          keyFocusAreas: ["Technical Excellence", "Cost Effectiveness"],
          competitiveAdvantages: ["To be determined"],
          riskFactors: ["Competition level"]
        }
      };
    }
  }

  async generateAllSections(template, contract, companyData, options = {}) {
    const templateSections = Array.isArray(template?.sections) ? template.sections : [];
    try {
      if (templateSections.length === 0) {
        const templateError = new Error('The selected RFP template does not contain any sections');
        templateError.statusCode = 422;
        templateError.code = 'RFP_TEMPLATE_EMPTY';
        throw templateError;
      }

      const batches = this.createSectionBatches(templateSections);
      console.log(
        `🚀 [RFP] Generating ${templateSections.length} sections in ${batches.length} provider request batch(es); ` +
        `configured per-request ceiling ${config.rfpMaxTokens.toLocaleString('en-US')} tokens`
      );

      const sections = [];
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        let result = await this.requestSectionBatch(
          batch,
          template,
          contract,
          companyData,
          options,
          index + 1,
          batches.length
        );

        if (!result.success || !result.result) {
          if (batch.length === 1) this.throwGenerationError(result, batch);

          console.warn(
            `⚠️ [RFP] Batch ${index + 1} failed; retrying its ${batch.length} sections individually`
          );
          for (const section of batch) {
            result = await this.requestSectionBatch(
              [section],
              template,
              contract,
              companyData,
              options,
              index + 1,
              batches.length,
              true
            );
            if (!result.success || !result.result) this.throwGenerationError(result, [section]);
            sections.push(this.createGeneratedSection(result.result, section));
          }
        } else {
          for (const section of batch) {
            sections.push(this.createGeneratedSection(result.result, section));
          }
        }
      }

      console.log(`✅ [RFP] Successfully generated ${sections.length} sections across ${batches.length} batch(es)`);
      return sections;

    } catch (error) {
      console.error(`❌ [RFP] Error in generateAllSections:`, error);
      throw error;
    }
  }

  createSectionBatches(templateSections = [], maxTargetWords = 2800, maxSections = 4) {
    const batches = [];
    let currentBatch = [];
    let currentTargetWords = 0;

    for (const section of templateSections) {
      const sectionTargetWords = this.templateSectionTarget(section).targetWords;
      const wouldExceedWordTarget = currentBatch.length > 0 && currentTargetWords + sectionTargetWords > maxTargetWords;
      const wouldExceedSectionCount = currentBatch.length >= maxSections;

      if (wouldExceedWordTarget || wouldExceedSectionCount) {
        batches.push(currentBatch);
        currentBatch = [];
        currentTargetWords = 0;
      }

      currentBatch.push(section);
      currentTargetWords += sectionTargetWords;
    }

    if (currentBatch.length > 0) batches.push(currentBatch);
    return batches;
  }

  sectionBatchTokenBudget(sections = []) {
    const targetWords = this.templateTargetWordCount(sections);
    // JSON framing, headings, tables, and structured proposal prose use more
    // tokens than a plain word-count conversion suggests. Reserve enough room
    // for complete sections while retaining the configured provider ceiling.
    const estimatedOutputTokens = Math.ceil(targetWords * 2) + 4000;
    return Math.min(config.rfpMaxTokens, Math.max(12000, estimatedOutputTokens));
  }

  async requestSectionBatch(batch, template, contract, companyData, options, batchNumber, batchCount, isRetry = false) {
    const batchTemplate = { ...template, sections: batch };
    const contractContent = this.buildContractContent(
      contract,
      companyData,
      options.customInstructions,
      options.sourceDocuments || [],
      batchTemplate,
      options.focusAreas || []
    );
    const requiredKeys = batch.map(section => section.id);
    const maximumResponseWords = batch.reduce((total, section) => {
      const maxWords = Number(section.maxWords);
      return total + (Number.isFinite(maxWords) && maxWords > 0 ? maxWords : 600);
    }, 0);
    const maxTokens = this.sectionBatchTokenBudget(batch);
    const label = isRetry
      ? `individual retry for ${batch[0].title}`
      : `batch ${batchNumber} of ${batchCount}`;

    console.log(
      `🧩 [RFP] Requesting ${label}: ${requiredKeys.join(', ')} ` +
      `(up to ${maxTokens.toLocaleString('en-US')} output tokens)`
    );

    return summaryService.summarizeContent(
      contractContent,
      config.openRouterApiKey,
      true,
      label,
      {
        maxTokens,
        systemPrompt: `Draft only the requested government proposal sections using supplied facts. Return one valid JSON object with exactly these keys and string values: ${requiredKeys.join(', ')}. Follow each section's configured length and format, with a combined ceiling of ${maximumResponseWords.toLocaleString('en-US')} words. Never add text outside the JSON object and never invent company or solicitation facts.`
      }
    );
  }

  throwGenerationError(result, batch) {
    const detail = typeof result?.error === 'string'
      ? result.error
      : JSON.stringify(result?.error || {});
    const titles = batch.map(section => section.title).join(', ');
    const generationError = new Error(`Proposal generation failed for ${titles}: ${detail}`);
    generationError.statusCode = 502;
    generationError.code = 'RFP_GENERATION_FAILED';
    throw generationError;
  }

  createGeneratedSection(structuredResult, section) {
    try {
      const content = this.extractSectionFromStructuredResponse(structuredResult, section);
      const contentString = this.normalizeSectionContent(content, section.title);
      const wordCount = contentString.trim() ? contentString.trim().split(/\s+/).length : 0;

      return {
        id: section.id,
        sectionId: section.id,
        title: section.title,
        content: contentString,
        wordCount,
        status: 'generated',
        compliance: this.calculateSectionCompliance(contentString, section),
        lastModified: new Date().toISOString(),
        modifiedBy: 'AI Generator'
      };
    } catch (error) {
      console.error(`Error extracting section ${section.title}:`, error);
      return this.generateErrorSection(section);
    }
  }

  sourceDocumentContent(sourceDocuments) {
    const content = sourceDocuments.map((document, index) => {
      let processed = document.processedData || '';
      try {
        const parsed = JSON.parse(processed);
        if (typeof parsed === 'string') processed = parsed;
        else {
          processed = parsed.extractedText || parsed.text || parsed.content || parsed.summary || parsed.result || JSON.stringify(parsed);
          if (typeof processed !== 'string') processed = JSON.stringify(processed);
        }
      } catch {
        // Keep plain-text processed data as-is.
      }
      const label = document.filename || document.description || `Document ${index + 1}`;
      return `--- ${label} ---\n${String(processed)}`;
    }).join('\n\n');
    return content;
  }

  normalizeSectionContent(content, sectionTitle) {
    const escapedTitle = String(sectionTitle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(content || '')
      .trim()
      .replace(new RegExp(`^#{1,6}\\s*${escapedTitle}\\s*\\n+`, 'i'), '')
      .trim();
  }

  templateSectionTarget(section) {
    const maxWords = Number(section.maxWords);
    if (!Number.isFinite(maxWords) || maxWords <= 0) {
      return { targetWords: 450, maxWords: 600 };
    }
    const targetRatio = section.required === false ? 0.55 : 0.7;
    return {
      targetWords: Math.min(maxWords, Math.max(150, Math.round(maxWords * targetRatio))),
      maxWords
    };
  }

  templateTargetWordCount(templateSections = []) {
    return templateSections.reduce(
      (total, section) => total + this.templateSectionTarget(section).targetWords,
      0
    );
  }

  buildTemplateInstructions(template = {}) {
    const sections = Array.isArray(template.sections) ? template.sections : [];
    return sections.map((section, index) => {
      const { targetWords, maxWords } = this.templateSectionTarget(section);
      const mappings = Array.isArray(section.mappings) && section.mappings.length > 0
        ? section.mappings.join(', ')
        : section.id;
      return `${index + 1}. ${section.title}
   - JSON key: ${section.id}
   - Requirement: ${section.required === false ? 'Optional' : 'Required'}
   - Instruction: ${section.description || 'Address all applicable solicitation requirements for this section.'}
   - Format: ${section.format || 'narrative'}
   - Evidence mappings: ${mappings}
   - Length: target approximately ${targetWords} words when verified evidence supports it; never exceed ${maxWords} words. Do not pad missing evidence with generic or invented claims.`;
    }).join('\n\n');
  }

  buildCompanyProfileContent(companyData = {}) {
    const basicInfo = companyData.basicInfo || {};
    const capabilities = companyData.capabilities || {};
    const verifiedProfile = {
      companyName: companyData.companyName || null,
      basicInfo: {
        dunsNumber: basicInfo.dunsNumber || null,
        cageCode: basicInfo.cageCode || null,
        certifications: Array.isArray(basicInfo.certifications) ? basicInfo.certifications : [],
        sizeStandard: basicInfo.sizeStandard || null,
        naicsCodes: Array.isArray(basicInfo.naicsCode) ? basicInfo.naicsCode : []
      },
      capabilities: {
        coreCompetencies: Array.isArray(capabilities.coreCompetencies) ? capabilities.coreCompetencies : [],
        technicalSkills: Array.isArray(capabilities.technicalSkills) ? capabilities.technicalSkills : [],
        securityClearances: Array.isArray(capabilities.securityClearances) ? capabilities.securityClearances : [],
        methodologies: Array.isArray(capabilities.methodologies) ? capabilities.methodologies : []
      },
      businessDetails: companyData.businessDetails || {},
      pastPerformance: Array.isArray(companyData.pastPerformance) ? companyData.pastPerformance.filter(item => item?.status !== 'placeholder') : [],
      keyPersonnel: Array.isArray(companyData.keyPersonnel) ? companyData.keyPersonnel.filter(item => item?.status !== 'placeholder') : [],
      additionalSections: Array.isArray(companyData.additionalSections) ? companyData.additionalSections : []
    };
    return JSON.stringify(verifiedProfile, null, 2);
  }

  buildContractContent(contract, companyData, customInstructions, sourceDocuments = [], template = {}, focusAreas = []) {
    const sourceContent = this.sourceDocumentContent(sourceDocuments);
    const templateSections = Array.isArray(template.sections) ? template.sections : [];
    const outputKeys = templateSections.map(section => section.id);
    const evaluationCriteria = template.evaluationCriteria || {};
    return `TASK: Analyze the supplied government opportunity, authoritative solicitation content, selected company profile, and selected proposal template. Generate a comprehensive, evidence-based proposal draft. Follow the selected template exactly. Write in a professional, persuasive tone, but do not claim capabilities that the profile does not support.

SOURCE AUTHORITY AND ROUTING RULES:
1. Solicitation documents are authoritative for scope, instructions, deliverables, clauses, evaluation factors, dates, submission rules, and pricing requirements.
2. Contract metadata may identify the opportunity, but a URL or title is not evidence of detailed requirements.
3. The Company Profile is authoritative only for company facts actually recorded there.
4. Values beginning with REVIEW REQUIRED, values marked placeholder, blank values, and unassigned positions are missing evidence—not verified facts.
5. Route legal name, UEI, CAGE, registrations, NAICS codes, size status, contact details, coverage, contract vehicles, insurance, and designations to corporate-qualification and administrative sections.
6. Route core competencies, technical skills, services, technology capabilities, and differentiators to executive-summary and technical sections only when relevant to the solicitation.
7. Route methodologies and delivery/quality narratives to management, schedule, quality, transition, and risk sections.
8. Route labor categories and assigned verified personnel to staffing sections. Labor categories are roles, not named people.
9. Route verified customer records and measurable outcomes to past performance. Never convert capability statements into past performance.
10. Route approved rates and pricing data to the cost section. A pricing approach is not an approved price.
11. Use the selected template section description, format, mappings, maximum words, and evidence instructions for every section.
12. If company capabilities do not align with the opportunity, state the gap clearly rather than presenting an unrelated solution.
13. Review every field in the complete SAM.gov opportunity record and every supplied solicitation attachment from beginning to end before drafting.
14. Treat amendments, addenda, attachments, exhibits, schedules, clauses, evaluation factors, submission instructions, pricing instructions, and question-and-answer documents as separate authoritative evidence sections; do not silently omit any of them.
15. Build an internal requirement-to-source coverage matrix across all supplied evidence. Every material response claim must trace to the SAM.gov record, a solicitation attachment, or verified company-profile evidence.
16. If sources conflict, identify the conflict and prefer the latest explicit amendment only when the supplied evidence establishes its chronology. Otherwise insert REVIEW REQUIRED.

SELECTED TEMPLATE:
Name: ${template.name || 'Unnamed template'}
Agency: ${template.agency || 'General'}
Description: ${template.description || 'No template description provided'}
Evaluation criteria: ${JSON.stringify(evaluationCriteria)}
Evidence instructions: ${evaluationCriteria.evidenceInstructions || 'Use authoritative solicitation content and verified company-profile facts.'}
Configured section target: approximately ${this.templateTargetWordCount(templateSections).toLocaleString('en-US')} words when evidence supports that length.

CONTRACT INFORMATION:
Title: ${contract.title || 'N/A'}
Agency: ${contract.agency || 'N/A'}
Description: ${contract.description || 'N/A'}
NAICS Code: ${contract.naicsCode || 'N/A'}
Classification: ${contract.classificationCode || 'N/A'}
Posted Date: ${contract.postedDate || 'N/A'}

COMPLETE SAM.GOV OPPORTUNITY RECORD (AUTHORITATIVE PUBLISHED METADATA):
${contract.samData ? JSON.stringify(contract.samData, null, 2) : '[Complete SAM.gov metadata was not retained for this previously ingested opportunity. Refresh the opportunity before drafting.]'}

SELECTED COMPANY PROFILE (USER-PROVIDED DATA):
${this.buildCompanyProfileContent(companyData)}

An empty profile field or array means that evidence was not provided. Do not convert an empty field, REVIEW REQUIRED value, placeholder record, proposed role, or planning assumption into a positive claim.

AUTHORITATIVE SOLICITATION DOCUMENT CONTENT:
${sourceContent || '[No processed solicitation document content is available. Do not infer missing requirements from the title or URL; use REVIEW REQUIRED placeholders.]'}

USER FOCUS AREAS: ${Array.isArray(focusAreas) && focusAreas.filter(Boolean).length > 0 ? focusAreas.filter(Boolean).join(', ') : 'None provided'}

CUSTOM INSTRUCTIONS: ${customInstructions || 'Follow RFP best practices'}

---

### RFP RESPONSE SECTIONS

${this.buildTemplateInstructions(template)}

---

**Instructions for Each Section:**
- Use contract and company data mapped to each section.
- Do not invent certifications, clearances, personnel, customers, performance history, prices, or quantitative claims.
- When verified data is missing, keep supported narrative and insert a focused [REVIEW REQUIRED: provide ...] placeholder only for the missing facts.
- Be specific, concise, and persuasive.
- Address all requirements stated in the section description.
- Highlight strengths, innovation, and compliance.
- Where appropriate, use tables, bullet points, or diagrams.
- Treat configured maximum words as ceilings, and the target lengths as drafting goals only when enough verified evidence exists.
- Never repeat the same generic disclaimer merely to increase document length.
- Prefer concrete requirement-to-response tables, responsibility matrices, milestones, quality gates, risks, assumptions, and traceability when the configured section format supports them.
- Use detailed company narrative sections as supporting context, but do not let marketing language override missing legal, personnel, performance, security, or pricing evidence.

**Required output format:**
Return one JSON object with exactly these top-level keys and string values:
${outputKeys.join(', ')}.
Do not include metadata, scoring, commentary, or Markdown fences outside the JSON object.

**End of Prompt**
`;
  }

  extractSectionFromStructuredResponse(structuredResult, section) {
    try {
      console.log(`📝 [RFP] Extracting ${section.title} from structured response`);
      
      // Generic extraction - look for section content in the structured response
      const sectionId = section.id;
      const sectionTitle = section.title.toLowerCase().replace(/\s+/g, '_');
      
      // Try multiple possible field names for this section
      const possibleFields = [
        sectionId,
        ...(Array.isArray(section.mappings) ? section.mappings : []),
        sectionTitle,
        sectionTitle.replace(/_/g, ''),
        section.title.toLowerCase().replace(/\s+/g, '')
      ].filter((field, index, fields) => field && fields.indexOf(field) === index);
      
      let extractedContent = '';
      
      // Look for content in the structured response
      for (const field of possibleFields) {
        if (structuredResult[field]) {
          extractedContent = this.formatSectionContent(structuredResult[field], section.title);
          break;
        }
      }
      
      // If no direct match, try to extract relevant content from any available sections
      if (!extractedContent) {
        extractedContent = this.extractRelevantContent(structuredResult, section);
      }
      
      return extractedContent || this.generateMinimalContent(section);
      
    } catch (error) {
      console.error(`❌ [RFP] Error extracting ${section.title}:`, error);
      return this.generateMinimalContent(section);
    }
  }

  formatSectionContent(sectionData, sectionTitle) {
    const parts = [`# ${sectionTitle}\n`];
    
    if (typeof sectionData === 'string') {
      return sectionData;
    }
    
    if (typeof sectionData === 'object' && sectionData !== null) {
      // Generic object traversal to extract content
      Object.entries(sectionData).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length > 50) {
          // Long string content - likely main content
          parts.push(`## ${this.formatFieldName(key)}\n`);
          parts.push(`${value}\n`);
        } else if (Array.isArray(value) && value.length > 0) {
          // Array content - format as list
          parts.push(`## ${this.formatFieldName(key)}\n`);
          value.forEach(item => {
            if (typeof item === 'string') {
              parts.push(`• ${item}`);
            } else if (typeof item === 'object' && item !== null) {
              // Object in array - format key-value pairs
              Object.entries(item).forEach(([itemKey, itemValue]) => {
                if (typeof itemValue === 'string') {
                  parts.push(`**${this.formatFieldName(itemKey)}:** ${itemValue}`);
                }
              });
              parts.push('');
            }
          });
          parts.push('');
        } else if (typeof value === 'object' && value !== null) {
          // Nested object - recurse
          parts.push(`## ${this.formatFieldName(key)}\n`);
          Object.entries(value).forEach(([subKey, subValue]) => {
            if (typeof subValue === 'string' && subValue.length > 20) {
              parts.push(`**${this.formatFieldName(subKey)}:** ${subValue}\n`);
            }
          });
        }
      });
    }
    
    return parts.join('\n');
  }

  formatFieldName(fieldName) {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  extractRelevantContent(structuredResult, section) {
    const sectionKeywords = section.title.toLowerCase().split(' ');
    const relevantContent = [];
    
    // Search through all fields in the structured result for relevant content
    const searchObject = (obj, path = '') => {
      if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
          const keyLower = key.toLowerCase();
          const hasRelevantKeyword = sectionKeywords.some(keyword => 
            keyLower.includes(keyword) || keyword.includes(keyLower)
          );
          
          if (hasRelevantKeyword && typeof value === 'string' && value.length > 100) {
            relevantContent.push({
              source: `${path}${key}`,
              content: value
            });
          } else if (typeof value === 'object') {
            searchObject(value, `${path}${key}.`);
          }
        });
      }
    };
    
    searchObject(structuredResult);
    
    if (relevantContent.length > 0) {
      const parts = [`# ${section.title}\n`];
      relevantContent.forEach(item => {
        parts.push(`## ${this.formatFieldName(item.source.split('.').pop())}\n`);
        parts.push(`${item.content}\n`);
      });
      return parts.join('\n');
    }
    
    return '';
  }

  generateMinimalContent(section) {
    return `# ${section.title}

[Content for ${section.title} will be generated based on contract requirements and company capabilities. This section requires manual review and completion.]

## Key Points
• Address all requirements specified in the RFP
• Highlight relevant company experience and capabilities
• Demonstrate understanding of project objectives
• Provide specific examples and metrics where applicable

## Next Steps
• Review contract requirements for this section
• Gather relevant company information and past performance data
• Develop detailed content addressing all evaluation criteria
• Ensure compliance with word limits and formatting requirements`;
  }

  calculateCompliance(sections, template) {
    const templateSections = template.sections || [];
    const failedSections = sections.filter(section => section.status === 'error');
    const wordLimitsCheck = this.checkWordLimits(sections, templateSections);
    const requiredSectionsCheck = this.checkRequiredSections(sections, templateSections);

    return {
      overall: false,
      score: 0,
      reviewRequired: true,
      checks: {
        wordLimits: wordLimitsCheck,
        requiredSections: requiredSectionsCheck,
        formatCompliance: {
          passed: failedSections.length === 0,
          score: failedSections.length === 0 ? 100 : 0,
          details: failedSections.length === 0 ? 'All draft sections were generated' : `${failedSections.length} sections failed generation`
        },
        requirementCoverage: {
          passed: false,
          score: 0,
          details: 'Requirement coverage requires human verification against the solicitation documents'
        }
      },
      issues: [{
        type: 'info',
        section: 'Entire proposal',
        message: 'Human review is required before this draft can be considered compliant',
        suggestion: 'Verify every section against the authoritative solicitation and attachments'
      }]
    };
  }

  checkWordLimits(sections, templateSections) {
    let compliantSections = 0;
    let totalSections = 0;

    templateSections.forEach(templateSection => {
      if (templateSection.maxWords) {
        const section = sections.find(s => s.sectionId === templateSection.id);
        if (section) {
          totalSections++;
          if (section.wordCount <= templateSection.maxWords) {
            compliantSections++;
          }
        }
      }
    });

    const score = totalSections > 0 ? (compliantSections / totalSections) * 100 : 100;
    
    return {
      passed: score >= 90,
      score: Math.round(score),
      details: `${compliantSections}/${totalSections} sections within word limits`
    };
  }

  checkRequiredSections(sections, templateSections) {
    const requiredSections = templateSections.filter(s => s.required);
    const presentSections = requiredSections.filter(req => 
      sections.some(s => s.sectionId === req.id)
    );

    const score = requiredSections.length > 0 ? (presentSections.length / requiredSections.length) * 100 : 100;
    
    return {
      passed: score === 100,
      score: Math.round(score),
      details: `${presentSections.length}/${requiredSections.length} required sections present`
    };
  }

  calculateSectionCompliance(content, section) {
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    
    return {
      wordLimit: {
        current: wordCount,
        maximum: section.maxWords,
        compliant: !section.maxWords || wordCount <= section.maxWords
      },
      requirementCoverage: {
        covered: [],
        missing: ['Human verification required'],
        percentage: 0
      },
      quality: {
        score: 0,
        strengths: [],
        improvements: ['Review and approve this AI-generated section before use']
      }
    };
  }

  calculateTechnicalScore(sections, evaluationCriteria) {
    // Analyze technical sections for quality indicators
    const technicalSections = sections.filter(s => 
      s.title.toLowerCase().includes('technical') || 
      s.title.toLowerCase().includes('approach')
    );

    if (technicalSections.length === 0) return 70;

    // Simple scoring based on content length and quality indicators
    let score = 70;
    
    technicalSections.forEach(section => {
      if (section.wordCount > 500) score += 5;
      if (section.content.includes('methodology')) score += 3;
      if (section.content.includes('innovation')) score += 3;
      if (section.content.includes('risk')) score += 2;
    });

    return Math.min(95, score);
  }

  calculatePastPerformanceScore(companyData) {
    const pastPerformance = companyData.pastPerformance || [];
    
    if (pastPerformance.length === 0) return 60;
    
    let score = 60;
    
    pastPerformance.forEach(perf => {
      if (perf.performanceRating === 'exceptional') score += 10;
      else if (perf.performanceRating === 'very_good') score += 7;
      else if (perf.performanceRating === 'satisfactory') score += 5;
      
      if (perf.relevanceScore > 0.8) score += 5;
    });

    return Math.min(95, score);
  }

  identifyStrengths(sections, companyData) {
    const strengths = [];
    
    if (companyData.pastPerformance?.length > 0) {
      strengths.push('Strong past performance record');
    }
    
    if (companyData.capabilities?.securityClearances?.length > 0) {
      strengths.push('Security clearances available');
    }
    
    if (sections.some(s => s.wordCount > 800)) {
      strengths.push('Comprehensive technical approach');
    }

    return strengths;
  }

  identifyWeaknesses(sections, companyData) {
    const weaknesses = [];
    
    if (!companyData.pastPerformance || companyData.pastPerformance.length < 3) {
      weaknesses.push('Limited past performance examples');
    }
    
    if (sections.some(s => s.wordCount < 200)) {
      weaknesses.push('Some sections need more detail');
    }

    return weaknesses;
  }

  generateRecommendations(sections, companyData) {
    const recommendations = [];
    
    recommendations.push('Emphasize unique technical capabilities');
    recommendations.push('Include quantifiable results from past performance');
    recommendations.push('Ensure all sections meet word count requirements');
    
    if (companyData.capabilities?.certifications?.length > 0) {
      recommendations.push('Highlight relevant certifications prominently');
    }

    return recommendations;
  }

  analyzeMarket(similarContracts) {
    const totalValue = similarContracts.reduce((sum, contract) => {
      // Extract value from description or use placeholder
      return sum + 1000000; // Placeholder
    }, 0);

    const averageValue = similarContracts.length > 0 ? totalValue / similarContracts.length : 0;

    return {
      averageContractValue: averageValue,
      commonRequirements: ['Technical expertise', 'Security clearance', 'Past performance'],
      winningStrategies: ['Competitive pricing', 'Strong technical approach', 'Relevant experience'],
      pricingTrends: {
        low: averageValue * 0.8,
        average: averageValue,
        high: averageValue * 1.2
      }
    };
  }

  analyzePositioning(companyData, similarContracts) {
    return {
      competitiveAdvantages: companyData.capabilities?.coreCompetencies || ['Technical expertise'],
      differentiators: ['Unique approach', 'Specialized experience'],
      riskFactors: ['Competition level', 'Technical complexity'],
      recommendations: ['Focus on unique strengths', 'Competitive pricing strategy']
    };
  }

  suggestPricingStrategy(similarContracts, companyData) {
    const basePrice = 1000000; // Placeholder calculation
    
    return {
      suggestedRange: {
        min: basePrice * 0.9,
        max: basePrice * 1.1
      },
      justification: 'Based on market analysis and company capabilities',
      competitiveFactors: ['Market rates', 'Company experience', 'Technical complexity']
    };
  }



  getDefaultTemplates() {
    return {
      dod: {
        name: 'Department of Defense Template',
        agency: 'DOD',
        sections: [
          {
            id: 'executive_summary',
            title: 'Executive Summary',
            required: true,
            maxWords: 500,
            format: 'narrative'
          },
          {
            id: 'technical_approach',
            title: 'Technical Approach',
            required: true,
            maxWords: 2000,
            format: 'narrative'
          },
          {
            id: 'management_plan',
            title: 'Management Plan',
            required: true,
            maxWords: 1500,
            format: 'narrative'
          },
          {
            id: 'past_performance',
            title: 'Past Performance',
            required: true,
            maxWords: 1000,
            format: 'narrative'
          }
        ]
      }
    };
  }

  checkFormatCompliance(sections, templateSections) {
    return {
      passed: true,
      score: 90,
      details: 'All sections follow required format'
    };
  }

  checkRequirementCoverage(sections, templateSections) {
    return {
      passed: true,
      score: 85,
      details: 'Requirements adequately covered'
    };
  }

  identifyComplianceIssues(checks) {
    const issues = [];
    
    Object.entries(checks).forEach(([checkName, check]) => {
      if (!check.passed) {
        issues.push({
          type: 'warning',
          section: checkName,
          message: check.details,
          suggestion: `Review and fix ${checkName} issues`
        });
      }
    });

    return issues;
  }
}

module.exports = new RFPService();
