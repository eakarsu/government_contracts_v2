#!/usr/bin/env node

/**
 * Migration script to move from raw SQL to Prisma
 * This script will:
 * 1. Apply Prisma schema to database
 * 2. Seed the database with sample data including 15-section template
 * 3. Test that the system works correctly
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  console.log(`   Running: ${command}`);
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(`   ✅ ${stdout.trim()}`);
    if (stderr && !stderr.includes('warning')) console.log(`   ⚠️  ${stderr.trim()}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Prisma Migration for RFP System');
  console.log('==========================================');

  // Step 1: Install required dependencies
  const hasTsx = await runCommand('which tsx', 'Checking for tsx (TypeScript runner)');
  if (!hasTsx) {
    console.log('\n📦 Installing tsx for running TypeScript seed file...');
    await runCommand('npm install -g tsx', 'Installing tsx globally');
  }

  // Step 2: Generate Prisma client
  await runCommand('npx prisma generate', 'Generating Prisma client');

  // Step 3: Push schema to database (with data loss warning)
  console.log('\n⚠️  WARNING: This will reset your database and remove existing data!');
  console.log('   This is necessary to migrate from raw SQL to Prisma schema.');
  
  await runCommand('npx prisma db push --accept-data-loss --skip-generate', 'Applying Prisma schema to database');

  // Step 4: Seed the database with sample data
  await runCommand('npx tsx prisma/seed.ts', 'Seeding database with sample data');

  // Step 5: Verify the migration
  console.log('\n🔍 Verifying migration...');
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Check templates
    const templates = await prisma.rfpTemplate.findMany();
    console.log(`   ✅ Found ${templates.length} RFP templates`);
    
    // Check for 15-section template
    const template15 = templates.find(t => t.sections && t.sections.length >= 15);
    if (template15) {
      console.log(`   ✅ Found 15-section template: "${template15.name}" with ${template15.sections.length} sections`);
    } else {
      console.log('   ⚠️  No 15-section template found');
    }
    
    // Check company profiles
    const profiles = await prisma.companyProfile.findMany();
    console.log(`   ✅ Found ${profiles.length} company profiles`);
    
    // Check contracts
    const contracts = await prisma.contract.findMany();
    console.log(`   ✅ Found ${contracts.length} contracts`);
    
    await prisma.$disconnect();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your application: npm run dev');
    console.log('   2. Go to RFP Generator in the UI');
    console.log('   3. Select the "Comprehensive 15-Section Government RFP Template"');
    console.log('   4. Generate an RFP - it should now create 15 sections!');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.log('\n🛠️  Try running the seed script manually:');
    console.log('   npx tsx prisma/seed.ts');
  }
}

main().catch(console.error);