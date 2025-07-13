const { Pool } = require('pg');
const AIService = require('./aiService');
const logger = require('../utils/logger');

class BidProbabilityService {
  constructor() {
    this.aiService = AIService;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async calculateBidProbability(contractId, businessProfileId) {
    try {
      // Get contract data
      const contractQuery = 'SELECT * FROM contracts WHERE id = $1';
      const contractResult = await this.pool.query(contractQuery, [contractId]);
      
      if (contractResult.rows.length === 0) {
        throw new Error('Contract not found');
      }

      const contract = contractResult.rows[0];

      // Get business profile
      const profileQuery = 'SELECT * FROM business_profiles WHERE id = $1';
      const profileResult = await this.pool.query(profileQuery, [businessProfileId]);
      
      if (profileResult.rows.length === 0) {
        throw new Error('Business profile not found');
      }

      const profile = profileResult.rows[0];

      // Get historical bid data
      const historyQuery = `
        SELECT * FROM bid_history 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 10
      `;
      const historyResult = await this.pool.query(historyQuery, [profile.user_id]);
      const historicalData = historyResult.rows;

      // Calculate probability using multiple factors
      const factors = await this.analyzeBidFactors(contract, profile, historicalData);
      
      // Use AI for final probability calculation
      const aiAnalysis = await this.aiService.calculateBidProbability(
        contract,
        profile,
        historicalData
      );

      // Combine rule-based and AI analysis
      const finalProbability = this.combineProbabilityScores(factors.probability, aiAnalysis.probability);
      
      // Determine confidence level
      const confidence = this.calculateConfidenceLevel(factors, aiAnalysis, historicalData.length);

      // Generate improvement suggestions
      const suggestions = await this.generateImprovementSuggestions(factors, profile, contract);

      // Perform competitive analysis
      const competitiveAnalysis = await this.performCompetitiveAnalysis(contract, profile);

      // Store prediction
      const predictionQuery = `
        INSERT INTO bid_predictions (
          contract_id, business_profile_id, probability_score, confidence_level,
          contributing_factors, improvement_suggestions, competitive_analysis
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (contract_id, business_profile_id)
        DO UPDATE SET
          probability_score = EXCLUDED.probability_score,
          confidence_level = EXCLUDED.confidence_level,
          contributing_factors = EXCLUDED.contributing_factors,
          improvement_suggestions = EXCLUDED.improvement_suggestions,
          competitive_analysis = EXCLUDED.competitive_analysis,
          created_at = NOW()
        RETURNING *
      `;

      const predictionResult = await this.pool.query(predictionQuery, [
        contractId,
        businessProfileId,
        finalProbability,
        confidence,
        JSON.stringify(factors),
        JSON.stringify(suggestions),
        JSON.stringify(competitiveAnalysis)
      ]);

      return predictionResult.rows[0];
    } catch (error) {
      logger.error('Error calculating bid probability:', error);
      throw error;
    }
  }

  async analyzeBidFactors(contract, profile, historicalData) {
    const factors = {
      naicsMatch: this.calculateNAICSMatch(profile.naics_codes, contract.naics_code),
      sizeMatch: this.calculateSizeMatch(profile, contract),
      experienceMatch: this.calculateExperienceMatch(profile, contract, historicalData),
      geographicMatch: this.calculateGeographicMatch(profile.geographic_preferences, contract.location),
      certificationMatch: this.calculateCertificationMatch(profile.certifications, contract),
      competitionLevel: await this.estimateCompetitionLevel(contract),
      pastPerformance: this.calculatePastPerformanceScore(historicalData),
      timeToDeadline: this.calculateTimeToDeadlineScore(contract.deadline_date)
    };

    // Calculate weighted probability
    const weights = {
      naicsMatch: 0.20,
      sizeMatch: 0.15,
      experienceMatch: 0.20,
      geographicMatch: 0.05,
      certificationMatch: 0.10,
      competitionLevel: 0.15,
      pastPerformance: 0.10,
      timeToDeadline: 0.05
    };

    const probability = Object.keys(factors).reduce((score, factor) => {
      return score + (factors[factor] * weights[factor]);
    }, 0);

    return { ...factors, probability, weights };
  }

  calculateNAICSMatch(profileNAICS, contractNAICS) {
    if (!profileNAICS || !contractNAICS) return 0.3;
    
    const profileCodes = Array.isArray(profileNAICS) ? profileNAICS : JSON.parse(profileNAICS);
    
    // Exact match
    if (profileCodes.includes(contractNAICS)) return 1.0;
    
    // Partial match (same industry group)
    const contractPrefix = contractNAICS.substring(0, 3);
    const hasPartialMatch = profileCodes.some(code => code.substring(0, 3) === contractPrefix);
    
    return hasPartialMatch ? 0.7 : 0.2;
  }

  calculateSizeMatch(profile, contract) {
    if (!profile.annual_revenue || !contract.contract_value) return 0.5;
    
    const ratio = contract.contract_value / profile.annual_revenue;
    
    // Optimal ratio is between 0.05 and 0.3 of annual revenue
    if (ratio >= 0.05 && ratio <= 0.3) return 1.0;
    if (ratio >= 0.02 && ratio <= 0.5) return 0.8;
    if (ratio >= 0.01 && ratio <= 0.8) return 0.6;
    if (ratio < 0.01) return 0.3; // Too small
    
    return 0.2; // Too large
  }

  calculateExperienceMatch(profile, contract, historicalData) {
    let score = 0.5; // Base score
    
    // Boost for government contract experience
    const govContracts = historicalData.filter(h => h.outcome === 'won').length;
    if (govContracts > 0) score += 0.2;
    if (govContracts > 3) score += 0.1;
    if (govContracts > 10) score += 0.1;
    
    // Boost for similar contract types
    const similarContracts = historicalData.filter(h => 
      h.contract_type === contract.contract_type || 
      h.agency === contract.agency
    ).length;
    
    if (similarContracts > 0) score += 0.1;
    
    return Math.min(1.0, score);
  }

  calculateGeographicMatch(preferences, contractLocation) {
    if (!preferences || !contractLocation) return 0.7;
    
    const prefs = typeof preferences === 'string' ? JSON.parse(preferences) : preferences;
    
    if (prefs.nationwide) return 1.0;
    if (prefs.states && prefs.states.includes(contractLocation)) return 1.0;
    if (prefs.regions && this.isInRegion(contractLocation, prefs.regions)) return 0.8;
    
    return 0.4;
  }

  calculateCertificationMatch(certifications, contract) {
    if (!certifications) return 0.5;
    
    const certs = typeof certifications === 'string' ? JSON.parse(certifications) : certifications;
    const contractText = (contract.description || '').toLowerCase();
    
    let score = 0.5;
    
    // Check for set-aside requirements
    if (contractText.includes('small business') && certs.small_business) score += 0.3;
    if (contractText.includes('woman owned') && certs.woman_owned) score += 0.2;
    if (contractText.includes('veteran owned') && certs.veteran_owned) score += 0.2;
    if (contractText.includes('hubzone') && certs.hubzone) score += 0.2;
    
    return Math.min(1.0, score);
  }

  async estimateCompetitionLevel(contract) {
    try {
      // Estimate competition based on contract characteristics
      let competitionScore = 0.5; // Base competition level
      
      // Higher value contracts typically have more competition
      if (contract.contract_value > 10000000) competitionScore += 0.2;
      else if (contract.contract_value > 1000000) competitionScore += 0.1;
      
      // Popular agencies have more competition
      const popularAgencies = ['DOD', 'GSA', 'VA'];
      if (popularAgencies.includes(contract.agency)) competitionScore += 0.1;
      
      // Convert to probability (lower competition = higher win probability)
      return Math.max(0.1, 1.0 - competitionScore);
    } catch (error) {
      logger.error('Error estimating competition level:', error);
      return 0.5;
    }
  }

  calculatePastPerformanceScore(historicalData) {
    if (historicalData.length === 0) return 0.5;
    
    const winRate = historicalData.filter(h => h.outcome === 'won').length / historicalData.length;
    const avgRating = historicalData.reduce((sum, h) => sum + (h.performance_rating || 3), 0) / historicalData.length;
    
    // Combine win rate and performance rating
    return (winRate * 0.7) + ((avgRating / 5) * 0.3);
  }

  calculateTimeToDeadlineScore(deadlineDate) {
    if (!deadlineDate) return 0.5;
    
    const now = new Date();
    const deadline = new Date(deadlineDate);
    const daysUntilDeadline = (deadline - now) / (1000 * 60 * 60 * 24);
    
    // Optimal time is 2-4 weeks
    if (daysUntilDeadline >= 14 && daysUntilDeadline <= 28) return 1.0;
    if (daysUntilDeadline >= 7 && daysUntilDeadline <= 42) return 0.8;
    if (daysUntilDeadline >= 3 && daysUntilDeadline <= 60) return 0.6;
    if (daysUntilDeadline < 3) return 0.2; // Too rushed
    
    return 0.4; // Too far out
  }

  combineProbabilityScores(ruleBasedScore, aiScore) {
    // Weight rule-based slightly higher for consistency
    return (ruleBasedScore * 0.6) + (aiScore * 0.4);
  }

  calculateConfidenceLevel(factors, aiAnalysis, historicalDataCount) {
    let confidence = 0.5;
    
    // Boost confidence with more historical data
    if (historicalDataCount > 5) confidence += 0.2;
    if (historicalDataCount > 10) confidence += 0.1;
    
    // Boost confidence if factors are clear
    const clearFactors = Object.values(factors).filter(f => f > 0.8 || f < 0.2).length;
    confidence += (clearFactors / Object.keys(factors).length) * 0.2;
    
    // AI confidence
    if (aiAnalysis.confidence === 'high') confidence += 0.1;
    
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  async generateImprovementSuggestions(factors, profile, contract) {
    const suggestions = [];
    
    // NAICS code suggestions
    if (factors.naicsMatch < 0.5) {
      suggestions.push({
        category: 'qualifications',
        priority: 'high',
        suggestion: `Consider obtaining NAICS code ${contract.naics_code} to better match this contract type.`,
        impact: 'Significantly improves qualification matching'
      });
    }
    
    // Size matching suggestions
    if (factors.sizeMatch < 0.5) {
      if (contract.contract_value > profile.annual_revenue * 0.5) {
        suggestions.push({
          category: 'partnerships',
          priority: 'high',
          suggestion: 'Consider partnering with larger firms or forming a joint venture for this contract size.',
          impact: 'Enables bidding on larger contracts'
        });
      }
    }
    
    // Certification suggestions
    if (factors.certificationMatch < 0.7) {
      suggestions.push({
        category: 'certifications',
        priority: 'medium',
        suggestion: 'Pursue relevant small business certifications (8(a), HUBZone, WOSB, VOSB) to improve competitiveness.',
        impact: 'Access to set-aside contracts and preference points'
      });
    }
    
    // Experience suggestions
    if (factors.experienceMatch < 0.6) {
      suggestions.push({
        category: 'experience',
        priority: 'medium',
        suggestion: 'Build relevant experience through smaller contracts or subcontracting opportunities.',
        impact: 'Improves past performance ratings and credibility'
      });
    }
    
    return suggestions;
  }

  async performCompetitiveAnalysis(contract, profile) {
    try {
      // Simplified competitive analysis
      const analysis = {
        estimatedCompetitors: this.estimateCompetitorCount(contract),
        competitiveAdvantages: this.identifyCompetitiveAdvantages(profile, contract),
        marketPosition: this.assessMarketPosition(profile, contract),
        differentiators: this.identifyDifferentiators(profile, contract)
      };
      
      return analysis;
    } catch (error) {
      logger.error('Error performing competitive analysis:', error);
      return {
        estimatedCompetitors: 'Unknown',
        competitiveAdvantages: [],
        marketPosition: 'Unknown',
        differentiators: []
      };
    }
  }

  estimateCompetitorCount(contract) {
    let competitors = 5; // Base estimate
    
    // Adjust based on contract value
    if (contract.contract_value > 50000000) competitors += 15;
    else if (contract.contract_value > 10000000) competitors += 10;
    else if (contract.contract_value > 1000000) competitors += 5;
    
    // Adjust based on agency popularity
    const popularAgencies = ['DOD', 'GSA', 'VA'];
    if (popularAgencies.includes(contract.agency)) competitors += 5;
    
    return `${competitors - 3}-${competitors + 3}`;
  }

  identifyCompetitiveAdvantages(profile, contract) {
    const advantages = [];
    
    if (profile.security_clearance_level) {
      advantages.push('Security clearance capabilities');
    }
    
    if (profile.certifications) {
      const certs = JSON.parse(profile.certifications);
      if (certs.small_business) advantages.push('Small business certification');
      if (certs.veteran_owned) advantages.push('Veteran-owned small business');
    }
    
    if (profile.employee_count < 100) {
      advantages.push('Agile small business operations');
    }
    
    return advantages;
  }

  assessMarketPosition(profile, contract) {
    const revenue = profile.annual_revenue || 0;
    
    if (revenue > 100000000) return 'Large business';
    if (revenue > 10000000) return 'Mid-size business';
    if (revenue > 1000000) return 'Small business';
    return 'Very small business';
  }

  identifyDifferentiators(profile, contract) {
    const differentiators = [];
    
    if (profile.capabilities && profile.capabilities.length > 0) {
      differentiators.push('Specialized technical capabilities');
    }
    
    if (profile.past_performance) {
      const performance = JSON.parse(profile.past_performance);
      if (performance.averageRating > 4) {
        differentiators.push('Excellent past performance record');
      }
    }
    
    return differentiators;
  }

  isInRegion(state, regions) {
    const regionMap = {
      'northeast': ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'],
      'southeast': ['DE', 'MD', 'VA', 'WV', 'KY', 'TN', 'NC', 'SC', 'GA', 'FL', 'AL', 'MS', 'AR', 'LA'],
      'midwest': ['OH', 'MI', 'IN', 'WI', 'IL', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
      'southwest': ['TX', 'OK', 'NM', 'AZ'],
      'west': ['MT', 'WY', 'CO', 'UT', 'ID', 'WA', 'OR', 'NV', 'CA', 'AK', 'HI']
    };
    
    return regions.some(region => regionMap[region] && regionMap[region].includes(state));
  }

  async recordBidOutcome(userId, contractId, bidAmount, outcome, actualResult) {
    try {
      const query = `
        INSERT INTO bid_history (
          user_id, contract_id, bid_amount, outcome, actual_result
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        userId,
        contractId,
        bidAmount,
        outcome,
        actualResult
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error recording bid outcome:', error);
      throw error;
    }
  }

  async getBidAnalytics(businessProfileId) {
    try {
      // Get bid predictions
      const predictionsQuery = `
        SELECT 
          bp.*,
          c.title as contract_title,
          c.agency,
          c.contract_value
        FROM bid_predictions bp
        JOIN contracts c ON bp.contract_id = c.id
        WHERE bp.business_profile_id = $1
        ORDER BY bp.created_at DESC
        LIMIT 20
      `;

      const predictionsResult = await this.pool.query(predictionsQuery, [businessProfileId]);

      // Get historical performance
      const profile = await this.pool.query('SELECT user_id FROM business_profiles WHERE id = $1', [businessProfileId]);
      const userId = profile.rows[0]?.user_id;

      let historicalData = [];
      if (userId) {
        const historyQuery = 'SELECT * FROM bid_history WHERE user_id = $1 ORDER BY created_at DESC';
        const historyResult = await this.pool.query(historyQuery, [userId]);
        historicalData = historyResult.rows;
      }

      // Calculate analytics
      const totalPredictions = predictionsResult.rows.length;
      const avgProbability = totalPredictions > 0 
        ? predictionsResult.rows.reduce((sum, p) => sum + p.probability_score, 0) / totalPredictions 
        : 0;

      const winRate = historicalData.length > 0
        ? historicalData.filter(h => h.actual_result === true).length / historicalData.length
        : 0;

      return {
        predictions: predictionsResult.rows,
        historical: historicalData,
        analytics: {
          totalPredictions,
          averageProbability: avgProbability,
          winRate,
          totalBids: historicalData.length,
          totalWins: historicalData.filter(h => h.actual_result === true).length
        }
      };
    } catch (error) {
      logger.error('Error getting bid analytics:', error);
      throw error;
    }
  }
}

module.exports = BidProbabilityService;
