const { PrismaClient } = require('@prisma/client');
const winProbabilityPredictor = require('./mlWinProbability');
const contractSimilarity = require('./contractSimilarity');
const nlpService = require('./nlpService');

// Use shared Prisma client instance
const prisma = new PrismaClient();

class AIOpportunityAlerts {
  constructor() {
    this.alertRules = new Map();
    this.userPreferences = new Map();
  }

  // Main method to generate personalized alerts
  async generateOpportunityAlerts(userId, userContext = {}) {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(userId, userContext);
      
      // Find matching opportunities
      const opportunities = await this.findMatchingOpportunities(preferences);
      
      // Score and rank opportunities
      const scoredOpportunities = await this.scoreOpportunities(opportunities, preferences);
      
      // Filter high-value alerts
      const alerts = this.filterHighValueAlerts(scoredOpportunities, preferences);
      
      // Generate personalized messages
      const personalizedAlerts = await this.personalizeAlerts(alerts, preferences);
      
      return {
        alerts: personalizedAlerts,
        summary: this.generateAlertSummary(personalizedAlerts),
        recommendations: this.generateAlertRecommendations(personalizedAlerts)
      };
    } catch (error) {
      console.error('Error generating opportunity alerts:', error);
      return { alerts: [], summary: {}, recommendations: [] };
    }
  }

  async getUserPreferences(userId, userContext) {
    // Try to get from database first (if table exists)
    let preferences = null;
    try {
      preferences = await prisma.userPreference.findUnique({
        where: { userId }
      }).catch(() => null);
    } catch (error) {
      // Table doesn't exist, use context-based preferences
      console.warn('UserPreference table not found, using context-based preferences');
    }

    // Fall back to context-based preferences
    if (!preferences) {
      preferences = this.inferPreferencesFromContext(userContext);
    }

    return {
      ...preferences,
      ...userContext,
      thresholds: {
        minWinProbability: 30,
        minRelevanceScore: 70,
        maxAgeDays: 7,
        minContractValue: userContext.minContractValue || 0
      }
    };
  }

  async findMatchingOpportunities(preferences) {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (preferences.thresholds.maxAgeDays * 24 * 60 * 60 * 1000));

    let whereClause = {
      postedDate: { gte: cutoffDate }
    };

    // Apply filters based on preferences
    if (preferences.preferredNaicsCodes?.length > 0) {
      whereClause.naicsCode = { in: preferences.preferredNaicsCodes };
    }

    if (preferences.preferredAgencies?.length > 0) {
      whereClause.agency = { in: preferences.preferredAgencies };
    }

    if (preferences.preferredStates?.length > 0) {
      whereClause.OR = [
        { agency: { contains: preferences.preferredStates.join('|') } }
      ];
    }

    if (preferences.thresholds.minContractValue > 0) {
      whereClause.awardAmount = { gte: preferences.thresholds.minContractValue.toString() };
    }

    if (preferences.certifications?.length > 0) {
      whereClause.setAsideCode = { in: preferences.certifications };
    }

    // Keywords search
    if (preferences.keywords?.length > 0) {
      whereClause.OR = whereClause.OR || [];
      preferences.keywords.forEach(keyword => {
        whereClause.OR.push(
          { title: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } }
        );
      });
    }

    const opportunities = await prisma.contract.findMany({
      where: whereClause,
      orderBy: { postedDate: 'desc' },
      take: 100 // Limit initial results
    });

    return opportunities;
  }

  async scoreOpportunities(opportunities, preferences) {
    const scoredOpportunities = [];

    for (const opportunity of opportunities) {
      const scores = await this.calculateOpportunityScores(opportunity, preferences);
      
      scoredOpportunities.push({
        opportunity,
        ...scores,
        overallScore: this.calculateOverallScore(scores)
      });
    }

    return scoredOpportunities.sort((a, b) => b.overallScore - a.overallScore);
  }

  async calculateOpportunityScores(opportunity, preferences) {
    const scores = {};

    // Calculate win probability
    const winProbability = await winProbabilityPredictor.predictWinProbability(
      opportunity, 
      { companyProfile: preferences }
    );
    scores.winProbability = winProbability.probability;

    // Calculate relevance to user preferences
    scores.relevance = this.calculateRelevanceScore(opportunity, preferences);

    // Calculate urgency based on deadline
    scores.urgency = this.calculateUrgencyScore(opportunity);

    // Calculate value score
    scores.value = this.calculateValueScore(opportunity);

    // Calculate competition level
    scores.competition = await this.estimateCompetitionLevel(opportunity);

    return scores;
  }

  calculateRelevanceScore(opportunity, preferences) {
    let score = 0;
    let factors = 0;

    // NAICS code match
    if (preferences.preferredNaicsCodes?.includes(opportunity.naicsCode)) {
      score += 30;
      factors++;
    }

    // Agency match
    if (preferences.preferredAgencies?.includes(opportunity.agency)) {
      score += 25;
      factors++;
    }

    // State match
    if (preferences.preferredStates?.some(state => 
      opportunity.agency.toLowerCase().includes(state.toLowerCase()))) {
      score += 20;
      factors++;
    }

    // Keywords match
    if (preferences.keywords?.length > 0) {
      const text = (opportunity.title + ' ' + opportunity.description).toLowerCase();
      const keywordMatches = preferences.keywords.filter(keyword =
        text.includes(keyword.toLowerCase()));
      score += (keywordMatches.length * 10);
      factors += keywordMatches.length;
    }

    // Certification match
    if (preferences.certifications?.includes(opportunity.setAsideCode)) {
      score += 15;
      factors++;
    }

    return Math.min(score, 100);
  }

  calculateUrgencyScore(opportunity) {
    // Since responseDeadline is not available, use a default urgency score
    // or calculate based on postedDate age
    const now = new Date();
    const postedDate = new Date(opportunity.postedDate);
    const daysSincePosted = Math.ceil((now - postedDate) / (1000 * 60 * 60 * 24));
    
    // Higher urgency for older posts (assuming 30-day typical response window)
    if (daysSincePosted >= 25) return 100;
    if (daysSincePosted >= 20) return 75;
    if (daysSincePosted >= 15) return 50;
    if (daysSincePosted >= 10) return 25;
    return 10;
  }

  calculateValueScore(opportunity) {
    const amount = this.parseAmount(opportunity.awardAmount);
    
    if (amount >= 1000000) return 100;
    if (amount >= 500000) return 80;
    if (amount >= 100000) return 60;
    if (amount >= 50000) return 40;
    if (amount >= 10000) return 20;
    return 10;
  }

  async estimateCompetitionLevel(opportunity) {
    // Find similar contracts and analyze award patterns
    const similarContracts = await contractSimilarity.findSimilarContracts(opportunity, 10);
    
    if (similarContracts.matches.length === 0) return 50;

    const awardedCount = similarContracts.matches.filter(m => m.contract.awardedTo).length;
    const competitionLevel = ((similarContracts.matches.length - awardedCount) / similarContracts.matches.length) * 100;
    
    return Math.max(10, Math.min(90, competitionLevel));
  }

  calculateOverallScore(scores) {
    const weights = {
      winProbability: 0.30,
      relevance: 0.25,
      urgency: 0.20,
      value: 0.15,
      competition: -0.10 // Lower competition is better
    };

    let overallScore = 0;
    Object.keys(weights).forEach(key => {
      overallScore += (scores[key] || 0) * weights[key];
    });

    return Math.max(0, Math.min(100, overallScore));
  }

  filterHighValueAlerts(scoredOpportunities, preferences) {
    return scoredOpportunities.filter(opportunity => {
      return (
        opportunity.overallScore >= 70 &&
        opportunity.winProbability >= preferences.thresholds.minWinProbability &&
        opportunity.relevance >= preferences.thresholds.minRelevanceScore
      );
    });
  }

  async personalizeAlerts(alerts, preferences) {
    return await Promise.all(alerts.map(async alert => {
      const personalizedAlert = {
        ...alert,
        title: await this.generateAlertTitle(alert),
        message: await this.generateAlertMessage(alert, preferences),
        priority: this.calculateAlertPriority(alert),
        actions: this.generateAlertActions(alert),
        metadata: {
          estimatedTimeline: this.estimateTimeline(alert.opportunity),
          similarWins: await this.findSimilarWins(alert.opportunity, preferences),
          keyRequirements: await this.extractKeyRequirements(alert.opportunity)
        }
      };

      return personalizedAlert;
    }));
  }

  async generateAlertTitle(alert) {
    const urgency = alert.urgency >= 75 ? 'Urgent' : 'New';
    const value = this.formatCurrency(this.parseAmount(alert.opportunity.awardAmount));
    
    return `${urgency}: ${alert.opportunity.title} - ${value}`;
  }

  async generateAlertMessage(alert, preferences) {
    const messages = [];
    
    // Win probability message
    if (alert.winProbability >= 70) {
      messages.push(`High win probability (${alert.winProbability}%) based on your profile`);
    } else if (alert.winProbability >= 50) {
      messages.push(`Moderate win probability (${alert.winProbability}%)`);
    }

    // Relevance message
    if (alert.relevance >= 80) {
      messages.push('Strong match for your capabilities');
    } else if (alert.relevance >= 60) {
      messages.push('Good alignment with your expertise');
    }

    // Age message (since deadline is not available)
    const daysSincePosted = this.getDaysSincePosted(alert.opportunity);
    if (daysSincePosted <= 3) {
      messages.push(`Recently posted (${daysSincePosted} days ago)`);
    } else if (daysSincePosted <= 7) {
      messages.push(`Posted ${daysSincePosted} days ago`);
    }

    // Competition message
    if (alert.competition <= 30) {
      messages.push('Low competition expected');
    } else if (alert.competition >= 70) {
      messages.push('High competition expected');
    }

    return messages.join('. ');
  }

  calculateAlertPriority(alert) {
    if (alert.urgency >= 90 && alert.winProbability >= 80) return 'critical';
    if (alert.winProbability >= 70 && alert.relevance >= 80) return 'high';
    if (alert.overallScore >= 80) return 'medium';
    return 'low';
  }

  generateAlertActions(alert) {
    const actions = [
      {
        type: 'view_details',
        label: 'View Details',
        action: 'navigate_to_contract'
      }
    ];

    if (alert.winProbability >= 50) {
      actions.push({
        type: 'analyze',
        label: 'Analyze Strategy',
        action: 'analyze_opportunity'
      });
    }

    if (alert.metadata?.similarWins?.length > 0) {
      actions.push({
        type: 'similar',
        label: 'View Similar Wins',
        action: 'show_similar_contracts'
      });
    }

    return actions;
  }

  generateAlertSummary(alerts) {
    return {
      totalAlerts: alerts.length,
      critical: alerts.filter(a => a.priority === 'critical').length,
      high: alerts.filter(a => a.priority === 'high').length,
      medium: alerts.filter(a => a.priority === 'medium').length,
      low: alerts.filter(a => a.priority === 'low').length,
      totalValue: alerts.reduce((sum, a) => sum + this.parseAmount(a.opportunity.awardAmount), 0),
      averageWinProbability: alerts.reduce((sum, a) => sum + a.winProbability, 0) / alerts.length
    };
  }

  generateAlertRecommendations(alerts) {
    const recommendations = [];
    
    const criticalAlerts = alerts.filter(a => a.priority === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push({
        type: 'immediate_action',
        title: 'Review Critical Opportunities',
        description: `${criticalAlerts.length} high-value opportunities need immediate attention`,
        priority: 'critical'
      });
    }

    const highWinAlerts = alerts.filter(a => a.winProbability >= 70);
    if (highWinAlerts.length > 0) {
      recommendations.push({
        type: 'focus',
        title: 'Focus on High-Probability Wins',
        description: `Prioritize ${highWinAlerts.length} opportunities with >70% win probability`,
        priority: 'high'
      });
    }

    return recommendations;
  }

  async estimateTimeline(opportunity) {
    const daysSincePosted = this.getDaysSincePosted(opportunity);
    const estimatedResponseWindow = 30; // Default 30-day response window
    const daysRemaining = Math.max(1, estimatedResponseWindow - daysSincePosted);
    
    return {
      daysSincePosted,
      estimatedDaysRemaining: daysRemaining,
      recommendedStartDate: new Date(),
      draftDeadline: new Date(Date.now() + (daysRemaining * 0.7 * 24 * 60 * 60 * 1000)),
      finalDeadline: new Date(Date.now() + (daysRemaining * 24 * 60 * 60 * 1000))
    };
  }

  async findSimilarWins(opportunity, preferences) {
    const similarContracts = await contractSimilarity.findSimilarContracts(opportunity, 5);
    
    return similarContracts.matches.filter(m => 
      m.contract.awardedTo && 
      preferences.companyProfile?.pastWins?.includes(m.contract.awardedTo)
    );
  }

  async extractKeyRequirements(opportunity) {
    // Use NLP to extract key requirements from description
    if (!opportunity.description) return [];
    
    const entities = await nlpService.extractEntities(opportunity.description);
    
    const requirements = [];
    
    if (entities.requirements?.length > 0) {
      requirements.push(...entities.requirements.slice(0, 5));
    }
    
    if (entities.deliverables?.length > 0) {
      requirements.push(...entities.deliverables.slice(0, 3));
    }
    
    return requirements;
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

  formatCurrency(amount) {
    if (!amount) return '$0';
    
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    
    return `$${amount.toLocaleString()}`;
  }

  getDaysSincePosted(opportunity) {
    if (!opportunity.postedDate) return 0;
    
    const now = new Date();
    const posted = new Date(opportunity.postedDate);
    const daysDiff = Math.ceil((now - posted) / (1000 * 60 * 60 * 24));
    
    return Math.max(0, daysDiff);
  }

  inferPreferencesFromContext(userContext) {
    return {
      preferredNaicsCodes: userContext.expertise || [],
      preferredAgencies: userContext.targetAgencies || [],
      preferredStates: userContext.operatingStates || [],
      certifications: userContext.certifications || [],
      keywords: userContext.keywords || [],
      minContractValue: userContext.minContractValue || 0,
      thresholds: {
        minWinProbability: 30,
        minRelevanceScore: 70,
        maxAgeDays: 7
      }
    };
  }

  // Schedule regular alert generation
  async scheduleAlertGeneration(userId, frequency = 'daily') {
    // This would integrate with a job scheduler like node-cron
    return {
      userId,
      frequency,
      nextRun: this.getNextRunTime(frequency),
      active: true
    };
  }

  getNextRunTime(frequency) {
    const now = new Date();
    switch (frequency) {
      case 'hourly':
        return new Date(now.getTime() + (60 * 60 * 1000));
      case 'daily':
        return new Date(now.getTime() + (24 * 60 * 60 * 1000));
      case 'weekly':
        return new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      default:
        return new Date(now.getTime() + (24 * 60 * 60 * 1000));
    }
  }
}

module.exports = new AIOpportunityAlerts();