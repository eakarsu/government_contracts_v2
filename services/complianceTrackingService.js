const { Pool } = require('pg');
const AIService = require('./aiService');
const logger = require('../utils/logger');

class ComplianceTrackingService {
  constructor() {
    this.aiService = AIService;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async extractDeadlines(contractId, documentContent) {
    try {
      // Use AI to extract deadlines from contract documents
      const prompt = `Extract all deadlines and important dates from this government contract document. Return as JSON array with fields: type, date, description, isCritical:\n\n${documentContent.substring(0, 6000)}`;
      
      const response = await this.aiService.generateChatCompletion([
        { role: 'system', content: 'Extract deadlines from government contracts. Return structured JSON array.' },
        { role: 'user', content: prompt }
      ]);

      const deadlines = JSON.parse(response);

      // Store deadlines in database
      for (const deadline of deadlines) {
        await this.pool.query(
          `INSERT INTO contract_deadlines (contract_id, deadline_type, deadline_date, description, is_critical)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (contract_id, deadline_type, deadline_date) DO NOTHING`,
          [
            contractId,
            deadline.type,
            new Date(deadline.date),
            deadline.description,
            deadline.isCritical || false
          ]
        );
      }

      return deadlines;
    } catch (error) {
      logger.error('Error extracting deadlines:', error);
      return [];
    }
  }

  async generateComplianceChecklist(contractId, agency, contractType) {
    try {
      // Generate AI-powered compliance checklist
      const checklist = await this.aiService.generateComplianceChecklist(agency, contractType);

      // Store checklist
      const query = `
        INSERT INTO compliance_checklists (contract_id, agency, checklist_items, completion_status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (contract_id) 
        DO UPDATE SET
          checklist_items = EXCLUDED.checklist_items,
          completion_status = EXCLUDED.completion_status,
          updated_at = NOW()
        RETURNING *
      `;

      const completionStatus = {};
      checklist.forEach(item => {
        completionStatus[item.item] = {
          completed: false,
          completedAt: null,
          notes: ''
        };
      });

      const result = await this.pool.query(query, [
        contractId,
        agency,
        JSON.stringify(checklist),
        JSON.stringify(completionStatus)
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error generating compliance checklist:', error);
      throw error;
    }
  }

  async updateChecklistItem(checklistId, itemName, completed, notes = '') {
    try {
      // Get current checklist
      const checklistQuery = 'SELECT * FROM compliance_checklists WHERE id = $1';
      const checklistResult = await this.pool.query(checklistQuery, [checklistId]);
      
      if (checklistResult.rows.length === 0) {
        throw new Error('Checklist not found');
      }

      const checklist = checklistResult.rows[0];
      const completionStatus = JSON.parse(checklist.completion_status);

      // Update item status
      completionStatus[itemName] = {
        completed,
        completedAt: completed ? new Date().toISOString() : null,
        notes
      };

      // Update database
      const updateQuery = `
        UPDATE compliance_checklists SET
          completion_status = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.pool.query(updateQuery, [
        checklistId,
        JSON.stringify(completionStatus)
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating checklist item:', error);
      throw error;
    }
  }

  async getUpcomingDeadlines(userId, days = 30) {
    try {
      const query = `
        SELECT 
          cd.*,
          c.title as contract_title,
          c.agency
        FROM contract_deadlines cd
        JOIN contracts c ON cd.contract_id = c.id
        WHERE cd.deadline_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
        AND cd.reminder_sent = false
        ORDER BY cd.deadline_date ASC
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting upcoming deadlines:', error);
      throw error;
    }
  }

  async sendDeadlineReminders() {
    try {
      const upcomingDeadlines = await this.getUpcomingDeadlines(null, 7); // 7 days ahead

      for (const deadline of upcomingDeadlines) {
        // In a real implementation, you would send emails/SMS here
        logger.info(`Reminder: ${deadline.deadline_type} deadline for ${deadline.contract_title} on ${deadline.deadline_date}`);

        // Mark reminder as sent
        await this.pool.query(
          'UPDATE contract_deadlines SET reminder_sent = true WHERE id = $1',
          [deadline.id]
        );
      }

      return upcomingDeadlines.length;
    } catch (error) {
      logger.error('Error sending deadline reminders:', error);
      throw error;
    }
  }

  async getComplianceStatus(contractId) {
    try {
      // Get deadlines
      const deadlinesQuery = `
        SELECT * FROM contract_deadlines 
        WHERE contract_id = $1 
        ORDER BY deadline_date ASC
      `;
      const deadlinesResult = await this.pool.query(deadlinesQuery, [contractId]);

      // Get checklist
      const checklistQuery = `
        SELECT * FROM compliance_checklists 
        WHERE contract_id = $1
      `;
      const checklistResult = await this.pool.query(checklistQuery, [contractId]);

      const deadlines = deadlinesResult.rows;
      const checklist = checklistResult.rows[0];

      // Calculate compliance metrics
      const now = new Date();
      const overdueDealines = deadlines.filter(d => new Date(d.deadline_date) < now);
      const upcomingDeadlines = deadlines.filter(d => {
        const deadlineDate = new Date(d.deadline_date);
        const daysUntil = (deadlineDate - now) / (1000 * 60 * 60 * 24);
        return daysUntil > 0 && daysUntil <= 30;
      });

      let checklistCompletion = 0;
      if (checklist) {
        const completionStatus = JSON.parse(checklist.completion_status);
        const totalItems = Object.keys(completionStatus).length;
        const completedItems = Object.values(completionStatus).filter(item => item.completed).length;
        checklistCompletion = totalItems > 0 ? completedItems / totalItems : 0;
      }

      return {
        deadlines: {
          total: deadlines.length,
          overdue: overdueDealines.length,
          upcoming: upcomingDeadlines.length,
          list: deadlines
        },
        checklist: {
          completion_rate: checklistCompletion,
          total_items: checklist ? Object.keys(JSON.parse(checklist.completion_status)).length : 0,
          completed_items: checklist ? Object.values(JSON.parse(checklist.completion_status)).filter(item => item.completed).length : 0,
          checklist: checklist
        },
        overall_status: this.calculateOverallStatus(overdueDealines.length, checklistCompletion)
      };
    } catch (error) {
      logger.error('Error getting compliance status:', error);
      throw error;
    }
  }

  calculateOverallStatus(overdueCount, checklistCompletion) {
    if (overdueCount > 0) return 'critical';
    if (checklistCompletion < 0.5) return 'warning';
    if (checklistCompletion < 0.8) return 'good';
    return 'excellent';
  }

  async getComplianceCalendar(userId, startDate, endDate) {
    try {
      const query = `
        SELECT 
          cd.*,
          c.title as contract_title,
          c.agency
        FROM contract_deadlines cd
        JOIN contracts c ON cd.contract_id = c.id
        WHERE cd.deadline_date BETWEEN $1 AND $2
        ORDER BY cd.deadline_date ASC
      `;

      const result = await this.pool.query(query, [startDate, endDate]);
      
      // Group by date for calendar display
      const calendar = {};
      result.rows.forEach(deadline => {
        const dateKey = deadline.deadline_date.toISOString().split('T')[0];
        if (!calendar[dateKey]) {
          calendar[dateKey] = [];
        }
        calendar[dateKey].push(deadline);
      });

      return calendar;
    } catch (error) {
      logger.error('Error getting compliance calendar:', error);
      throw error;
    }
  }

  async updateRegulatoryRequirements() {
    try {
      // This would typically fetch from government APIs or databases
      // For now, we'll use AI to generate updated requirements
      const agencies = ['DOD', 'GSA', 'VA', 'DHS', 'NASA'];
      const updates = [];

      for (const agency of agencies) {
        try {
          const prompt = `Generate current regulatory compliance requirements for ${agency} government contracts. Return as JSON array with fields: requirement, description, effectiveDate, category.`;
          
          const response = await this.aiService.generateChatCompletion([
            { role: 'system', content: 'Generate current government contract compliance requirements.' },
            { role: 'user', content: prompt }
          ]);

          const requirements = JSON.parse(response);
          updates.push({ agency, requirements });
        } catch (error) {
          logger.error(`Error updating requirements for ${agency}:`, error);
        }
      }

      return updates;
    } catch (error) {
      logger.error('Error updating regulatory requirements:', error);
      throw error;
    }
  }
}

module.exports = ComplianceTrackingService;
