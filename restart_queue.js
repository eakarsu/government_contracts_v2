#!/usr/bin/env node

const { prisma } = require('./config/database');

async function restartQueue() {
  try {
    console.log('🔄 Restarting document processing queue...');
    
    // Reset any documents stuck in processing status back to queued
    const resetResult = await prisma.documentProcessingQueue.updateMany({
      where: { status: 'processing' },
      data: {
        status: 'queued',
        startedAt: null,
        queuedAt: new Date()
      }
    });

    console.log(`✅ Reset ${resetResult.count} stuck processing documents to queued status`);
    
    // Show current queue status
    const statusCounts = await prisma.documentProcessingQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    console.log('\n📊 Updated Queue Status:');
    statusCounts.forEach(item => {
      console.log(`   ${item.status}: ${item._count.id} documents`);
    });

    console.log('\n✅ Queue restart completed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error restarting queue:', error);
    process.exit(1);
  }
}

restartQueue();