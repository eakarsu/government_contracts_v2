#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const opportunities = [
  ['AI-DEMO-001', 'Zero Trust Security Modernization', 'Department of Defense', '541512', '8A'],
  ['AI-DEMO-002', 'Cloud Data Platform Engineering', 'General Services Administration', '541511', 'SB'],
  ['AI-DEMO-003', 'Emergency Communications Analytics', 'Department of Homeland Security', '541519', 'HUBZone'],
  ['AI-DEMO-004', 'Veterans Digital Experience Support', 'Department of Veterans Affairs', '541511', 'SDVOSB'],
  ['AI-DEMO-005', 'Public Health Data Interoperability', 'Department of Health and Human Services', '541512', 'WOSB'],
  ['AI-DEMO-006', 'Financial Fraud Detection Services', 'Department of the Treasury', '541611', 'SB'],
  ['AI-DEMO-007', 'Mission Network Operations', 'Department of the Air Force', '541513', '8A'],
  ['AI-DEMO-008', 'Supply Chain Risk Intelligence', 'Department of the Navy', '541614', 'SB'],
  ['AI-DEMO-009', 'Geospatial Data Processing Platform', 'Department of the Interior', '541370', 'HUBZone'],
  ['AI-DEMO-010', 'Grants Management Modernization', 'Department of Education', '541511', 'WOSB'],
  ['AI-DEMO-011', 'Cybersecurity Operations Center', 'Department of Energy', '541512', 'SDVOSB'],
  ['AI-DEMO-012', 'Acquisition Data Quality Services', 'General Services Administration', '541611', '8A'],
  ['AI-DEMO-013', 'Transportation Safety AI Pilot', 'Department of Transportation', '541715', 'SB'],
  ['AI-DEMO-014', 'Environmental Compliance Analytics', 'Environmental Protection Agency', '541620', 'WOSB'],
  ['AI-DEMO-015', 'Case Management Platform Support', 'Department of Justice', '541511', '8A'],
  ['AI-DEMO-016', 'Agricultural Forecasting Data Services', 'Department of Agriculture', '541690', 'HUBZone'],
];

async function main() {
  const now = new Date();
  for (const [noticeId, title, agency, naicsCode, setAsideCode] of opportunities) {
    await prisma.contract.upsert({
      where: { noticeId },
      update: {},
      create: {
        noticeId,
        title,
        agency,
        naicsCode,
        setAsideCode,
        classificationCode: 'R',
        postedDate: new Date(now.getTime() - opportunities.findIndex(item => item[0] === noticeId) * 86_400_000),
        description: `${title} acquisition requiring demonstrated delivery experience, compliant staffing, measurable outcomes, and a defensible price-to-win strategy.`,
        resourceLinks: [],
      },
    });
  }
  console.log(`AI opportunity catalog ready (${opportunities.length} records).`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
