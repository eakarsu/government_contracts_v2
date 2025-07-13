const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Simple auth middleware for testing
const auth = (req, res, next) => {
  // For now, create a dummy user for testing
  req.user = { id: '00000000-0000-0000-0000-000000000001' };
  next();
};

// @route   POST /api/profiles/business
// @desc    Create or update business profile
// @access  Private
router.post('/business', auth, async (req, res) => {
  try {
    const {
      company_name,
      naics_codes,
      capabilities,
      certifications,
      past_performance,
      geographic_preferences,
      annual_revenue,
      employee_count,
      security_clearance_level
    } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Check if profile exists
    const existingProfile = await pool.query(
      'SELECT id FROM business_profiles WHERE user_id = $1',
      [req.user.id]
    );

    let profile;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      profile = await pool.query(
        `UPDATE business_profiles SET
         company_name = $1, naics_codes = $2, capabilities = $3,
         certifications = $4, past_performance = $5, geographic_preferences = $6,
         annual_revenue = $7, employee_count = $8, security_clearance_level = $9,
         updated_at = NOW()
         WHERE user_id = $10
         RETURNING *`,
        [
          company_name, JSON.stringify(naics_codes), capabilities,
          JSON.stringify(certifications), JSON.stringify(past_performance),
          JSON.stringify(geographic_preferences), annual_revenue,
          employee_count, security_clearance_level, req.user.id
        ]
      );
    } else {
      // Create new profile
      profile = await pool.query(
        `INSERT INTO business_profiles 
         (user_id, company_name, naics_codes, capabilities, certifications,
          past_performance, geographic_preferences, annual_revenue,
          employee_count, security_clearance_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          req.user.id, company_name, JSON.stringify(naics_codes), capabilities,
          JSON.stringify(certifications), JSON.stringify(past_performance),
          JSON.stringify(geographic_preferences), annual_revenue,
          employee_count, security_clearance_level
        ]
      );
    }

    res.json({ profile: profile.rows[0] });

  } catch (error) {
    console.error('Business profile error:', error);
    res.status(500).json({ error: 'Failed to save business profile' });
  }
});

// @route   GET /api/profiles/business
// @desc    Get user's business profile
// @access  Private
router.get('/business', auth, async (req, res) => {
  try {
    const profile = await pool.query(
      'SELECT * FROM business_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Business profile not found' });
    }

    res.json({ profile: profile.rows[0] });

  } catch (error) {
    console.error('Get business profile error:', error);
    res.status(500).json({ error: 'Failed to get business profile' });
  }
});

// @route   GET /api/profiles/opportunities
// @desc    Get matched opportunities for user
// @access  Private
router.get('/opportunities', auth, async (req, res) => {
  try {
    // For now, return sample data
    res.json({ opportunities: [] });
  } catch (error) {
    console.error('Get opportunities error:', error);
    res.status(500).json({ error: 'Failed to get opportunities' });
  }
});

module.exports = router;
