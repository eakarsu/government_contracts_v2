const { prisma } = require('../config/database');
const vectorService = require('../services/vectorService');
const fs = require('fs-extra');
const path = require('path');

async function resetDatabases() {
  console.log('🔄 Starting complete database reset...');
  
  try {
    // 1. Reset PostgreSQL database
    console.log('📊 Resetting PostgreSQL database...');
    
    // Delete all records from all tables (in correct order to avoid foreign key constraints)
    await prisma.documentAnalysis.deleteMany({});
    console.log('✅ Cleared DocumentAnalysis table');
    
    await prisma.documentProcessingQueue.deleteMany({});
    console.log('✅ Cleared DocumentProcessingQueue table');
    
    await prisma.indexingJob.deleteMany({});
    console.log('✅ Cleared IndexingJob table');
    
    await prisma.contract.deleteMany({});
    console.log('✅ Cleared Contract table');
    
    // 2. Reset Vector Database
    console.log('🔍 Resetting Vector database...');
    
    const vectorIndexPath = path.join(process.cwd(), 'vector_indexes');
    
    if (await fs.pathExists(vectorIndexPath)) {
      await fs.remove(vectorIndexPath);
      console.log('✅ Removed vector indexes directory');
    }
    
    // Recreate vector indexes
    await fs.ensureDir(vectorIndexPath);
    console.log('✅ Recreated vector indexes directory');
    
    // Reinitialize vector service
    await vectorService.initialize();
    console.log('✅ Reinitialized vector service');
    
    // 3. Verify reset
    console.log('🔍 Verifying reset...');
    
    const contractCount = await prisma.contract.count();
    const jobCount = await prisma.indexingJob.count();
    const queueCount = await prisma.documentProcessingQueue.count();
    const analysisCount = await prisma.documentAnalysis.count();
    
    const vectorStats = await vectorService.getCollectionStats();
    
    console.log('📊 Database counts after reset:');
    console.log(`   - Contracts: ${contractCount}`);
    console.log(`   - Indexing Jobs: ${jobCount}`);
    console.log(`   - Processing Queue: ${queueCount}`);
    console.log(`   - Document Analysis: ${analysisCount}`);
    console.log(`   - Vector Contracts: ${vectorStats.contracts}`);
    console.log(`   - Vector Documents: ${vectorStats.documents}`);
    
    if (contractCount === 0 && jobCount === 0 && queueCount === 0 && 
        analysisCount === 0 && vectorStats.contracts === 0 && vectorStats.documents === 0) {
      console.log('✅ Database reset completed successfully!');
      console.log('🎉 All databases are now empty and ready for fresh data.');
    } else {
      console.log('⚠️ Some data may still remain. Check the counts above.');
    }
    
  } catch (error) {
    console.error('❌ Error during database reset:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the reset if this script is executed directly
if (require.main === module) {
  resetDatabases()
    .then(() => {
      console.log('🏁 Reset script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Reset script failed:', error);
      process.exit(1);
    });
}

module.exports = { resetDatabases };
