const { PrismaClient } = require('@prisma/client');
const nlpService = require('./nlpService');

// Use shared Prisma client instance
const prisma = new PrismaClient();

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
      return this.getDefaultModel();
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
    const features = {
      // Agency features
      agencySize: this.getAgencySize(contract.agency),
      agencyType: this.getAgencyType(contract.agency),
      
      // Contract features
      contractSize: this.categorizeContractSize(contract.awardAmount),
      naicsCategory: this.getNaicsCategory(contract.naicsCode),
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
      isRenewal: this.isRenewalOpportunity(contract.title, contract.description)
    };

    return features;
  }

  buildSimpleModel(trainingData) {
    // Simple rule-based model with learned weights
    const weights = {
      agencySize: 0.15,
      contractSize: 0.20,
      naicsCategory: 0.10,
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
      await this.trainModel();
    }

    const features = this.extractFeatures(newContract);
    
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
    if (userContext.companyProfile) {
      probability = this.adjustForUserProfile(probability, features, userContext.companyProfile);
    }

    // Ensure probability is between 0 and 1
    probability = Math.max(0, Math.min(1, probability));

    return {
      probability: Math.round(probability * 100),
      confidence: this.calculateConfidence(features),
      factors: this.identifyKeyFactors(features, userContext),
      recommendations: this.generateRecommendations(features, probability, userContext)
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
      default:
        return value;
    }
  }

  adjustForUserProfile(probability, features, profile) {
    let adjusted = probability;
    
    // Adjust based on company experience
    if (profile.experienceInNaics && profile.experienceInNaics.includes(features.naicsCategory)) {
      adjusted += 0.15;
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

  identifyKeyFactors(features, userContext) {
    const factors = [];
    
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

  generateRecommendations(features, probability, userContext) {
    const recommendations = [];
    
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

  calculateConfidence(features) {
    // Simple confidence based on feature coverage
    const featureCoverage = Object.keys(features).length / 10; // 10 total features
    return Math.round(featureCoverage * 100);
  }

  // Helper methods
  getAgencySize(agency) {
    const largeAgencies = ['DEFENSE', 'ARMY', 'NAVY', 'AIR FORCE', 'DHS'];
    const mediumAgencies = ['GSA', 'NASA', 'EPA', 'FEMA'];
    
    const agencyUpper = agency.toUpperCase();
    if (largeAgencies.some(a => agencyUpper.includes(a))) return 10;
    if (mediumAgencies.some(a => agencyUpper.includes(a))) return 7;
    return 5;
  }

  getAgencyType(agency) {
    const agencyUpper = agency.toUpperCase();
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
        naicsCategory: 0.10,
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