const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:sel33man@localhost:5432/db'
});

async function addTestContract() {
  try {
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

    console.log('Test contract added successfully');
    
    // Verify the contract was added
    const result = await pool.query('SELECT notice_id, title FROM contracts WHERE notice_id = $1', ['ef7770bc54104f588bc3c04fcb1c62fa']);
    console.log('Contract found:', result.rows);
    
  } catch (error) {
    console.error('Error adding test contract:', error.message);
  } finally {
    await pool.end();
  }
}

addTestContract();