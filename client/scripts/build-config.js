#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read .env file from project root
const envPath = path.join(__dirname, '../../.env');
let apiBaseUrl = '/api'; // default fallback

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('API_BASE_URL=')) {
      apiBaseUrl = line.split('=')[1].trim().replace(/['"]/g, ''); // Remove quotes
      break;
    }
  }
} else {
  // For hosted/production environment without .env file
  if (process.env.NODE_ENV === 'production') {
    apiBaseUrl = '/api'; // Use relative path in production
  }
}

// Override for production builds - always use relative path when building for hosting
if (process.env.NODE_ENV === 'production' || process.argv.includes('--production')) {
  apiBaseUrl = '/api';
}

// Create config.js in public folder only (no longer needed for runtime)
const configContent = `window.API_CONFIG = { BASE_URL: '${apiBaseUrl}' };`;
const configPath = path.join(__dirname, '../public/config.js');

// Ensure public directory exists
const publicDir = path.dirname(configPath);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(configPath, configContent);
console.log(`✅ Generated config.js with API_BASE_URL: ${apiBaseUrl}`);