const { Pool } = require('pg');
const AIService = require('./aiService');
const logger = require('../utils/logger');

class OpportunityMatchingService {
  constructor() {
    this.aiService = AIService;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async createBusinessProfile(userId, profileData) {
    try {
      const query = `
        INSERT INTO business_profiles (
          user_id, company_name, naics_codes, capabilities, certifications,
          past_performance, geographic_preferences, annual_revenue,
          employee_count, security_clearance_level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const values = [
        userId,
        profileData.companyName,
        JSON.stringify(profileData.naicsCodes || []),
        profileData.capabilities || [],
        JSON.stringify(profileData.certifications || {}),
        JSON.stringify(profileData.pastPerformance || {}),
        JSON.stringify(profileData.geographicPreferences || {}),
        profileData.annualRevenue,
        profileData.employeeCount,
        profileData.securityClearanceLevel
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating business profile:', error);
      throw error;
    }
  }

  async updateBusinessProfile(profileId, profileData) {
    try {
      const query = `
        UPDATE business_profiles SET
          company_name = $2,
          naics_codes = $3,
          capabilities = $4,
          certifications = $5,
          past_performance = $6,
          geographic_preferences = $7,
          annual_revenue = $8,
          employee_count = $9,
          security_clearance_level = $10,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const values = [
        profileId,
        profileData.companyName,
        JSON.stringify(profileData.naicsCodes || []),
        profileData.capabilities || [],
        JSON.stringify(profileData.certifications || {}),
        JSON.stringify(profileData.pastPerformance || {}),
        JSON.stringify(profileData.geographicPreferences || {}),
        profileData.annualRevenue,
        profileData.employeeCount,
        profileData.securityClearanceLevel
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating business profile:', error);
      throw error;
    }
  }

  async calculateOpportunityMatch(businessProfileId, contractId) {
    try {
      // Get business profile
      const profileQuery = 'SELECT * FROM business_profiles WHERE id = $1';
      const profileResult = await this.pool.query(profileQuery, [businessProfileId]);
      
      if (profileResult.rows.length === 0) {
        throw new Error('Business profile not found');
      }

      const profile = profileResult.rows[0];

      // Get contract details
      const contractQuery = 'SELECT * FROM contracts WHERE id = $1';
      const contractResult = await this.pool.query(contractQuery, [contractId]);
      
      if (contractResult.rows.length === 0) {
        throw new Error('Contract not found');
      }

      const contract = contractResult.rows[0];

      // Calculate match factors
      const matchFactors = {
        naicsMatch: this.calculateNAICSMatch(profile.naics_codes, contract.naics_code),
        sizeMatch: this.calculateSizeMatch(profile, contract),
        capabilityMatch: await this.calculateCapabilityMatch(profile.capabilities, contract.description),
        geographicMatch: this.calculateGeographicMatch(profile.geographic_preferences, contract.location),
        certificationMatch: this.calculateCertificationMatch(profile.certifications, contract.requirements),
        pastPerformanceMatch: this.calculatePastPerformanceMatch(profile.past_performance, contract)
      };

      // Calculate weighted score
      const weights = {
        naicsMatch: 0.25,
        sizeMatch: 0.15,
        capabilityMatch: 0.30,
        geographicMatch: 0.10,
        certificationMatch: 0.15,
        pastPerformanceMatch: 0.05
      };

      const matchScore = Object.keys(matchFactors).reduce((score, factor) => {
        return score + (matchFactors[factor] * weights[factor]);
      }, 0);

      // Store match result
      const insertQuery = `
        INSERT INTO opportunity_matches (
          business_profile_id, contract_id, match_score, match_factors
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (business_profile_id, contract_id)
        DO UPDATE SET
          match_score = EXCLUDED.match_score,
          match_factors = EXCLUDED.match_factors,
          created_at = NOW()
        RETURNING *
      `;

      const result = await this.pool.query(insertQuery, [
        businessProfileId,
        contractId,
        matchScore,
        JSON.stringify(matchFactors)
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error calculating opportunity match:', error);
      throw error;
    }
  }

  calculateNAICSMatch(profileNAICS, contractNAICS) {
    if (!profileNAICS || !contractNAICS) return 0;
    
    const profileCodes = Array.isArray(profileNAICS) ? profileNAICS : JSON.parse(profileNAICS);
    
    // Exact match
    if (profileCodes.includes(contractNAICS)) return 1.0;
    
    // Partial match (same industry group)
    const contractPrefix = contractNAICS.substring(0, 3);
    const hasPartialMatch = profileCodes.some(code => code.substring(0, 3) === contractPrefix);
    
    return hasPartialMatch ? 0.7 : 0;
  }

  calculateSizeMatch(profile, contract) {
    // Simple size matching based on contract value and company revenue
    if (!profile.annual_revenue || !contract.contract_value) return 0.5;
    
    const ratio = contract.contract_value / profile.annual_revenue;
    
    // Optimal ratio is between 0.1 and 0.5 of annual revenue
    if (ratio >= 0.1 && ratio <= 0.5) return 1.0;
    if (ratio >= 0.05 && ratio <= 0.8) return 0.7;
    if (ratio >= 0.01 && ratio <= 1.0) return 0.4;
    
    return 0.1;
  }

  async calculateCapabilityMatch(capabilities, contractDescription) {
    if (!capabilities || capabilities.length === 0) return 0;
    
    try {
      // Use AI to analyze capability match
      const capabilityText = capabilities.join(', ');
      const prompt = `Rate the match between these company capabilities: "${capabilityText}" and this contract description: "${contractDescription}". Return a score between 0 and 1.`;
      
      const response = await this.aiService.generateChatCompletion([
        { role: 'system', content: 'You are an expert at matching company capabilities to contract requirements. Return only a decimal number between 0 and 1.' },
        { role: 'user', content: prompt }
      ]);
      
      const score = parseFloat(response.trim());
      return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    } catch (error) {
      logger.error('Error calculating capability match:', error);
      return 0.5;
    }
  }

  calculateGeographicMatch(preferences, contractLocation) {
    if (!preferences || !contractLocation) return 0.5;
    
    const prefs = typeof preferences === 'string' ? JSON.parse(preferences) : preferences;
    
    if (prefs.nationwide) return 1.0;
    if (prefs.states && prefs.states.includes(contractLocation)) return 1.0;
    if (prefs.regions && this.isInRegion(contractLocation, prefs.regions)) return 0.8;
    
    return 0.2;
  }

  calculateCertificationMatch(certifications, requirements) {
    if (!certifications || !requirements) return 0.5;
    
    const certs = typeof certifications === 'string' ? JSON.parse(certifications) : certifications;
    const reqText = requirements.toLowerCase();
    
    let matchScore = 0;
    let totalChecks = 0;
    
    // Check common certifications
    const certChecks = {
      'small_business': ['small business', 'sb'],
      'woman_owned': ['woman owned', 'wosb'],
      'veteran_owned': ['veteran owned', 'vosb'],
      'minority_owned': ['minority owned', 'mbe'],
      'hubzone': ['hubzone'],
      'sdvosb': ['sdvosb', 'service disabled']
    };
    
    Object.keys(certChecks).forEach(cert => {
      totalChecks++;
      if (certs[cert] && certChecks[cert].some(term => reqText.includes(term))) {
        matchScore += 1;
      }
    });
    
    return totalChecks > 0 ? matchScore / totalChecks : 0.5;
  }

  calculatePastPerformanceMatch(pastPerformance, contract) {
    if (!pastPerformance) return 0.5;
    
    const performance = typeof pastPerformance === 'string' ? JSON.parse(pastPerformance) : pastPerformance;
    
    let score = 0.5; // Base score
    
    // Boost for relevant experience
    if (performance.governmentContracts > 0) score += 0.2;
    if (performance.similarProjects > 0) score += 0.2;
    if (performance.averageRating && performance.averageRating > 4) score += 0.1;
    
    return Math.min(1.0, score);
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

  async getMatchedOpportunities(businessProfileId, options = {}) {
    try {
      const {
        limit = 20,
        minScore = 0.5,
        sortBy = 'match_score'
      } = options;

      const query = `
        SELECT 
          om.*,
          c.title,
          c.description,
          c.agency,
          c.contract_value,
          c.posted_date,
          c.deadline_date
        FROM opportunity_matches om
        JOIN contracts c ON om.contract_id = c.id
        WHERE om.business_profile_id = $1 AND om.match_score >= $2
        ORDER BY ${sortBy === 'match_score' ? 'om.match_score DESC' : 'c.posted_date DESC'}
        LIMIT $3
      `;

      const result = await this.pool.query(query, [businessProfileId, minScore, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting matched opportunities:', error);
      throw error;
    }
  }

  async processNewContract(contractId) {
    try {
      // Get all business profiles
      const profilesQuery = 'SELECT id FROM business_profiles';
      const profilesResult = await this.pool.query(profilesQuery);

      // Calculate matches for all profiles
      const matchPromises = profilesResult.rows.map(profile => 
        this.calculateOpportunityMatch(profile.id, contractId)
      );

      await Promise.all(matchPromises);
      
      logger.info(`Processed opportunity matches for contract ${contractId}`);
    } catch (error) {
      logger.error('Error processing new contract:', error);
      throw error;
    }
  }
}

module.exports = OpportunityMatchingService;
