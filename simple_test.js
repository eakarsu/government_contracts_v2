const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSimple() {
  const all = await prisma.contract.count();
  console.log('Total contracts:', all);
  
  const any = await prisma.contract.findMany({ take: 5 });
  console.log('Sample titles:', any.map(c => c.title));
  
  const tech = await prisma.contract.findMany({
    where: {
      OR: [
        { title: { contains: 'system', mode: 'insensitive' } },
        { title: { contains: 'technology', mode: 'insensitive' } },
        { title: { contains: 'digital', mode: 'insensitive' } }
      ]
    }
  });
  console.log('Tech results:', tech.length);
  
  const allResults = await prisma.contract.findMany({ take: 50 });
  console.log('All results:', allResults.length);
  
  await prisma.$disconnect();
}

testSimple();