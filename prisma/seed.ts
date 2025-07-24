import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // 1. Create sample company profile
  const companyProfile = await prisma.companyProfile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      companyName: 'Norshin Technologies',
      basicInfo: {
        address: '123 Technology Drive',
        city: 'Washington',
        state: 'DC',
        zipCode: '20001',
        phone: '(555) 123-4567',
        email: 'contact@norshin.com',
        website: 'https://norshin.com'
      },
      capabilities: {
        coreCompetencies: [
          'Software Development',
          'Cloud Computing',
          'Cybersecurity',
          'Data Analytics',
          'AI/ML Solutions'
        ],
        technicalSkills: [
          'Node.js',
          'React',
          'Python',
          'Java',
          'AWS',
          'Azure',
          'Docker',
          'Kubernetes'
        ],
        methodologies: [
          'Agile Development',
          'DevOps',
          'CI/CD',
          'Security by Design'
        ],
        certifications: [
          'ISO 27001',
          'SOC 2',
          'FedRAMP',
          'CMMI Level 3'
        ],
        securityClearances: [
          'Secret',
          'Top Secret'
        ]
      },
      pastPerformance: [
        {
          contractName: 'DOD Software Modernization',
          agency: 'Department of Defense',
          value: 5000000,
          duration: '24 months',
          performanceRating: 'exceptional',
          relevanceScore: 0.9,
          description: 'Modernized legacy systems for defense applications'
        },
        {
          contractName: 'GSA Cloud Migration',
          agency: 'General Services Administration',
          value: 3500000,
          duration: '18 months',
          performanceRating: 'very_good',
          relevanceScore: 0.8,
          description: 'Migrated federal systems to cloud infrastructure'
        }
      ],
      keyPersonnel: [
        {
          name: 'John Smith',
          role: 'Project Manager',
          clearance: 'Secret',
          experience: '10 years',
          certifications: ['PMP', 'CISSP']
        },
        {
          name: 'Jane Doe',
          role: 'Technical Lead',
          clearance: 'Top Secret',
          experience: '12 years',
          certifications: ['AWS Solutions Architect', 'CISM']
        }
      ]
    }
  })

  console.log('✅ Created company profile:', companyProfile.companyName)

  // 2. Create 15-section RFP template
  const rfpTemplate = await prisma.rfpTemplate.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Comprehensive 15-Section Government RFP Template',
      agency: 'General Template',
      description: 'Complete 15-section template for government contract proposals',
      sections: [
        {
          id: 'executive_summary',
          title: 'Executive Summary',
          description: 'High-level overview of the proposal and key value propositions',
          requirements: ['Project understanding', 'Key benefits', 'Team qualifications', 'Value proposition'],
          wordLimit: 1000
        },
        {
          id: 'technical_approach',
          title: 'Technical Approach',
          description: 'Detailed technical methodology and solution architecture',
          requirements: ['Architecture design', 'Technology stack', 'Implementation methodology', 'Technical innovation'],
          wordLimit: 3000
        },
        {
          id: 'management_approach',
          title: 'Management Approach',
          description: 'Project management methodology and organizational structure',
          requirements: ['Project timeline', 'Resource allocation', 'Communication plan', 'Governance structure'],
          wordLimit: 2000
        },
        {
          id: 'past_performance',
          title: 'Past Performance',
          description: 'Relevant experience and successful project examples',
          requirements: ['Similar projects', 'Client references', 'Success metrics', 'Lessons learned'],
          wordLimit: 2500
        },
        {
          id: 'key_personnel',
          title: 'Key Personnel',
          description: 'Team members, qualifications, and role assignments',
          requirements: ['Team structure', 'Key qualifications', 'Role assignments', 'Availability'],
          wordLimit: 2000
        },
        {
          id: 'cost_proposal',
          title: 'Cost Proposal',
          description: 'Detailed pricing structure and cost justification',
          requirements: ['Labor costs', 'Material costs', 'Overhead expenses', 'Cost justification'],
          wordLimit: 1500
        },
        {
          id: 'schedule_milestones',
          title: 'Schedule and Milestones',
          description: 'Project timeline with key deliverables and milestones',
          requirements: ['Project phases', 'Key milestones', 'Dependencies', 'Critical path'],
          wordLimit: 1500
        },
        {
          id: 'risk_management',
          title: 'Risk Management',
          description: 'Risk identification, assessment, and mitigation strategies',
          requirements: ['Risk identification', 'Risk assessment', 'Mitigation strategies', 'Contingency plans'],
          wordLimit: 1500
        },
        {
          id: 'quality_assurance',
          title: 'Quality Assurance',
          description: 'Quality control processes and testing methodologies',
          requirements: ['QA processes', 'Testing methodology', 'Quality metrics', 'Continuous improvement'],
          wordLimit: 1500
        },
        {
          id: 'security_compliance',
          title: 'Security and Compliance',
          description: 'Security measures and regulatory compliance approach',
          requirements: ['Security framework', 'Compliance requirements', 'Data protection', 'Access controls'],
          wordLimit: 2000
        },
        {
          id: 'transition_plan',
          title: 'Transition Plan',
          description: 'Implementation and deployment strategy',
          requirements: ['Implementation phases', 'Deployment strategy', 'Change management', 'User training'],
          wordLimit: 1500
        },
        {
          id: 'training_support',
          title: 'Training and Support',
          description: 'Training programs and ongoing support services',
          requirements: ['Training curriculum', 'Support structure', 'Documentation', 'Knowledge transfer'],
          wordLimit: 1200
        },
        {
          id: 'maintenance_sustainment',
          title: 'Maintenance and Sustainment',
          description: 'Long-term maintenance and system sustainment approach',
          requirements: ['Maintenance strategy', 'Support levels', 'Performance monitoring', 'Lifecycle management'],
          wordLimit: 1500
        },
        {
          id: 'innovation_value',
          title: 'Innovation and Added Value',
          description: 'Innovative solutions and additional value propositions',
          requirements: ['Innovation approach', 'Value-added services', 'Emerging technologies', 'Competitive advantages'],
          wordLimit: 1200
        },
        {
          id: 'subcontractor_teaming',
          title: 'Subcontractor and Teaming',
          description: 'Subcontractor relationships and teaming arrangements',
          requirements: ['Teaming strategy', 'Subcontractor qualifications', 'Partnership agreements', 'Coordination approach'],
          wordLimit: 1000
        }
      ],
      evaluationCriteria: {
        technical: 40,
        cost: 30,
        past_performance: 20,
        management: 10
      },
      usageCount: 0
    }
  })

  console.log('✅ Created 15-section RFP template:', rfpTemplate.name)

  // 3. Create sample contracts
  const sampleContracts = [
    {
      noticeId: 'W912DY-25-R-0001',
      title: 'IT Infrastructure Modernization Services',
      agency: 'Department of Defense',
      description: 'The Department of Defense requires comprehensive IT infrastructure modernization services including cloud migration, cybersecurity implementation, and system integration.',
      naicsCode: '541512',
      postedDate: new Date('2025-01-15'),
      responseDeadline: new Date('2025-02-15'),
      setAsideCode: 'SB',
      contractValue: 5000000.00,
      placeOfPerformance: 'Washington, DC'
    },
    {
      noticeId: 'GS-35F-0119Y',
      title: 'Cybersecurity Assessment and Implementation',
      agency: 'General Services Administration',
      description: 'GSA seeks qualified contractors to provide comprehensive cybersecurity assessment services, vulnerability testing, and security implementation for federal agencies.',
      naicsCode: '541511',
      postedDate: new Date('2025-01-10'),
      responseDeadline: new Date('2025-02-10'),
      contractValue: 3500000.00,
      placeOfPerformance: 'Multiple Locations'
    },
    {
      noticeId: 'VA-261-25-R-0003',
      title: 'Healthcare Data Analytics Platform',
      agency: 'Department of Veterans Affairs',
      description: 'The VA requires development and implementation of a comprehensive healthcare data analytics platform to improve patient care and operational efficiency.',
      naicsCode: '541511',
      postedDate: new Date('2025-01-08'),
      responseDeadline: new Date('2025-02-08'),
      setAsideCode: 'SDVOSB',
      contractValue: 8000000.00,
      placeOfPerformance: 'Nationwide'
    }
  ]

  for (const contractData of sampleContracts) {
    const contract = await prisma.contract.upsert({
      where: { noticeId: contractData.noticeId },
      update: {},
      create: contractData
    })
    console.log('✅ Created contract:', contract.title)
  }

  console.log('🎉 Database seeding completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })