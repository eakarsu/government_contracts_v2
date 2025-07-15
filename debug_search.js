const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugSearch() {
  // Check what's actually in the database
  const allContracts = await prisma.contract.findMany({ take: 5 });
  console.log('Sample contracts:');
  allContracts.forEach((c, i) => {
    console.log(`${i+1}. ${c.title}`);
    console.log(`   NAICS: ${c.naicsCode}`);
    console.log(`   Description: ${c.description?.substring(0, 100)}...`);
    console.log('');
  });
  
  // Test broad search
  const broadSearch = await prisma.contract.findMany({
    where: {
      OR: [
        { title: { contains: 'security', mode: 'insensitive' } },
        { title: { contains: 'IT', mode: 'insensitive' } },
        { title: { contains: 'technology', mode: 'insensitive' } },
        { description: { contains: 'security', mode: 'insensitive' } }
      ]
    },
    take: 10
  });
  console.log('Broad search results:', broadSearch.length);
  broadSearch.forEach(c => console.log(c.title));
  
  // Test simple search
  const simple = await prisma.contract.findMany({
    where: {
      OR: [
        { title: { contains: 'system', mode: 'insensitive' } },
        { description: { contains: 'system', mode: 'insensitive' } }
      ]
    },
    take: 5
  });
  console.log('System search:', simple.length);
  
  await prisma.$disconnect();
}

debugSearch();