const express = require('express');
const { query } = require('../config/database');
const aiService = require('../services/aiService');
const { logger } = require('../utils/logger');

const router = express.Router();

// Predict bid success probability
router.post('/predict/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params;

    // Get contract details
    const contractResult = await query(
      'SELECT * FROM contracts WHERE id = $1',
      [contractId]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Get user's business profile
    const profileResult = await query(
      'SELECT * FROM business_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(400).json({ error: 'Business profile required. Please create your profile first.' });
    }

    // Get historical bid data for the user
    const historyResult = await query(`
      SELECT 
        outcome, win_probability, actual_result, bid_amount,
        c.agency, c.naics_code, c.contract_value
      FROM bid_history bh
      JOIN contracts c ON bh.contract_id = c.id
      WHERE bh.user_id = $1
      ORDER BY bh.created_at DESC
      LIMIT 10
    `, [req.user.id]);

    const contract = contractResult.rows[0];
    const profile = profileResult.rows[0];
    const historicalData = historyResult.rows;

    const contractData = {
      title: contract.title,
      description: contract.description,
      agency: contract.agency,
      naicsCode: contract.naics_code,
      contractValue: contract.contract_value,
      setAsideType: contract.set_aside_type,
      postedDate: contract.posted_date,
      responseDeadline: contract.response_deadline
    };

    const companyProfile = {
      companyName: profile.company_name,
      naicsCodes: JSON.parse(profile.naics_codes || '[]'),
      capabilities: profile.capabilities,
      certifications: JSON.parse(profile.certifications || '{}'),
      pastPerformance: JSON.parse(profile.past_performance || '{}'),
      annualRevenue: profile.annual_revenue,
      employeeCount: profile.employee_count,
      securityClearanceLevel: profile.security_clearance_level
    };

    // Use AI to predict bid success
    const prediction = await aiService.calculateBidProbability(contractData, companyProfile, historicalData);

    // Store prediction in database
    const result = await query(`
      INSERT INTO bid_predictions (
        contract_id, business_profile_id, probability_score, confidence_level,
        contributing_factors, improvement_suggestions, competitive_analysis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (contract_id, business_profile_id)
      DO UPDATE SET 
        probability_score = $3,
        confidence_level = $4,
        contributing_factors = $5,
        improvement_suggestions = $6,
        competitive_analysis = $7,
        created_at = NOW()
      RETURNING *
    `, [
      contractId,
      profile.id,
      prediction.probability,
      prediction.confidence,
      JSON.stringify(prediction.factors || []),
      JSON.stringify(prediction.recommendations || []),
      JSON.stringify(prediction.competitive_analysis || {})
    ]);

    const predictionRecord = result.rows[0];

    res.json({
      contractId,
      prediction: {
        id: predictionRecord.id,
        probabilityScore: parseFloat(predictionRecord.probability_score),
        confidenceLevel: predictionRecord.confidence_level,
        factors: JSON.parse(predictionRecord.contributing_factors || '[]'),
        recommendations: JSON.parse(predictionRecord.improvement_suggestions || '[]'),
        competitiveAnalysis: JSON.parse(predictionRecord.competitive_analysis || '{}'),
        predictedAt: predictionRecord.created_at
      }
    });

  } catch (error) {
    logger.error('Bid prediction error:', error);
    res.status(500).json({ error: 'Failed to predict bid success' });
  }
});

module.exports = router;
