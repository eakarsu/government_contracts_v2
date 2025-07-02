const express = require('express');
const axios = require('axios');
const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');
const config = require('../config/env');

const router = express.Router();

// Fetch contracts from SAM.gov API
router.post('/fetch', async (req, res) => {
  try {
    const { start_date, end_date, limit = 100, offset = 0 } = req.body;

    // Parse dates or use intelligent defaults
    let startDate = start_date ? new Date(start_date) : null;
    let endDate = end_date ? new Date(end_date) : null;

    // Auto-expand search range if no dates provided
    if (!startDate && !endDate) {
      const oldestContract = await prisma.contract.findFirst({
        orderBy: { postedDate: 'asc' },
        where: { postedDate: { not: null } }
      });

      if (oldestContract?.postedDate) {
        startDate = new Date(oldestContract.postedDate);
        startDate.setDate(startDate.getDate() - 30);
        endDate = new Date(oldestContract.postedDate);
        endDate.setDate(endDate.getDate() - 1);
      } else {
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 60);
      }
    }

    // Create indexing job record
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'contracts',
        status: 'running',
        startDate,
        endDate
      }
    });

    try {
      // Fetch contracts from SAM.gov
      const samGovUrl = `https://api.sam.gov/opportunities/v2/search`;
      const params = new URLSearchParams({
        api_key: config.samGovApiKey,
        limit: Math.min(limit, 1000),
        offset,
        postedFrom: startDate?.toISOString().split('T')[0],
        postedTo: endDate?.toISOString().split('T')[0]
      });

      const response = await axios.get(`${samGovUrl}?${params}`);
      const contractsData = response.data.opportunitiesData || [];
      
      let processedCount = 0;
      let errorsCount = 0;

      for (const contractData of contractsData) {
        try {
          const contractDetails = {
            noticeId: contractData.noticeId,
            title: contractData.title,
            description: contractData.description,
            agency: contractData.fullParentPathName,
            naicsCode: contractData.naicsCode,
            classificationCode: contractData.classificationCode,
            postedDate: contractData.postedDate ? new Date(contractData.postedDate) : null,
            setAsideCode: contractData.typeOfSetAsideCode,
            resourceLinks: contractData.resourceLinks || []
          };
          
          if (!contractDetails.noticeId) continue;

          // Upsert contract
          const contract = await prisma.contract.upsert({
            where: { noticeId: contractDetails.noticeId },
            update: {
              ...contractDetails,
              updatedAt: new Date()
            },
            create: contractDetails
          });

          processedCount++;
        } catch (error) {
          console.error('Error processing contract:', error);
          errorsCount++;
        }
      }

      // Update job status
      await prisma.indexingJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          recordsProcessed: processedCount,
          errorsCount,
          completedAt: new Date()
        }
      });

      res.json({
        success: true,
        job_id: job.id,
        contracts_processed: processedCount,
        errors: errorsCount,
        total_available: response.data.totalRecords || 0
      });

    } catch (error) {
      await prisma.indexingJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorDetails: error.message,
          completedAt: new Date()
        }
      });
      throw error;
    }

  } catch (error) {
    console.error('Contract fetch failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index contracts in vector database
router.post('/index', async (req, res) => {
  try {
    const { limit = 100 } = req.body;

    // Get contracts that haven't been indexed yet
    const contracts = await prisma.contract.findMany({
      where: { indexedAt: null },
      take: limit
    });

    if (contracts.length === 0) {
      const totalIndexed = await prisma.contract.count({
        where: { indexedAt: { not: null } }
      });
      return res.json({
        message: `All contracts already indexed. Total: ${totalIndexed}`,
        indexed_count: 0,
        total_indexed: totalIndexed
      });
    }

    // Create indexing job
    const job = await prisma.indexingJob.create({
      data: {
        jobType: 'contracts_indexing',
        status: 'running'
      }
    });

    let indexedCount = 0;
    let errorsCount = 0;

    try {
      for (const contract of contracts) {
        try {
          // Index contract in vector database
          await vectorService.indexContract(contract);
          
          // Mark as indexed
          await prisma.contract.update({
            where: { id: contract.id },
            data: { indexedAt: new Date() }
          });
          
          indexedCount++;
          
          // Commit changes periodically
          if (indexedCount % 10 === 0) {
            console.log(`Indexed ${indexedCount} contracts so far...`);
          }
        } catch (error) {
          console.error(`Error indexing contract ${contract.noticeId}:`, error);
          errorsCount++;
        }
      }

      // Update job status
      await prisma.indexingJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          recordsProcessed: indexedCount,
          errorsCount,
          completedAt: new Date()
        }
      });

      res.json({
        success: true,
        job_id: job.id,
        indexed_count: indexedCount,
        errors_count: errorsCount
      });

    } catch (error) {
      await prisma.indexingJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorDetails: error.message,
          completedAt: new Date()
        }
      });
      throw error;
    }

  } catch (error) {
    console.error('Contract indexing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search contracts endpoint
router.post('/search', async (req, res) => {
  try {
    const startTime = Date.now();
    const { query, limit = 10, use_vector = true } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    let contracts = [];

    if (use_vector) {
      // Use vector search
      try {
        const vectorResults = await vectorService.searchContracts(query, limit);
        
        // Get full contract details from database
        const contractIds = vectorResults.map(r => r.id);
        contracts = await prisma.contract.findMany({
          where: { noticeId: { in: contractIds } },
          orderBy: { postedDate: 'desc' }
        });

        // Add similarity scores
        contracts = contracts.map(contract => {
          const vectorResult = vectorResults.find(r => r.id === contract.noticeId);
          return {
            ...contract,
            similarity_score: vectorResult?.score || 0
          };
        });
      } catch (vectorError) {
        console.warn('Vector search failed, falling back to database search:', vectorError);
        use_vector = false;
      }
    }

    if (!use_vector || contracts.length === 0) {
      // Fallback to database search
      contracts = await prisma.contract.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { agency: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: Math.min(limit, 50),
        orderBy: { postedDate: 'desc' }
      });
    }

    const responseTime = (Date.now() - startTime) / 1000;

    // Log search query
    await prisma.searchQuery.create({
      data: {
        queryText: query,
        resultsCount: contracts.length,
        responseTime,
        userIp: req.ip
      }
    });

    res.json({
      query,
      results: {
        contracts: contracts,
        total_results: contracts.length
      },
      response_time: responseTime,
      search_method: use_vector ? 'vector' : 'database'
    });

  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze specific contract with AI
router.post('/:noticeId/analyze', async (req, res) => {
  try {
    const { noticeId } = req.params;
    
    const contract = await prisma.contract.findUnique({
      where: { noticeId }
    });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Simple AI analysis (placeholder)
    const analysis = {
      summary: `Analysis for contract ${contract.title}`,
      key_points: [
        'Contract opportunity identified',
        'Agency: ' + (contract.agency || 'Unknown'),
        'NAICS Code: ' + (contract.naicsCode || 'Not specified')
      ],
      recommendations: [
        'Review contract requirements carefully',
        'Prepare competitive proposal',
        'Consider partnership opportunities'
      ]
    };

    res.json({
      contract_id: noticeId,
      analysis
    });

  } catch (error) {
    console.error('Contract analysis failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
