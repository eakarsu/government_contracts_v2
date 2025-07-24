const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

const router = express.Router();

// Simple auth middleware for testing
const auth = (req, res, next) => {
  // For now, create a dummy user for testing (using integer ID)
  req.user = { id: 1 };
  next();
};

// Validation schema for business profile
const profileSchema = Joi.object({
  companyName: Joi.string().min(2).max(255).required(),
  naicsCodes: Joi.array().items(Joi.string()).optional(),
  capabilities: Joi.array().items(Joi.string()).optional(),
  certifications: Joi.object().optional(),
  pastPerformance: Joi.object().optional(),
  geographicPreferences: Joi.object().optional(),
  annualRevenue: Joi.number().positive().optional(),
  employeeCount: Joi.number().integer().positive().optional(),
  securityClearanceLevel: Joi.string().optional()
});

// Create or update business profile
router.post('/', async (req, res) => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      companyName,
      naicsCodes,
      capabilities,
      certifications,
      pastPerformance,
      geographicPreferences,
      annualRevenue,
      employeeCount,
      securityClearanceLevel
    } = value;

    // Check if profile already exists
    const existingProfile = await query(
      'SELECT id FROM business_profiles WHERE user_id = $1',
      [req.user.id]
    );

    let result;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      result = await query(`
        UPDATE business_profiles SET
          company_name = $1,
          naics_codes = $2,
          capabilities = $3,
          certifications = $4,
          past_performance = $5,
          geographic_preferences = $6,
          annual_revenue = $7,
          employee_count = $8,
          security_clearance_level = $9,
          updated_at = NOW()
        WHERE user_id = $10
        RETURNING *
      `, [
        companyName,
        JSON.stringify(naicsCodes || []),
        capabilities || [],
        JSON.stringify(certifications || {}),
        JSON.stringify(pastPerformance || {}),
        JSON.stringify(geographicPreferences || {}),
        annualRevenue,
        employeeCount,
        securityClearanceLevel,
        req.user.id
      ]);
    } else {
      // Create new profile
      result = await query(`
        INSERT INTO business_profiles (
          user_id, company_name, naics_codes, capabilities, certifications,
          past_performance, geographic_preferences, annual_revenue,
          employee_count, security_clearance_level
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        req.user.id,
        companyName,
        JSON.stringify(naicsCodes || []),
        capabilities || [],
        JSON.stringify(certifications || {}),
        JSON.stringify(pastPerformance || {}),
        JSON.stringify(geographicPreferences || {}),
        annualRevenue,
        employeeCount,
        securityClearanceLevel
      ]);
    }

    const profile = result.rows[0];

    res.json({
      message: existingProfile.rows.length > 0 ? 'Profile updated successfully' : 'Profile created successfully',
      profile: {
        id: profile.id,
        companyName: profile.company_name,
        naicsCodes: JSON.parse(profile.naics_codes || '[]'),
        capabilities: profile.capabilities,
        certifications: JSON.parse(profile.certifications || '{}'),
        pastPerformance: JSON.parse(profile.past_performance || '{}'),
        geographicPreferences: JSON.parse(profile.geographic_preferences || '{}'),
        annualRevenue: profile.annual_revenue,
        employeeCount: profile.employee_count,
        securityClearanceLevel: profile.security_clearance_level,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    });

  } catch (error) {
    logger.error('Profile creation/update error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Get user's business profile
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM business_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];

    res.json({
      profile: {
        id: profile.id,
        companyName: profile.company_name,
        naicsCodes: JSON.parse(profile.naics_codes || '[]'),
        capabilities: profile.capabilities,
        certifications: JSON.parse(profile.certifications || '{}'),
        pastPerformance: JSON.parse(profile.past_performance || '{}'),
        geographicPreferences: JSON.parse(profile.geographic_preferences || '{}'),
        annualRevenue: profile.annual_revenue,
        employeeCount: profile.employee_count,
        securityClearanceLevel: profile.security_clearance_level,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// Get opportunity matches for user's profile
router.get('/opportunities', auth, async (req, res) => {
  try {
    const { limit = 20, minScore = 0.5 } = req.query;

    // Get user's business profile
    const profileResult = await query(
      'SELECT * FROM business_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profileResult.rows.length === 0) {
      // No business profile found - return empty opportunities
      return res.json({ 
        opportunities: [],
        message: 'No business profile found. Please create a profile to see matched opportunities.',
        profile: null
      });
    }

    const profile = profileResult.rows[0];

    // Get opportunity matches
    const matchesResult = await query(`
      SELECT 
        om.*,
        c.notice_id,
        c.title,
        c.description,
        c.agency,
        c.naics_code,
        c.contract_value,
        c.posted_date,
        c.response_deadline
      FROM opportunity_matches om
      JOIN contracts c ON om.contract_id = c.id
      WHERE om.business_profile_id = $1 
        AND om.match_score >= $2
      ORDER BY om.match_score DESC, om.created_at DESC
      LIMIT $3
    `, [profile.id, minScore, limit]);

    const opportunities = matchesResult.rows.map(row => ({
      id: row.id,
      contractId: row.contract_id,
      noticeId: row.notice_id,
      title: row.title,
      description: row.description,
      agency: row.agency,
      naicsCode: row.naics_code,
      contractValue: row.contract_value,
      postedDate: row.posted_date,
      responseDeadline: row.response_deadline,
      matchScore: parseFloat(row.match_score),
      matchFactors: JSON.parse(row.match_factors || '{}'),
      notificationSent: row.notification_sent,
      matchedAt: row.created_at
    }));

    res.json({
      opportunities,
      totalMatches: opportunities.length,
      profile: {
        companyName: profile.company_name,
        naicsCodes: JSON.parse(profile.naics_codes || '[]')
      }
    });

  } catch (error) {
    logger.error('Get opportunities error:', error);
    res.status(500).json({ error: 'Failed to retrieve opportunities' });
  }
});

// Get notification settings for user
router.get('/notification-settings', auth, async (req, res) => {
  try {
    const settingsResult = await query(
      'SELECT * FROM notification_settings WHERE user_id = $1',
      [req.user.id]
    );

    if (settingsResult.rows.length === 0) {
      // Return default settings if none exist
      return res.json({
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        frequency: 'immediate',
        minMatchScore: 0.7,
        opportunityTypes: [],
        agencies: [],
        contractValueMin: null,
        contractValueMax: null,
        keywords: []
      });
    }

    const settings = settingsResult.rows[0];
    res.json({
      emailNotifications: settings.email_notifications,
      pushNotifications: settings.push_notifications,
      smsNotifications: settings.sms_notifications,
      frequency: settings.frequency,
      minMatchScore: parseFloat(settings.min_match_score),
      opportunityTypes: JSON.parse(settings.opportunity_types || '[]'),
      agencies: JSON.parse(settings.agencies || '[]'),
      contractValueMin: settings.contract_value_min ? parseFloat(settings.contract_value_min) : null,
      contractValueMax: settings.contract_value_max ? parseFloat(settings.contract_value_max) : null,
      keywords: JSON.parse(settings.keywords || '[]')
    });

  } catch (error) {
    logger.error('Get notification settings error:', error);
    res.status(500).json({ error: 'Failed to retrieve notification settings' });
  }
});

// Save notification settings for user
router.post('/notification-settings', auth, async (req, res) => {
  try {
    const {
      emailNotifications,
      pushNotifications,
      smsNotifications,
      frequency,
      minMatchScore,
      opportunityTypes,
      agencies,
      contractValueMin,
      contractValueMax,
      keywords
    } = req.body;

    // Check if settings already exist
    const existingSettings = await query(
      'SELECT id FROM notification_settings WHERE user_id = $1',
      [req.user.id]
    );

    if (existingSettings.rows.length > 0) {
      // Update existing settings
      await query(`
        UPDATE notification_settings 
        SET email_notifications = $2,
            push_notifications = $3,
            sms_notifications = $4,
            frequency = $5,
            min_match_score = $6,
            opportunity_types = $7,
            agencies = $8,
            contract_value_min = $9,
            contract_value_max = $10,
            keywords = $11,
            updated_at = NOW()
        WHERE user_id = $1
      `, [
        req.user.id,
        emailNotifications,
        pushNotifications,
        smsNotifications,
        frequency,
        minMatchScore,
        JSON.stringify(opportunityTypes || []),
        JSON.stringify(agencies || []),
        contractValueMin,
        contractValueMax,
        JSON.stringify(keywords || [])
      ]);
    } else {
      // Create new settings
      await query(`
        INSERT INTO notification_settings (
          user_id, email_notifications, push_notifications, sms_notifications,
          frequency, min_match_score, opportunity_types, agencies,
          contract_value_min, contract_value_max, keywords, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      `, [
        req.user.id,
        emailNotifications,
        pushNotifications,
        smsNotifications,
        frequency,
        minMatchScore,
        JSON.stringify(opportunityTypes || []),
        JSON.stringify(agencies || []),
        contractValueMin,
        contractValueMax,
        JSON.stringify(keywords || [])
      ]);
    }

    res.json({ success: true, message: 'Notification settings saved successfully' });

  } catch (error) {
    logger.error('Save notification settings error:', error);
    res.status(500).json({ error: 'Failed to save notification settings' });
  }
});

module.exports = router;
