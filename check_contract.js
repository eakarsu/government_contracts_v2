const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkContract() {
  try {
    console.log('🔍 Checking database for contract: ef7770bc54104f588bc3c04fcb1c62fa');
    
    const contract = await prisma.contract.findUnique({
      where: { noticeId: 'ef7770bc54104f588bc3c04fcb1c62fa' }
    });
    
    if (contract) {
      console.log('✅ Contract FOUND:', {
        noticeId: contract.noticeId,
        title: contract.title,
        agency: contract.agency,
        naicsCode: contract.naicsCode,
        postedDate: contract.postedDate
      });
    } else {
      console.log('❌ Contract NOT FOUND with noticeId: ef7770bc54104f588bc3c04fcb1c62fa');
      
      // Show available contracts
      const count = await prisma.contract.count();
      console.log(`📊 Total contracts in database: ${count}`);
      
      if (count > 0) {
        const contracts = await prisma.contract.findMany({
          take: 5,
          select: { noticeId: true, title: true, agency: true, postedDate: true }
        });
        console.log('📋 Available contracts:', contracts);
      }
    }
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkContract();