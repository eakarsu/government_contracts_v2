const express = require('express');
const { prisma } = require('../config/database');

const router = express.Router();

// Get job status
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await prisma.indexingJob.findUnique({
      where: { id: parseInt(jobId) }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      id: job.id,
      type: job.jobType,
      status: job.status,
      start_date: job.startDate?.toISOString(),
      end_date: job.endDate?.toISOString(),
      records_processed: job.recordsProcessed,
      errors_count: job.errorsCount,
      error_details: job.errorDetails,
      created_at: job.createdAt?.toISOString(),
      completed_at: job.completedAt?.toISOString()
    });

  } catch (error) {
    console.error('Job status retrieval failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all jobs with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const jobs = await prisma.indexingJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const totalJobs = await prisma.indexingJob.count();

    res.json({
      jobs: jobs.map(job => ({
        id: job.id,
        type: job.jobType,
        status: job.status,
        records_processed: job.recordsProcessed,
        errors_count: job.errorsCount,
        created_at: job.createdAt?.toISOString(),
        completed_at: job.completedAt?.toISOString()
      })),
      total: totalJobs,
      pagination: {
        page,
        limit,
        total: totalJobs,
        pages: Math.ceil(totalJobs / limit)
      }
    });

  } catch (error) {
    console.error('Jobs retrieval failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
