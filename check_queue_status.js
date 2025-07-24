const { prisma } = require('./config/database');

async function checkQueueStatus() {
  try {
    console.log('🔍 Checking current queue status...\n');
    
    // Get status counts
    const statusCounts = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    
    console.log('📊 Queue Status Summary:');
    statusCounts.forEach(item => {
      console.log(`   ${item.status}: ${item._count.id} documents`);
    });
    
    // Get details of processing documents
    const processingDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'processing' },
      select: {
        id: true,
        filename: true,
        contractNoticeId: true,
        startedAt: true,
        queuedAt: true
      },
      orderBy: { startedAt: 'desc' },
      take: 10
    });
    
    if (processingDocs.length > 0) {
      console.log('\n🔄 Currently Processing Documents:');
      processingDocs.forEach(doc => {
        const duration = doc.startedAt ? 
          ((Date.now() - new Date(doc.startedAt).getTime()) / 1000 / 60).toFixed(1) : 
          'unknown';
        console.log(`   ID: ${doc.id}, File: ${doc.filename}, Duration: ${duration} min`);
      });
    }
    
    // Get details of completed documents (last 5)
    const completedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'completed' },
      select: {
        id: true,
        filename: true,
        completedAt: true
      },
      orderBy: { completedAt: 'desc' },
      take: 5
    });
    
    if (completedDocs.length > 0) {
      console.log('\n✅ Recently Completed Documents:');
      completedDocs.forEach(doc => {
        console.log(`   ID: ${doc.id}, File: ${doc.filename}, Completed: ${doc.completedAt}`);
      });
    }
    
    // Get details of failed documents
    const failedDocs = await prisma.documentProcessingQueue.findMany({
      where: { status: 'failed' },
      select: {
        id: true,
        filename: true,
        errorMessage: true,
        failedAt: true
      },
      orderBy: { failedAt: 'desc' },
      take: 5
    });
    
    if (failedDocs.length > 0) {
      console.log('\n❌ Recently Failed Documents:');
      failedDocs.forEach(doc => {
        console.log(`   ID: ${doc.id}, File: ${doc.filename}, Error: ${doc.errorMessage}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking queue status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkQueueStatus();