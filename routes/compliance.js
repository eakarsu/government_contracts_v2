const express = require('express');
const { query } = require('../config/database');
const aiService = require('../services/aiService');
const { logger } = require('../utils/logger');

const router = express.Router();

// Generate compliance checklist for a contract
router.post('/checklist/:contractId', async (req, res) => {
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

    const contract = contractResult.rows[0];

    // Generate compliance checklist using AI
    const checklist = await aiService.generateComplianceChecklist(
      contract.agency,
      contract.classification_code || 'General',
      contract.contract_value || 0
    );

    // Store compliance checklist
    const result = await query(`
      INSERT INTO compliance_checklists (contract_id, agency, checklist_items, completion_status)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (contract_id) 
      DO UPDATE SET 
        checklist_items = $3, 
        completion_status = $4, 
        updated_at = NOW()
      RETURNING *
    `, [
      contractId,
      contract.agency,
      JSON.stringify(checklist.checklist || []),
      JSON.stringify({})
    ]);

    const complianceRecord = result.rows[0];

    res.json({
      contractId,
      agency: contract.agency,
      checklist: checklist.checklist || [],
      agencySpecificRequirements: checklist.agency_specific_requirements || [],
      estimatedComplianceTime: checklist.estimated_compliance_time,
      criticalPathItems: checklist.critical_path_items || [],
      completionStatus: {},
      createdAt: complianceRecord.created_at
    });

  } catch (error) {
    logger.error('Generate compliance checklist error:', error);
    res.status(500).json({ error: 'Failed to generate compliance checklist' });
  }
});

// Get compliance checklist for a contract
router.get('/checklist/:contractId', async (req, res) => {
  try {
    const { contractId } = req.params;

    const result = await query(`
      SELECT 
        cc.*,
        c.title as contract_title,
        c.agency
      FROM compliance_checklists cc
      JOIN contracts c ON cc.contract_id = c.id
      WHERE cc.contract_id = $1
    `, [contractId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance checklist not found' });
    }

    const checklist = result.rows[0];

    res.json({
      contractId,
      contractTitle: checklist.contract_title,
      agency: checklist.agency,
      checklist: JSON.parse(checklist.checklist_items || '[]'),
      completionStatus: JSON.parse(checklist.completion_status || '{}'),
      createdAt: checklist.created_at,
      updatedAt: checklist.updated_at
    });

  } catch (error) {
    logger.error('Get compliance checklist error:', error);
    res.status(500).json({ error: 'Failed to retrieve compliance checklist' });
  }
});

module.exports = router;
