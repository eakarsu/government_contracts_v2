const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createContractEmbeddingsTable() {
  try {
    console.log('Creating contract_embeddings table...');
    
    // Create table using raw SQL
    await prisma.$executeRaw`
      CREATE EXTENSION IF NOT EXISTS vector;
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS contract_embeddings (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER NOT NULL,
        embedding vector(384),
        content_summary TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_embeddings_contract_id ON contract_embeddings(contract_id);
    `;
    
    console.log('✅ contract_embeddings table created successfully');
    
    // Verify table exists
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contract_embeddings'
      );
    `;
    
    console.log('Table exists:', result[0].exists);
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createContractEmbeddingsTable();