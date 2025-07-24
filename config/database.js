const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const config = require('./env');

// Initialize Prisma Client
const prisma = new PrismaClient();

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

// Graceful shutdown
async function disconnect() {
  try {
    await pool.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

// Query function
const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool,
  testConnection,
  disconnect,
  prisma
};
