const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCyberTerms() {
  const contracts = await prisma.contract.findMany({ take: 5 });
  console.log('Sample contracts:');
  contracts.forEach((c, i) => {
    console.log(`${i+1}. ${c.title}`);
    console.log(`   NAICS: ${c.naicsCode}`);
    console.log(`   Description: ${c.description?.substring(0, 100)}...`);
    console.log('');
  });
  
  const securityContracts = await prisma.contract.findMany({
    where: {
      OR: [
        { title: { contains: 'security', mode: 'insensitive' } },
        { description: { contains: 'security', mode: 'insensitive' } },
        { naicsCode: { in: ['541519', '541512'] } }
      ]
    },
    take: 5
  });
  
  console.log('Security-related contracts:', securityContracts.length);
  securityContracts.forEach(c => console.log(c.title));
  
  await prisma.$disconnect();
}

checkCyberTerms();