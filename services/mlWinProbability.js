const { prisma } = require('../config/database');
const nlpService = require('./nlpService');

// Use shared Prisma client instance

class WinProbabilityPredictor {
  constructor() {
    this.model = null;
    this.trainingData = null;
  }

  // Train the model with historical data
  async trainModel() {
    try {
      // Get historical contract data with available fields
      const historicalData = await prisma.contract.findMany({
        where: {
          title: { not: null }
        },
        select: {
          id: true,
          noticeId: true,
          title: true,
          description: true,
          agency: true,
          naicsCode: true,
          setAsideCode: true,
          postedDate: true,
          responseDeadline: true,
          placeOfPerformance: true,
          resourceLinks: true,
          indexedAt: true
        },
        take: 100
      });

      // Prepare training features
      const trainingData = await this.prepareTrainingData(historicalData);
      
      // Simple probability calculation based on patterns
      const model = this.buildSimpleModel(trainingData);
      
      this.model = model;
      this.trainingData = trainingData;
      
      return model;
    } catch (error) {
      console.error('Error training model:', error);
      this.model = this.getDefaultModel();
      this.trainingData = [];
      return this.model;
    }
  }

  async prepareTrainingData(contracts) {
    const features = contracts.map(contract => {
      const features = this.extractFeatures(contract);
      const outcome = contract.awardedTo ? 1 : 0; // 1 = won, 0 = lost
      
      return {
        features,
        outcome,
        contract
      };
    });

    return features;
  }

  extractFeatures(contract) {
    const naicsCode = this.normalizeNaicsCode(contract.naicsCode);
    const features = {
      // Agency features
      agencySize: this.getAgencySize(contract.agency),
      agencyType: this.getAgencyType(contract.agency),
      
      // Contract features
      contractSize: this.categorizeContractSize(contract.awardAmount),
      naicsCode,
      naicsCategory: this.getNaicsCategory(naicsCode),
      setAsideType: contract.setAsideCode || 'NONE',
      
      // Temporal features
      postingDuration: this.calculatePostingDuration(contract.postedDate, contract.responseDeadline),
      postingDayOfWeek: new Date(contract.postedDate).getDay(),
      
      // Text features
      titleLength: contract.title.length,
      descriptionLength: contract.description?.length || 0,
      keywordCount: this.countKeywords(contract.title + ' ' + contract.description),
      
      // Complexity indicators
      hasAttachments: contract.resourceLinks && contract.resourceLinks.length > 0 ? 1 : 0,
      isRenewal: this.isRenewalOpportunity(contract.title, contract.description),

      // Defaults keep the heuristic executable, but must not be counted as evidence.
      evidenceAvailability: {
        agencySize: Boolean(String(contract.agency || '').trim()),
        contractSize: this.hasPositiveAmount(contract.awardAmount),
        setAsideType: Boolean(String(contract.setAsideCode || '').trim()),
        postingDuration: this.hasValidDate(contract.postedDate) && this.hasValidDate(contract.responseDeadline),
        keywordCount: Boolean(String(contract.title || contract.description || '').trim()),
        hasAttachments: Array.isArray(contract.resourceLinks)
      }
    };

    return features;
  }

  buildSimpleModel(trainingData) {
    // Simple rule-based model with learned weights
    const weights = {
      agencySize: 0.15,
      contractSize: 0.20,
      setAsideType: 0.25,
      postingDuration: -0.10,
      keywordCount: 0.05,
      hasAttachments: 0.15
    };

    return {
      weights,
      baseline: 0.3, // Base win probability
      trainingSize: trainingData.length
    };
  }

  async predictWinProbability(newContract, userContext = {}) {
    if (!this.model) {
      this.model = await this.trainModel();
    }

    const features = this.extractFeatures(newContract);
    const profile = userContext.companyProfile || {};
    const naicsEvidence = this.evaluateNaicsEvidence(profile, features.naicsCode);
    
    // Calculate probability using the model
    let probability = this.model.baseline;
    
    // Apply weights
    Object.keys(this.model.weights).forEach(key => {
      if (features[key] !== undefined) {
        const featureValue = this.normalizeFeature(features[key], key);
        probability += this.model.weights[key] * featureValue;
      }
    });

    // Apply user context adjustments
    probability = this.adjustForUserProfile(probability, features, profile, naicsEvidence);

    // Ensure probability is between 0 and 1
    probability = Math.max(0, Math.min(1, probability));
    probability = this.applyNaicsEvidenceGuardrail(probability, naicsEvidence);

    return {
      probability: Math.round(probability * 100),
      confidence: this.calculateConfidence(features, userContext, naicsEvidence),
      factors: this.identifyKeyFactors(features, userContext, naicsEvidence),
      recommendations: this.generateRecommendations(features, probability, userContext, naicsEvidence),
      naicsEvidence
    };
  }

  normalizeFeature(value, feature) {
    // Normalize different feature types to 0-1 range
    switch (feature) {
      case 'agencySize':
        return value / 10; // Max 10
      case 'contractSize':
        return Math.min(value / 5, 1); // Max 5 categories
      case 'postingDuration':
        return Math.min(value / 30, 1); // Max 30 days
      case 'keywordCount':
        return Math.min(value / 20, 1); // Max 20 keywords
      case 'naicsCategory':
        // Categorical values must be encoded before applying numeric weights.
        return value && value !== 'OTHER' ? 1 : 0.25;
      case 'setAsideType':
        return value && value !== 'NONE' ? 1 : 0;
      default:
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }
  }

  adjustForUserProfile(probability, features, profile, naicsEvidence = this.evaluateNaicsEvidence(profile, features.naicsCode)) {
    let adjusted = probability;
    
    // Only an exact six-digit code receives the full adjustment. A shared NAICS
    // industry prefix is related context, not proof of registration or eligibility.
    if (naicsEvidence.status === 'exact') {
      adjusted += 0.12;
    } else if (naicsEvidence.status === 'related') {
      adjusted += naicsEvidence.sharedPrefixLength === 5 ? 0.04 : 0.02;
    } else if (naicsEvidence.status === 'mismatch') {
      adjusted -= 0.12;
    } else if (naicsEvidence.status === 'unverified') {
      adjusted -= 0.08;
    }
    
    // Adjust based on past performance with agency
    if (profile.agencyRelationships && profile.agencyRelationships.includes(features.agencyType)) {
      adjusted += 0.10;
    }
    
    // Adjust based on certifications
    if (profile.certifications && profile.certifications.includes(features.setAsideType)) {
      adjusted += 0.20;
    }
    
    return adjusted;
  }

  applyNaicsEvidenceGuardrail(probability, naicsEvidence) {
    const ceilings = {
      related: 0.79,
      mismatch: 0.59,
      unverified: 0.69,
      unavailable: 0.69
    };
    const ceiling = ceilings[naicsEvidence.status];
    return ceiling === undefined ? probability : Math.min(probability, ceiling);
  }

  identifyKeyFactors(features, userContext, naicsEvidence = this.evaluateNaicsEvidence(userContext.companyProfile || {}, features.naicsCode)) {
    const factors = [naicsEvidence.rationale];
    
    if (features.setAsideType && features.setAsideType !== 'NONE') {
      factors.push(`Set-aside designation: ${features.setAsideType}`);
    }
    
    if (features.contractSize <= 2) {
      factors.push('Smaller contract size - less competition');
    }
    
    if (features.postingDuration > 20) {
      factors.push('Long posting duration - more preparation time');
    }
    
    if (features.hasAttachments) {
      factors.push('Detailed requirements available');
    }
    
    return factors;
  }

  generateRecommendations(features, probability, userContext, naicsEvidence = this.evaluateNaicsEvidence(userContext.companyProfile || {}, features.naicsCode)) {
    const recommendations = [];

    if (naicsEvidence.status === 'unverified') {
      recommendations.push('Verify and save the company\'s current six-digit NAICS codes before relying on this score');
    } else if (naicsEvidence.status === 'mismatch') {
      recommendations.push(`Confirm the company is qualified to pursue NAICS ${naicsEvidence.contractCode}; no saved company code matches it`);
    } else if (naicsEvidence.status === 'related') {
      recommendations.push(`Validate exact NAICS ${naicsEvidence.contractCode}; the saved code ${naicsEvidence.relatedProfileCode} is related but is not an exact match`);
    }
    
    if (probability < 40) {
      recommendations.push('Consider partnering with experienced contractors');
      recommendations.push('Focus on smaller contracts to build track record');
    } else if (probability < 60) {
      recommendations.push('Enhance proposal with case studies and past performance');
      recommendations.push('Consider set-aside certifications if applicable');
    } else {
      recommendations.push('Strong position - focus on competitive pricing');
      recommendations.push('Emphasize unique value propositions');
    }
    
    if (features.postingDuration < 7) {
      recommendations.push('Act quickly - limited response time');
    }
    
    return recommendations;
  }

  calculateConfidence(features, userContext = {}, naicsEvidence = this.evaluateNaicsEvidence(userContext.companyProfile || {}, features.naicsCode)) {
    // Confidence reflects supplied evidence, not defaults inserted by the heuristic.
    const weightedFeatures = Object.keys(this.model?.weights || this.getDefaultModel().weights);
    const contractEvidenceCount = weightedFeatures.filter(key => features.evidenceAvailability?.[key]).length;
    const contractCoverage = weightedFeatures.length
      ? contractEvidenceCount / weightedFeatures.length
      : 0;

    const profile = userContext.companyProfile || {};
    const profileEvidence = [
      naicsEvidence.profileCodes.length > 0,
      Array.isArray(profile.certifications) && profile.certifications.length > 0,
      Array.isArray(profile.agencyRelationships) && profile.agencyRelationships.length > 0,
      Array.isArray(profile.pastWins) && profile.pastWins.length > 0,
      Number(profile.annualRevenue) > 0,
      typeof profile.hasBonding === 'boolean'
    ];
    const profileCoverage = profileEvidence.filter(Boolean).length / profileEvidence.length;
    let confidence = Math.round(((contractCoverage * 0.65) + (profileCoverage * 0.35)) * 100);

    const ceilings = {
      exact: 95,
      related: 80,
      mismatch: 70,
      unverified: 55,
      unavailable: 55
    };
    confidence = Math.min(confidence, ceilings[naicsEvidence.status] ?? 80);
    return Math.max(0, confidence);
  }

  normalizeNaicsCode(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    const compact = text.replace(/[\s-]+/g, '');
    if (/^\d{6}$/.test(compact)) return compact;

    const match = /(?:^|\D)(\d{6})(?!\d)/.exec(text);
    return match ? match[1] : null;
  }

  extractNaicsCodes(value) {
    if (Array.isArray(value)) return value.flatMap(item => this.extractNaicsCodes(item));
    if (value === undefined || value === null) return [];

    const text = String(value).trim();
    const exact = this.normalizeNaicsCode(text);
    if (exact && /^[\d\s-]+$/.test(text)) return [exact];

    const codes = [];
    const pattern = /(?:^|\D)(\d{6})(?!\d)/g;
    let match;
    while ((match = pattern.exec(text)) !== null) codes.push(match[1]);
    return codes;
  }

  normalizeProfileNaicsCodes(profile = {}) {
    const candidates = [
      profile.experienceInNaics,
      profile.naicsCodes,
      profile.naics_codes,
      profile.basicInfo?.naicsCode,
      profile.basicInfo?.naicsCodes
    ];
    return [...new Set(candidates.flatMap(value => this.extractNaicsCodes(value)))];
  }

  evaluateNaicsEvidence(profile = {}, contractNaics) {
    const contractCode = this.normalizeNaicsCode(contractNaics);
    const profileCodes = this.normalizeProfileNaicsCodes(profile);

    if (!contractCode) {
      return {
        status: 'unavailable',
        exactMatch: false,
        contractCode: null,
        profileCodes,
        relatedProfileCode: null,
        sharedPrefixLength: 0,
        score: 0,
        rationale: 'NAICS evidence unavailable: the opportunity does not provide a valid six-digit NAICS code.'
      };
    }

    if (profileCodes.length === 0) {
      return {
        status: 'unverified',
        exactMatch: false,
        contractCode,
        profileCodes,
        relatedProfileCode: null,
        sharedPrefixLength: 0,
        score: 0,
        rationale: `NAICS verification pending: no valid six-digit company NAICS code is saved for opportunity ${contractCode}.`
      };
    }

    if (profileCodes.includes(contractCode)) {
      return {
        status: 'exact',
        exactMatch: true,
        contractCode,
        profileCodes,
        relatedProfileCode: contractCode,
        sharedPrefixLength: 6,
        score: 1,
        rationale: `Exact NAICS match: the company profile includes opportunity code ${contractCode}.`
      };
    }

    const fiveDigitRelated = profileCodes.find(code => code.slice(0, 5) === contractCode.slice(0, 5));
    const fourDigitRelated = profileCodes.find(code => code.slice(0, 4) === contractCode.slice(0, 4));
    const relatedProfileCode = fiveDigitRelated || fourDigitRelated;
    if (relatedProfileCode) {
      const sharedPrefixLength = fiveDigitRelated ? 5 : 4;
      return {
        status: 'related',
        exactMatch: false,
        contractCode,
        profileCodes,
        relatedProfileCode,
        sharedPrefixLength,
        score: sharedPrefixLength === 5 ? 0.4 : 0.2,
        rationale: `Related NAICS only: saved code ${relatedProfileCode} shares the ${sharedPrefixLength}-digit industry prefix with ${contractCode}; this is not an exact eligibility match.`
      };
    }

    return {
      status: 'mismatch',
      exactMatch: false,
      contractCode,
      profileCodes,
      relatedProfileCode: null,
      sharedPrefixLength: 0,
      score: 0,
      rationale: `NAICS mismatch: no saved six-digit company code matches opportunity ${contractCode}.`
    };
  }

  // Helper methods
  getAgencySize(agency) {
    const largeAgencies = ['DEFENSE', 'ARMY', 'NAVY', 'AIR FORCE', 'DHS'];
    const mediumAgencies = ['GSA', 'NASA', 'EPA', 'FEMA'];
    
    const agencyUpper = String(agency || '').toUpperCase();
    if (largeAgencies.some(a => agencyUpper.includes(a))) return 10;
    if (mediumAgencies.some(a => agencyUpper.includes(a))) return 7;
    return 5;
  }

  getAgencyType(agency) {
    const agencyUpper = String(agency || '').toUpperCase();
    if (agencyUpper.includes('DEFENSE') || agencyUpper.includes('ARMY') || agencyUpper.includes('NAVY')) {
      return 'DEFENSE';
    }
    if (agencyUpper.includes('CIVILIAN')) return 'CIVILIAN';
    return 'OTHER';
  }

  categorizeContractSize(amount) {
    if (!amount) return 3;
    const numAmount = parseFloat(amount.toString().replace(/[^0-9.]/g, ''));
    
    if (numAmount < 50000) return 1;
    if (numAmount < 250000) return 2;
    if (numAmount < 1000000) return 3;
    if (numAmount < 5000000) return 4;
    return 5;
  }

  hasPositiveAmount(amount) {
    if (amount === undefined || amount === null || amount === '') return false;
    const parsed = Number.parseFloat(String(amount).replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0;
  }

  hasValidDate(value) {
    if (!value) return false;
    return Number.isFinite(new Date(value).getTime());
  }

  getNaicsCategory(naicsCode) {
    if (!naicsCode) return 'OTHER';
    const prefix = naicsCode.substring(0, 2);
    
    const categories = {
      '54': 'PROFESSIONAL',
      '23': 'CONSTRUCTION',
      '33': 'MANUFACTURING',
      '51': 'INFORMATION',
      '62': 'HEALTHCARE'
    };
    
    return categories[prefix] || 'OTHER';
  }

  calculatePostingDuration(postedDate, responseDeadline) {
    if (!postedDate || !responseDeadline) return 15;
    
    const posted = new Date(postedDate);
    const deadline = new Date(responseDeadline);
    const duration = Math.ceil((deadline - posted) / (1000 * 60 * 60 * 24));
    
    return Math.max(1, duration);
  }

  countKeywords(text) {
    if (!text) return 0;
    const keywords = ['security', 'technology', 'system', 'software', 'digital', 'IT', 'network'];
    const textLower = text.toLowerCase();
    return keywords.filter(k => textLower.includes(k)).length;
  }

  isRenewalOpportunity(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    const renewalTerms = ['renewal', 'extension', 'continue', 'ongoing', 'follow-on'];
    return renewalTerms.some(term => text.includes(term)) ? 1 : 0;
  }

  getDefaultModel() {
    return {
      weights: {
        agencySize: 0.15,
        contractSize: 0.20,
        setAsideType: 0.25,
        postingDuration: -0.10,
        keywordCount: 0.05,
        hasAttachments: 0.15
      },
      baseline: 0.3,
      trainingSize: 0
    };
  }
}

module.exports = new WinProbabilityPredictor();
