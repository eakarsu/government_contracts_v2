const express = require('express');
const { resetDatabases } = require('../scripts/reset-databases');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');

const router = express.Router();

// Reset all databases endpoint
router.post('/reset-databases', async (req, res) => {
  try {
    console.log('🔄 Admin requested database reset...');
    
    await resetDatabases();
    
    res.json({
      success: true,
      message: 'All databases have been reset successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Database reset failed'
    });
  }
});

// Get database statistics
router.get('/database-stats', async (req, res) => {
  try {
    const contractCount = await prisma.contract.count();
    const jobCount = await prisma.indexingJob.count();
    const queueCount = await prisma.documentProcessingQueue.count();
    const analysisCount = await prisma.documentAnalysis.count();
    
    const vectorStats = await vectorService.getCollectionStats();
    
    res.json({
      success: true,
      postgres: {
        contracts: contractCount,
        indexing_jobs: jobCount,
        processing_queue: queueCount,
        document_analysis: analysisCount
      },
      vector_database: {
        contracts: vectorStats.contracts,
        documents: vectorStats.documents,
        status: vectorStats.status
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset only PostgreSQL database
router.post('/reset-postgres', async (req, res) => {
  try {
    console.log('🔄 Admin requested PostgreSQL reset...');
    
    // Delete all records from all tables
    await prisma.documentAnalysis.deleteMany({});
    await prisma.documentProcessingQueue.deleteMany({});
    await prisma.indexingJob.deleteMany({});
    await prisma.contract.deleteMany({});
    
    const counts = {
      contracts: await prisma.contract.count(),
      indexing_jobs: await prisma.indexingJob.count(),
      processing_queue: await prisma.documentProcessingQueue.count(),
      document_analysis: await prisma.documentAnalysis.count()
    };
    
    res.json({
      success: true,
      message: 'PostgreSQL database has been reset successfully',
      counts,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ PostgreSQL reset failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'PostgreSQL reset failed'
    });
  }
});

// Reset only Vector database
router.post('/reset-vector', async (req, res) => {
  try {
    console.log('🔄 Admin requested Vector database reset...');
    
    const fs = require('fs-extra');
    const path = require('path');
    
    const vectorIndexPath = path.join(process.cwd(), 'vector_indexes');
    
    if (await fs.pathExists(vectorIndexPath)) {
      await fs.remove(vectorIndexPath);
    }
    
    await fs.ensureDir(vectorIndexPath);
    await vectorService.initialize();
    
    const vectorStats = await vectorService.getCollectionStats();
    
    res.json({
      success: true,
      message: 'Vector database has been reset successfully',
      vector_stats: vectorStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Vector database reset failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Vector database reset failed'
    });
  }
});

module.exports = router;
