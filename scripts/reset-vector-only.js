const vectorService = require('../services/vectorService');
const fs = require('fs-extra');
const path = require('path');
const { assertDestructiveResetAllowed } = require('./destructiveGuard');

async function resetVectorDatabase() {
  assertDestructiveResetAllowed();
  console.log('🔄 Starting vector database reset...');
  
  try {
    // Reset Vector Database
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
    
    // Verify reset
    console.log('🔍 Verifying reset...');
    
    const vectorStats = await vectorService.getCollectionStats();
    
    console.log('📊 Vector database counts after reset:');
    console.log(`   - Vector Contracts: ${vectorStats.contracts}`);
    console.log(`   - Vector Documents: ${vectorStats.documents}`);
    console.log(`   - Status: ${vectorStats.status}`);
    
    if (vectorStats.contracts === 0 && vectorStats.documents === 0) {
      console.log('✅ Vector database reset completed successfully!');
      console.log('🎉 Vector database is now empty and ready for fresh data.');
    } else {
      console.log('⚠️ Some vector data may still remain. Check the counts above.');
    }
    
  } catch (error) {
    console.error('❌ Error during vector database reset:', error);
    throw error;
  }
}

// Run the reset if this script is executed directly
if (require.main === module) {
  resetVectorDatabase()
    .then(() => {
      console.log('🏁 Vector reset script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Vector reset script failed:', error);
      process.exit(1);
    });
}

module.exports = { resetVectorDatabase };
