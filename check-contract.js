const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkContract() {
  try {
    const contract = await prisma.contract.findUnique({
      where: { noticeId: 'ef7770bc54104f588bc3c04fcb1c62fa' }
    });
    console.log('Contract found:', contract ? 'Yes' : 'No');
    console.log('Available contracts:', await prisma.contract.count());
    
    if (await prisma.contract.count() > 0) {
      const firstContract = await prisma.contract.findFirst();
      console.log('First contract ID:', firstContract.noticeId);
      console.log('First contract title:', firstContract.title);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkContract();