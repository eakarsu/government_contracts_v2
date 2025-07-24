const { prisma } = require('../config/database');
const fs = require('fs-extra');
const path = require('path');

async function processRegularMode(contract_id, limit, auto_queue) {
  console.log('🔄 [DEBUG] Using REGULAR PROCESSING MODE for large-scale processing');

  // Step 1: Check if there are documents in queue or if we need to populate it
  const queueStatus = await prisma.documentProcessingQueue.groupBy({
    by: ['status'],
    _count: { id: true }
  });

  const statusCounts = {};
  queueStatus.forEach(item => {
    statusCounts[item.status] = item._count.id;
  });

  const queuedCount = statusCounts.queued || 0;
  const totalInQueue = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

  console.log(`📊 [DEBUG] Current queue status: ${queuedCount} queued, ${totalInQueue} total`);

  // Step 2: If no documents in queue and auto_queue is enabled, populate the queue first
  if (queuedCount === 0 && auto_queue) {
    console.log('🔄 [DEBUG] No documents in queue, auto-populating from contracts...');
    
    // Get contracts with resourceLinks
    const contractsWithDocs = await prisma.contract.count({
      where: { resourceLinks: { not: null } }
    });
    console.log(`📄 [DEBUG] Found ${contractsWithDocs} contracts with document links`);

    if (contractsWithDocs === 0) {
      return {
        success: false,
        message: 'No contracts with document links found. Please fetch contracts first.',
        processed_count: 0
      };
    }

    // Populate queue with documents
    const contracts = await prisma.contract.findMany({
      where: { 
        resourceLinks: { not: null },
        ...(contract_id ? { noticeId: contract_id } : {})
      },
      take: limit,
      select: {
        noticeId: true,
        title: true,
        resourceLinks: true,
        agency: true
      }
    });

    let queuedDocuments = 0;
    for (const contract of contracts) {
      const resourceLinks = contract.resourceLinks;
      if (!resourceLinks || !Array.isArray(resourceLinks)) continue;

      for (let i = 0; i < resourceLinks.length; i++) {
        const docUrl = resourceLinks[i];
        
        try {
          const urlParts = docUrl.split('/');
          const originalFilename = urlParts[urlParts.length - 1] || `document_${i + 1}`;
          // Note: filename will be updated with correct extension during processing
          const filename = `${contract.noticeId}_${originalFilename}`;

          // Check if already queued
          const existing = await prisma.documentProcessingQueue.findFirst({
            where: {
              contractNoticeId: contract.noticeId,
              documentUrl: docUrl
            }
          });

          if (existing) {
            console.log(`⚠️ [DEBUG] Document already queued: ${filename}`);
            continue;
          }

          // Check if document was already downloaded locally
          const downloadPath = path.join(process.cwd(), 'downloaded_documents');
          const possibleLocalFiles = await fs.readdir(downloadPath).catch(() => []);
          const localFile = possibleLocalFiles.find(file => 
            file.includes(contract.noticeId) && 
            (file.includes(originalFilename.replace(/\.[^/.]+$/, '')) || file.includes('document'))
          );
          
          const localFilePath = localFile ? path.join(downloadPath, localFile) : null;
          
          if (localFilePath) {
            console.log(`📁 [DEBUG] Found local file for document: ${localFile}`);
          }

          // Add to queue (filename will be corrected during processing)
          await prisma.documentProcessingQueue.create({
            data: {
              contractNoticeId: contract.noticeId,
              documentUrl: docUrl,
              localFilePath: localFilePath,
              description: `${contract.title || 'Untitled'} - ${contract.agency || 'Unknown Agency'}`,
              filename: filename,
              status: 'queued',
              queuedAt: new Date(),
              retryCount: 0,
              maxRetries: 3
            }
          });

          queuedDocuments++;
          console.log(`✅ [DEBUG] Queued document: ${filename}`);

        } catch (error) {
          console.error(`❌ [DEBUG] Error queueing document ${docUrl}:`, error.message);
        }
      }
    }

    console.log(`📊 [DEBUG] Queued ${queuedDocuments} documents for processing`);
  }

  // Step 3: Get queued documents for processing
  console.log('🔄 [DEBUG] Starting queue processing...');

  // Get queued documents
  const queuedDocs = await prisma.documentProcessingQueue.findMany({
    where: { status: 'queued' },
    take: limit,
    orderBy: { queuedAt: 'asc' }
  });

  if (queuedDocs.length === 0) {
    return {
      success: true,
      message: 'No documents in queue to process',
      processed_count: 0,
      queue_status: statusCounts
    };
  }

  console.log(`🔄 [DEBUG] Found ${queuedDocs.length} documents to process`);

  // Create processing job
  const job = await prisma.indexingJob.create({
    data: {
      jobType: 'parallel_processing',
      status: 'running',
      startDate: new Date()
    }
  });

  console.log(`✅ [DEBUG] Created processing job: ${job.id}`);

  // Use balanced concurrency - 10 provides optimal performance without resource contention
  const autoConcurrency = Math.min(10, Math.floor(queuedDocs.length / 2));

  return {
    success: true,
    message: `Started processing ALL ${queuedDocs.length} documents from queue with ${autoConcurrency} workers (max 10 for optimal performance)`,
    job_id: job.id,
    documents_count: queuedDocs.length,
    concurrency: autoConcurrency,
    processing_method: 'stable_concurrency_processing',
    queuedDocs: queuedDocs,
    autoConcurrency: autoConcurrency
  };
}

module.exports = {
  processRegularMode
};