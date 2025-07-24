const { PrismaClient } = require('@prisma/client');
const queryParser = require('./services/queryParser');

async function testNLPSearch() {
  const prisma = new PrismaClient();
  
  try {
    // Test database connection
    const contractCount = await prisma.contract.count();
    console.log('Database has', contractCount, 'contracts');
    
    if (contractCount === 0) {
      console.log('No contracts in database');
      return;
    }
    
    // Test NLP parsing
    const testQueries = [
      'Show me IT contracts under $500K',
      'Find cybersecurity opportunities',
      'Construction projects in California',
      'Small business set-aside opportunities'
    ];
    
    for (const query of testQueries) {
      console.log('\n--- Testing:', query, '---');
      const parsed = await queryParser.parseNaturalLanguageQuery(query);
      console.log('Keywords:', parsed.parsedCriteria.keywords);
      console.log('Amount range:', parsed.parsedCriteria.amountRange);
      
      // Test actual database search
      const results = await prisma.contract.findMany(parsed.prismaQuery);
      console.log('Found', results.length, 'results');
      
      if (results.length > 0) {
        console.log('First result:', results[0].title.substring(0, 80));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNLPSearch();