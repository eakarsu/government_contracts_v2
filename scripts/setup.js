const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function setupDatabase() {
  console.log('Setting up database...');
  
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL not set, skipping database setup');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Read and execute migration file
    const migrationPath = path.join(__dirname, '../database/migrations/001_create_enhanced_tables.sql');
    if (fs.existsSync(migrationPath)) {
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(migrationSQL);
      console.log('✅ Database tables created successfully');
    } else {
      console.log('⚠️ Migration file not found, creating basic structure...');
      await pool.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log('✅ Basic database structure created');
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
  } finally {
    await pool.end();
  }
}

async function createDirectories() {
  console.log('Creating required directories...');
  
  const directories = [
    'uploads/rfp-documents',
    'uploads/documents',
    'logs',
    'vector_indexes',
    'database/migrations',
    'routes/api',
    'middleware',
    'utils',
    'services'
  ];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  }
}

async function checkEnvironment() {
  console.log('Checking environment variables...');
  
  if (!fs.existsSync('.env')) {
    console.log('⚠️ .env file not found. Copy .env.example to .env and configure it.');
    return;
  }

  const requiredVars = ['DATABASE_URL'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log('⚠️ Missing environment variables:', missing.join(', '));
    console.log('💡 Please configure these in your .env file');
  } else {
    console.log('✅ Required environment variables are set');
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.log('⚠️ OPENROUTER_API_KEY not set - AI features will use placeholder responses');
  }
}

async function main() {
  try {
    require('dotenv').config();
    
    console.log('🚀 Starting setup process...\n');
    
    await checkEnvironment();
    await createDirectories();
    await setupDatabase();
    
    console.log('\n✅ Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Configure your .env file with required API keys');
    console.log('2. Install client dependencies: cd client && npm install && cd ..');
    console.log('3. Start the development servers: npm run dev-full');
    console.log('4. Access the application at http://localhost:3001');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { setupDatabase, createDirectories, checkEnvironment };
