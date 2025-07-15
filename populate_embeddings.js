const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const AIService = require('./services/aiService');
const logger = require('./utils/logger');

const prisma = new PrismaClient();

async function populateContractEmbeddings() {
  console.log('🔄 Populating contract embeddings...');
  
  try {
    // Get all contracts from the database
    const contracts = await prisma.contract.findMany({
      take: 300 // Process all 300 contracts
    });
    
    console.log(`📊 Found ${contracts.length} contracts to process`);
    
    let processed = 0;
    let failed = 0;
    
    for (const contract of contracts) {
      try {
        // Create content for embedding
        const content = `${contract.title} ${contract.description || ''} ${contract.agency || ''}`;
        
        if (content.trim().length < 10) {
          console.log(`⚠️  Skipping contract ${contract.id} - insufficient content`);
          continue;
        }
        
        // Generate embedding
        const embedding = await AIService.generateEmbedding(content);
        
        // Generate summary
        const summary = await AIService.summarizeDocument(content);
        
        // Store in contract_embeddings table using Prisma
        await prisma.$executeRaw`
          INSERT INTO contract_embeddings (contract_id, embedding, content_summary, metadata)
          VALUES (${contract.id}, ${JSON.stringify(embedding)}, ${summary}, ${JSON.stringify({
            contentLength: content.length,
            indexedAt: new Date().toISOString()
          })}::jsonb) 
          ON CONFLICT (contract_id) 
          DO UPDATE SET 
            embedding = EXCLUDED.embedding,
            content_summary = EXCLUDED.content_summary,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `;
        
        processed++;
        
        // Progress indicator
        if (processed % 10 === 0) {
          console.log(`✅ Processed ${processed}/${contracts.length} contracts`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to process contract ${contract.id}:`, error.message);
        failed++;
      }
    }
    
    console.log(`🎉 Embedding population complete!`);
    console.log(`✅ Successfully processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);
    
    // Verify results
    const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM contract_embeddings`;
    console.log(`📈 Total embeddings stored: ${count[0].count}`);
    
  } catch (error) {
    console.error('💥 Error populating embeddings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Create table first if it doesn't exist
async function createTable() {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS contract_embeddings (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER NOT NULL,
        embedding TEXT NOT NULL, -- Store as JSON string
        content_summary TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_embeddings_contract_id ON contract_embeddings(contract_id)
    `;
    
    console.log('✅ contract_embeddings table created');
  } catch (error) {
    console.error('❌ Error creating table:', error);
  }
}

async function main() {
  await createTable();
  await populateContractEmbeddings();
}

main();