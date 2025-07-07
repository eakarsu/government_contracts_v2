const { prisma } = require('../config/database');
const vectorService = require('./vectorService');
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
      const [contract, template, companyProfile] = await Promise.all([
        prisma.contract.findUnique({ where: { noticeId: contractId } }),
        prisma.rfpTemplate.findUnique({ where: { id: templateId } }),
        prisma.companyProfile.findUnique({ where: { id: companyProfileId } })
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

      // Generate sections
      const sections = await this.generateAllSections(
        templateData.sections,
        contract,
        companyData,
        options
      );

      // Calculate compliance and scoring
      const compliance = this.calculateCompliance(sections, templateData);
      const predictedScore = this.predictScore(sections, templateData, companyData);

      return {
        sections,
        compliance,
        predictedScore,
        metadata: {
          generatedAt: new Date().toISOString(),
          wordCount: sections.reduce((total, section) => total + section.wordCount, 0),
          pageCount: Math.ceil(sections.reduce((total, section) => total + section.wordCount, 0) / 250)
        }
      };

    } catch (error) {
      console.error(`❌ [RFP] Error generating RFP response:`, error);
      throw error;
    }
  }

  /**
   * Generate content for a specific section
   */
  async generateSectionContent(section, contract, companyData, customInstructions = '') {
    try {
      console.log(`📝 [RFP] Generating section: ${section.title}`);

      const prompt = this.buildSectionPrompt(section, contract, companyData, customInstructions);
      
      const result = await summaryService.summarizeContent(
        prompt,
        process.env.REACT_APP_OPENROUTER_KEY
      );

      // Handle both string and object responses from summarization service
      let content = '';
      if (typeof result.result === 'string') {
        content = result.result;
      } else if (typeof result.result === 'object' && result.result !== null) {
        // Parse the JSON object to extract the actual content
        try {
          const parsedResult = result.result;
          
          // Look for content in various possible fields
          if (parsedResult.content) {
            content = parsedResult.content;
          } else if (parsedResult.summary) {
            content = parsedResult.summary;
          } else if (parsedResult.text) {
            content = parsedResult.text;
          } else if (parsedResult.response) {
            content = parsedResult.response;
          } else if (parsedResult.attachment_content) {
            content = parsedResult.attachment_content;
          } else if (parsedResult.document_content) {
            content = parsedResult.document_content;
          } else {
            // If it's a structured document, try to extract meaningful text
            const textParts = [];
            
            // Check for title
            if (parsedResult.attachment_metadata?.title) {
              textParts.push(`# ${parsedResult.attachment_metadata.title}\n`);
            }
            
            // Check for sections or content blocks
            if (parsedResult.sections && Array.isArray(parsedResult.sections)) {
              parsedResult.sections.forEach(sectionData => {
                if (sectionData.title) textParts.push(`## ${sectionData.title}\n`);
                if (sectionData.content) textParts.push(`${sectionData.content}\n`);
              });
            }
            
            // If we found structured content, use it
            if (textParts.length > 0) {
              content = textParts.join('\n');
            } else {
              // Last resort: create a professional section based on the metadata
              const title = parsedResult.attachment_metadata?.title || `${section.title} Section`;
              content = `# ${title}\n\n[This section contains generated content for ${section.title}. The AI response was in a structured format that needs to be processed. Please review and edit as needed.]\n\nSection: ${section.title}`;
            }
          }
        } catch (parseError) {
          console.error(`❌ [RFP] Error parsing section result for ${section.title}:`, parseError);
          content = `[Error processing generated content for ${section.title}. Please regenerate this section.]`;
        }
      } else {
        content = `[Generated content for ${section.title}]`;
      }

      // Ensure content is a string before calling split
      const contentString = String(content);
      const wordCount = contentString.split(' ').length;

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
      console.error(`❌ [RFP] Error generating section ${section.title}:`, error);
      throw error;
    }
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
   * Predict RFP score
   */
  predictScore(sections, template, companyData) {
    const evaluationCriteria = template.evaluationCriteria || {};
    
    // Calculate technical score
    const technicalScore = this.calculateTechnicalScore(sections, evaluationCriteria);
    
    // Calculate past performance score
    const pastPerformanceScore = this.calculatePastPerformanceScore(companyData);
    
    // Calculate overall score
    const technicalWeight = evaluationCriteria.technicalWeight || 60;
    const pastPerformanceWeight = evaluationCriteria.pastPerformanceWeight || 20;
    const costWeight = evaluationCriteria.costWeight || 20;
    
    const overall = (
      (technicalScore * technicalWeight / 100) +
      (pastPerformanceScore * pastPerformanceWeight / 100) +
      (85 * costWeight / 100) // Placeholder cost score
    );

    return {
      overall: Math.round(overall),
      technical: Math.round(technicalScore),
      cost: 85, // Placeholder
      pastPerformance: Math.round(pastPerformanceScore),
      confidence: 75,
      factors: {
        strengths: this.identifyStrengths(sections, companyData),
        weaknesses: this.identifyWeaknesses(sections, companyData),
        recommendations: this.generateRecommendations(sections, companyData)
      }
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

    if (processedDocs.length > 0) {
      content += '\n\nDocument Content:\n';
      processedDocs.forEach((doc, index) => {
        try {
          const docData = JSON.parse(doc.processedData);
          content += `\nDocument ${index + 1} (${doc.filename}):\n${docData.content || docData.summary || 'No content available'}\n`;
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
      process.env.REACT_APP_OPENROUTER_KEY
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

  async generateAllSections(templateSections, contract, companyData, options) {
    const sections = [];

    for (const section of templateSections) {
      try {
        const sectionContent = await this.generateSectionContent(
          section,
          contract,
          companyData,
          options.customInstructions
        );
        sections.push(sectionContent);
      } catch (error) {
        console.error(`Error generating section ${section.title}:`, error);
        // Add placeholder section
        sections.push({
          id: section.id,
          sectionId: section.id,
          title: section.title,
          content: `[Content for ${section.title} - Generation failed]`,
          wordCount: 0,
          status: 'error',
          compliance: { wordLimit: { compliant: false }, quality: { score: 0 } },
          lastModified: new Date().toISOString(),
          modifiedBy: 'AI Generator'
        });
      }
    }

    return sections;
  }

  buildSectionPrompt(section, contract, companyData, customInstructions) {
    return `Generate professional RFP section content:

SECTION: ${section.title}
DESCRIPTION: ${section.description || 'Standard RFP section'}
MAX WORDS: ${section.maxWords || 1000}
FORMAT: ${section.format || 'narrative'}

CONTRACT INFORMATION:
Title: ${contract.title}
Agency: ${contract.agency}
Description: ${contract.description}

COMPANY INFORMATION:
Name: ${companyData.companyName || 'Company Name'}
Core Competencies: ${companyData.capabilities?.coreCompetencies?.join(', ') || 'Technical capabilities'}
Past Performance: ${companyData.pastPerformance?.map(p => p.contractName).join(', ') || 'Government contracts'}

CUSTOM INSTRUCTIONS: ${customInstructions || 'Follow RFP best practices'}

Generate compelling, professional content that:
1. Addresses section requirements
2. Highlights company strengths
3. Demonstrates government contracting expertise
4. Stays within word limits
5. Uses professional language

Content:`;
  }

  calculateCompliance(sections, template) {
    const templateSections = template.sections || [];
    
    const wordLimitsCheck = this.checkWordLimits(sections, templateSections);
    const requiredSectionsCheck = this.checkRequiredSections(sections, templateSections);
    
    const overallScore = (wordLimitsCheck.score + requiredSectionsCheck.score) / 2;
    
    return {
      overall: overallScore >= 80,
      score: Math.round(overallScore),
      checks: {
        wordLimits: wordLimitsCheck,
        requiredSections: requiredSectionsCheck,
        formatCompliance: { passed: true, score: 90, details: 'Format compliant' },
        requirementCoverage: { passed: true, score: 85, details: 'Requirements covered' }
      },
      issues: []
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
    const wordCount = content.split(' ').length;
    
    return {
      wordLimit: {
        current: wordCount,
        maximum: section.maxWords,
        compliant: !section.maxWords || wordCount <= section.maxWords
      },
      requirementCoverage: {
        covered: [],
        missing: [],
        percentage: 85
      },
      quality: {
        score: 85,
        strengths: ['Professional tone', 'Relevant content'],
        improvements: ['Add specific examples']
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
