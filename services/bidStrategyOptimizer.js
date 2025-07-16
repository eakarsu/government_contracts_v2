const { PrismaClient } = require('@prisma/client');
const winProbabilityPredictor = require('./mlWinProbability');
const contractSimilarity = require('./contractSimilarity');

// Use shared Prisma client instance
const prisma = new PrismaClient();

class BidStrategyOptimizer {
  constructor() {
    this.marketData = new Map();
  }

  async optimizeBidStrategy(contract, userContext = {}) {
    try {
      // Gather comprehensive market data
      const marketData = await this.gatherMarketData(contract);
      
      // Analyze competition
      const competitionAnalysis = await this.analyzeCompetition(contract);
      
      // Calculate optimal pricing
      const pricingStrategy = await this.calculateOptimalPricing(contract, marketData, userContext);
      
      // Generate strategic recommendations
      const recommendations = await this.generateStrategicRecommendations(
        contract, 
        marketData, 
        competitionAnalysis, 
        userContext
      );
      
      // Create timeline and resource plan
      const executionPlan = await this.createExecutionPlan(contract, userContext);

      return {
        pricingStrategy,
        competitionAnalysis,
        recommendations,
        executionPlan,
        riskAssessment: this.assessRisks(contract, marketData, userContext),
        successMetrics: this.defineSuccessMetrics(contract)
      };
    } catch (error) {
      console.error('Error optimizing bid strategy:', error);
      return this.getDefaultStrategy();
    }
  }

  async gatherMarketData(contract) {
    // Find similar contracts for market analysis
    const similarContracts = await contractSimilarity.findSimilarContracts(contract, 20);
    
    // Analyze pricing trends
    const pricingData = await this.analyzePricingTrends(similarContracts.matches);
    
    // Analyze award patterns - simplified without award data
    const awardPatterns = this.analyzeAwardPatterns(similarContracts.matches);
    
    // Get agency spending data - simplified
    const agencyData = this.getSimplifiedAgencyData(contract.agency);

    return {
      similarContracts: similarContracts.matches,
      pricingData,
      awardPatterns,
      agencyData,
      marketSize: this.estimateMarketSize(similarContracts.matches),
      growthRate: this.calculateMarketGrowth(similarContracts.matches)
    };
  }

  estimateMarketSize(contracts) {
    return contracts.length * 50000; // Simplified estimation
  }

  calculateMarketGrowth(contracts) {
    return 5; // Default 5% growth rate
  }

  async analyzePricingTrends(similarContracts) {
    // Simplified pricing analysis without award data
    return {
      medianPrice: null,
      priceRange: { min: null, max: null },
      averagePrice: null,
      priceDistribution: [],
      trends: [],
      note: 'Pricing data not available in current schema'
    };
  }

  analyzeAwardPatterns(similarContracts) {
    // Simplified award pattern analysis
    return {
      totalContracts: similarContracts.length,
      recentContracts: similarContracts.filter(c => {
        const postedDate = new Date(c.postedDate);
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        return postedDate >= sixMonthsAgo;
      }).length,
      note: 'Award data not available in current schema'
    };
  }

  async analyzeCompetition(contract) {
    // Estimate number of potential bidders
    const similarContracts = await contractSimilarity.findSimilarContracts(contract, 15);
    
    const bidderEstimates = this.estimateBidderCount(similarContracts.matches);
    const competitorProfiles = await this.identifyKeyCompetitors(contract);
    
    return {
      estimatedBidders: bidderEstimates.average,
      bidderRange: bidderEstimates.range,
      keyCompetitors: competitorProfiles,
      competitiveIntensity: this.calculateCompetitiveIntensity(similarContracts.matches),
      marketShare: await this.calculateMarketShare(contract),
      barriersToEntry: this.identifyBarriersToEntry(contract)
    };
  }

  async calculateOptimalPricing(contract, marketData, userContext) {
    const contractValue = this.parseAmount(contract.awardAmount);
    const marketMedian = marketData.pricingData.medianPrice;
    
    // Base pricing strategy
    let basePrice = marketMedian || contractValue;
    
    // Adjust for user capabilities
    const capabilityMultiplier = this.calculateCapabilityMultiplier(userContext, contract);
    
    // Adjust for competition
    const competitionMultiplier = this.calculateCompetitionMultiplier(marketData.competitionAnalysis || { estimatedBidders: 5 });
    
    // Risk adjustment
    const riskMultiplier = this.calculateRiskMultiplier(contract, userContext);
    
    const optimalPrice = basePrice * capabilityMultiplier * competitionMultiplier * riskMultiplier;
    
    return {
      recommendedPrice: Math.round(optimalPrice),
      priceRange: {
        conservative: Math.round(optimalPrice * 0.85),
        aggressive: Math.round(optimalPrice * 1.15)
      },
      pricingJustification: this.generatePricingJustification(
        optimalPrice, 
        basePrice, 
        marketData, 
        userContext
      ),
      sensitivityAnalysis: this.analyzePriceSensitivity(optimalPrice, marketData),
      profitMargin: this.calculateProfitMargin(optimalPrice, contract, userContext)
    };
  }

  async generateStrategicRecommendations(contract, marketData, competition, userContext) {
    const recommendations = [];

    // Pricing recommendations
    if (competition.estimatedBidders > 5) {
      recommendations.push({
        type: 'pricing',
        title: 'Competitive Pricing Strategy',
        description: `With ${competition.estimatedBidders} estimated competitors, consider pricing 5-10% below market median`,
        impact: 'high',
        action: 'adjust_pricing'
      });
    }

    // Technical approach recommendations
    if (contract.description && contract.description.includes('innovative' || 'cutting-edge')) {
      recommendations.push({
        type: 'technical',
        title: 'Emphasize Innovation',
        description: 'Focus on innovative solutions and past performance with similar technologies',
        impact: 'medium',
        action: 'highlight_innovation'
      });
    }

    // Past performance recommendations
    const similarWins = await this.findSimilarPastWins(contract, userContext);
    if (similarWins && similarWins.length > 0) {
      recommendations.push({
        type: 'past_performance',
        title: 'Leverage Relevant Experience',
        description: `Reference ${similarWins.length} similar successful contracts in your proposal`,
        impact: 'high',
        action: 'showcase_experience'
      });
    }

    // Team recommendations
    if (contract.setAsideCode) {
      recommendations.push({
        type: 'team',
        title: 'Team Composition',
        description: `Ensure team meets ${contract.setAsideCode} requirements and highlight relevant certifications`,
        impact: 'high',
        action: 'verify_certifications'
      });
    }

    // Timeline recommendations
    const timeline = this.estimateTimeline(contract);
    if (timeline.daysUntilDeadline <= 14) {
      recommendations.push({
        type: 'timeline',
        title: 'Accelerated Response',
        description: `Tight deadline requires immediate action - ${timeline.daysUntilDeadline} days remaining`,
        impact: 'critical',
        action: 'prioritize_response'
      });
    }

    return recommendations;
  }

  async createExecutionPlan(contract, userContext) {
    const timeline = this.estimateTimeline(contract);
    
    return {
      phases: [
        {
          name: 'Initial Assessment',
          duration: 1,
          tasks: ['Review requirements', 'Assess capabilities', 'Identify gaps'],
          dependencies: []
        },
        {
          name: 'Market Research',
          duration: 2,
          tasks: ['Competition analysis', 'Pricing research', 'Past win analysis'],
          dependencies: ['Initial Assessment']
        },
        {
          name: 'Proposal Development',
          duration: Math.max(3, Math.floor(timeline.daysUntilDeadline * 0.6)),
          tasks: ['Technical approach', 'Past performance', 'Management plan', 'Pricing strategy'],
          dependencies: ['Market Research']
        },
        {
          name: 'Review & Finalization',
          duration: 1,
          tasks: ['Quality review', 'Compliance check', 'Final pricing', 'Submission'],
          dependencies: ['Proposal Development']
        }
      ],
      resourceAllocation: this.allocateResources(contract, userContext),
      keyMilestones: this.defineMilestones(timeline),
      riskMitigation: this.identifyRisks(contract, timeline)
    };
  }

  assessRisks(contract, marketData, userContext) {
    const risks = [];

    // Technical risks
    if (contract.description && contract.description.includes('complex' || 'advanced')) {
      risks.push({
        category: 'technical',
        level: 'medium',
        description: 'Complex technical requirements may exceed current capabilities',
        mitigation: 'Consider technical partnerships or subcontracting'
      });
    }

    // Financial risks
    const contractValue = this.parseAmount(contract.awardAmount);
    if (contractValue > (userContext.annualRevenue || 0) * 0.3) {
      risks.push({
        category: 'financial',
        level: 'high',
        description: 'Contract value represents significant portion of annual revenue',
        mitigation: 'Ensure adequate bonding and cash flow'
      });
    }

    // Competition risks
    if (marketData.competitionAnalysis?.estimatedBidders > 8) {
      risks.push({
        category: 'competitive',
        level: 'high',
        description: 'High competition may drive prices down',
        mitigation: 'Focus on differentiation and value proposition'
      });
    }

    // Timeline risks
    const timeline = this.estimateTimeline(contract);
    if (timeline.daysUntilDeadline <= 7) {
      risks.push({
        category: 'timeline',
        level: 'critical',
        description: 'Insufficient time for thorough proposal preparation',
        mitigation: 'Consider requesting extension or no-bid'
      });
    }

    return risks;
  }

  defineSuccessMetrics(contract) {
    return {
      primary: {
        metric: 'win_probability',
        target: 30, // 30% win rate
        measurement: 'successful_awards'
      },
      secondary: [
        {
          metric: 'profit_margin',
          target: 15, // 15% profit margin
          measurement: 'gross_profit_percentage'
        },
        {
          metric: 'response_time',
          target: 90, // 90% on-time submissions
          measurement: 'deadline_compliance'
        },
        {
          metric: 'quality_score',
          target: 85, // 85% quality rating
          measurement: 'evaluation_scores'
        }
      ]
    };
  }

  getSimplifiedAgencyData(agency) {
    return {
      name: agency,
      contractCount: 0,
      totalSpending: 0,
      averageContractValue: 0,
      growthRate: 5,
      note: 'Detailed agency data not available'
    };
  }

  async findSimilarPastWins(contract, userContext) {
    // Simplified implementation - return empty array since we don't have historical win data
    return [];
  }

  // Helper methods
  calculatePriceDistribution(prices) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    
    const distribution = {
      low: prices.filter(p => p <= min + range * 0.25).length,
      medium: prices.filter(p => p > min + range * 0.25 && p <= min + range * 0.75).length,
      high: prices.filter(p => p > min + range * 0.75).length
    };
    
    return distribution;
  }

  calculateCapabilityMultiplier(userContext, contract) {
    let multiplier = 1.0;
    
    // Experience in NAICS code
    if (userContext.experienceInNaics?.includes(contract.naicsCode)) {
      multiplier *= 1.1;
    }
    
    // Past performance with agency
    if (userContext.agencyRelationships?.includes(contract.agency)) {
      multiplier *= 1.15;
    }
    
    // Certifications
    if (userContext.certifications?.includes(contract.setAsideCode)) {
      multiplier *= 1.2;
    }
    
    return multiplier;
  }

  calculateCompetitionMultiplier(competitionAnalysis) {
    const bidderCount = competitionAnalysis?.estimatedBidders || 5;
    
    if (bidderCount <= 3) return 1.1;
    if (bidderCount <= 5) return 1.0;
    if (bidderCount <= 8) return 0.95;
    if (bidderCount <= 12) return 0.9;
    return 0.85;
  }

  calculateRiskMultiplier(contract, userContext) {
    let multiplier = 1.0;
    
    // Financial risk
    const contractValue = this.parseAmount(contract.awardAmount);
    if (contractValue > (userContext.annualRevenue || 0) * 0.5) {
      multiplier *= 0.9;
    }
    
    // Timeline risk
    const timeline = this.estimateTimeline(contract);
    if (timeline.daysUntilDeadline <= 7) {
      multiplier *= 0.95;
    }
    
    return multiplier;
  }

  generatePricingJustification(price, basePrice, marketData, userContext) {
    const justifications = [];
    
    if (price < basePrice) {
      justifications.push('Competitive pricing based on market analysis');
    }
    
    if (price > basePrice) {
      justifications.push('Premium pricing justified by unique capabilities');
    }
    
    if (marketData.pricingData.medianPrice) {
      const diff = ((price - marketData.pricingData.medianPrice) / marketData.pricingData.medianPrice) * 100;
      justifications.push(`${diff.toFixed(1)}% ${diff > 0 ? 'above' : 'below'} market median`);
    }
    
    return justifications;
  }

  analyzePriceSensitivity(price, marketData) {
    const median = marketData.pricingData.medianPrice;
    if (!median) return { impact: 'unknown' };
    
    const deviation = Math.abs(price - median) / median;
    
    return {
      impact: deviation <= 0.1 ? 'low' : deviation <= 0.2 ? 'medium' : 'high',
      probabilityImpact: Math.max(0, 100 - (deviation * 200)),
      priceElasticity: this.calculatePriceElasticity(marketData)
    };
  }

  calculateProfitMargin(price, contract, userContext) {
    // Simplified profit margin calculation
    const estimatedCost = price * 0.75; // Assume 75% cost base
    const profit = price - estimatedCost;
    return (profit / price) * 100;
  }

  estimateBidderCount(similarContracts) {
    const awardedContracts = similarContracts.filter(c => c.contract.awardedTo);
    
    if (awardedContracts.length === 0) {
      return { average: 5, range: { min: 3, max: 8 } };
    }
    
    // Simple estimation based on historical data
    const avgBidders = Math.max(3, Math.min(12, awardedContracts.length / 2));
    
    return {
      average: Math.round(avgBidders),
      range: {
        min: Math.max(2, Math.round(avgBidders * 0.6)),
        max: Math.min(15, Math.round(avgBidders * 1.4))
      }
    };
  }

  identifyKeyCompetitors(contract) {
    // This would integrate with competitor database
    return [
      {
        name: 'Major Competitor A',
        strength: 'high',
        specialties: [contract.naicsCode],
        marketShare: 25
      },
      {
        name: 'Regional Competitor B',
        strength: 'medium',
        specialties: [contract.agency],
        marketShare: 15
      }
    ];
  }

  calculateCompetitiveIntensity(similarContracts) {
    const awardedCount = similarContracts.filter(c => c.contract.awardedTo).length;
    return Math.min(100, (awardedCount / similarContracts.length) * 100);
  }

  calculateMarketShare(contract) {
    // Simplified market share calculation
    return {
      yourShare: 5, // This would come from historical data
      marketSize: this.estimateMarketSize([]),
      growthRate: 10
    };
  }

  identifyBarriersToEntry(contract) {
    const barriers = [];
    
    if (contract.setAsideCode) {
      barriers.push({
        type: 'certification',
        description: `${contract.setAsideCode} certification required`,
        difficulty: 'medium'
      });
    }
    
    if (contract.description?.includes('security clearance')) {
      barriers.push({
        type: 'clearance',
        description: 'Security clearance requirements',
        difficulty: 'high'
      });
    }
    
    return barriers;
  }

  allocateResources(contract, userContext) {
    const effort = this.estimateEffort(contract);
    
    return {
      estimatedHours: effort,
      teamSize: Math.max(2, Math.min(8, Math.ceil(effort / 40))),
      keyRoles: this.identifyKeyRoles(contract),
      externalResources: this.identifyExternalNeeds(contract, userContext)
    };
  }

  estimateEffort(contract) {
    const baseEffort = 40; // Base 40 hours
    const complexity = this.estimateComplexity(contract);
    
    return baseEffort * complexity;
  }

  estimateComplexity(contract) {
    let complexity = 1.0;
    
    if (contract.description?.length > 1000) complexity *= 1.5;
    if (contract.setAsideCode) complexity *= 1.2;
    
    return complexity;
  }

  identifyKeyRoles(contract) {
    return [
      'Project Manager',
      'Technical Lead',
      'Compliance Specialist',
      'Pricing Analyst'
    ];
  }

  identifyExternalNeeds(contract, userContext) {
    const needs = [];
    
    if (!userContext.hasBonding) {
      needs.push('Performance bond');
    }
    
    return needs;
  }

  defineMilestones(timeline) {
    return [
      { name: 'Go/No-Go Decision', date: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      { name: 'Strategy Finalization', date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
      { name: 'First Draft Complete', date: new Date(Date.now() + (timeline.daysUntilDeadline * 0.5 * 24 * 60 * 60 * 1000)) },
      { name: 'Final Review', date: new Date(timeline.responseDeadline.getTime() - 2 * 24 * 60 * 60 * 1000) },
      { name: 'Submission', date: new Date(timeline.responseDeadline) }
    ];
  }

  identifyRisks(contract, timeline) {
    const risks = [];
    
    if (timeline.daysUntilDeadline <= 7) {
      risks.push('Insufficient preparation time');
    }
    
    return risks;
  }

  parseAmount(amount) {
    if (!amount) return 0;
    
    const str = amount.toString().toUpperCase();
    let num = parseFloat(str.replace(/[^0-9.]/g, ''));
    
    if (str.includes('K')) num *= 1000;
    if (str.includes('M')) num *= 1000000;
    if (str.includes('B')) num *= 1000000000;
    
    return num || 0;
  }

  estimateTimeline(contract) {
    if (!contract.responseDeadline) {
      return { daysUntilDeadline: 30, responseDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
    }
    
    const now = new Date();
    const deadline = new Date(contract.responseDeadline);
    const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 1000));
    
    return { daysUntilDeadline, responseDeadline: deadline };
  }

  getDefaultStrategy() {
    return {
      pricingStrategy: {
        recommendedPrice: 0,
        priceRange: { conservative: 0, aggressive: 0 },
        pricingJustification: ['Default strategy applied']
      },
      recommendations: [],
      executionPlan: { phases: [], resourceAllocation: {} },
      riskAssessment: [],
      successMetrics: {}
    };
  }
}

module.exports = new BidStrategyOptimizer();