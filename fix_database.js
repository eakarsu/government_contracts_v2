 const { Pool } = require('pg');
require('dotenv').config();

const config = require('./config/env');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || config.databaseUrl
});

async function setupDatabase() {
  try {
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contracts (
        id SERIAL PRIMARY KEY,
        notice_id VARCHAR(255) UNIQUE NOT NULL,
        title TEXT,
        description TEXT,
        agency VARCHAR(255),
        naics_code VARCHAR(50),
        classification_code VARCHAR(50),
        posted_date TIMESTAMP,
        set_aside VARCHAR(100),
        set_aside_code VARCHAR(50),
        award_amount DECIMAL(15,2),
        response_deadline TIMESTAMP,
        resource_links JSONB DEFAULT '[]',
        indexed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        contract_value DECIMAL(15,2)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS indexing_jobs (
        id SERIAL PRIMARY KEY,
        job_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'running',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        records_processed INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        error_details TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_queries (
        id SERIAL PRIMARY KEY,
        query_text TEXT NOT NULL,
        results_count INTEGER DEFAULT 0,
        response_time DECIMAL(10,3),
        user_ip VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert test contract
    await pool.query(`
      INSERT INTO contracts (
        notice_id, 
        title, 
        description, 
        agency, 
        naics_code, 
        posted_date, 
        set_aside,
        contract_value
      ) VALUES (
        'ef7770bc54104f588bc3c04fcb1c62fa',
        'Cybersecurity Services for Federal Agency',
        'Provide comprehensive cybersecurity services including network monitoring, threat detection, incident response, and security assessments for federal government agency.',
        'Department of Defense',
        '541511',
        NOW() - INTERVAL '7 days',
        'Small Business Set-Aside',
        2500000.00
      ) ON CONFLICT (notice_id) DO NOTHING
    `);

    console.log('Database setup complete');
    
    // Verify the contract was added
    const result = await pool.query('SELECT notice_id, title FROM contracts WHERE notice_id = $1', ['ef7770bc54104f588bc3c04fcb1c62fa']);
    console.log('Test contract:', result.rows);
    
  } catch (error) {
    console.error('Database setup failed:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase();
