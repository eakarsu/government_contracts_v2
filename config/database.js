const fs = require('fs');
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const config = require('./env');

function databaseSsl(configuration = config) {
  if (!configuration.databaseSsl) return false;
  let ca;
  if (configuration.databaseSslCa) {
    ca = configuration.databaseSslCa.includes('BEGIN CERTIFICATE')
      ? configuration.databaseSslCa.replace(/\\n/g, '\n')
      : fs.readFileSync(configuration.databaseSslCa, 'utf8');
  }
  return { ca, rejectUnauthorized: true };
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: databaseSsl(config),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
const prisma = new PrismaClient();

async function testConnection() {
  const client = await pool.connect();
  client.release();
  return true;
}

async function disconnect() {
  await pool.end();
}

const query = (text, params) => pool.query(text, params);

module.exports = { databaseSsl, disconnect, pool, prisma, query, testConnection };
