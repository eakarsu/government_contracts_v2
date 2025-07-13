const express = require('express');
const router = express.Router();

// Mock data storage (in production, this would be a database)
let mockDocuments = [
  {
    id: 'doc-1',
    filename: 'DOD_Cybersecurity_RFP_2024.pdf',
    contractId: 'W52P1J-24-R-0001',
    requirements: {
      sections: ['Technical Approach', 'Management Plan', 'Past Performance', 'Cost Proposal'],
      deadlines: ['2024-03-15T17:00:00Z'],
      evaluation_criteria: {
        technical: 60,
        cost: 30,
        past_performance: 10
      }
    },
    sections: [
      { id: 'tech', title: 'Technical Approach', wordLimit: 5000, required: true },
      { id: 'mgmt', title: 'Management Plan', wordLimit: 3000, required: true },
      { id: 'past', title: 'Past Performance', wordLimit: 2000, required: true },
      { id: 'cost', title: 'Cost Proposal', wordLimit: 1000, required: true }
    ],
    uploadedAt: '2024-01-15T10:30:00Z',
    hasAnalysis: true
  },
  {
    id: 'doc-2',
    filename: 'NASA_Software_Development_RFP.pdf',
    contractId: 'NNH24ZHA001N',
    requirements: {
      sections: ['Software Architecture', 'Testing Strategy', 'Security Plan'],
      deadlines: ['2024-04-01T16:00:00Z'],
      evaluation_criteria: {
        technical: 70,
        cost: 20,
        past_performance: 10
      }
    },
    sections: [
      { id: 'arch', title: 'Software Architecture', wordLimit: 4000, required: true },
      { id: 'test', title: 'Testing Strategy', wordLimit: 2500, required: true },
      { id: 'sec', title: 'Security Plan', wordLimit: 2000, required: true }
    ],
    uploadedAt: '2024-01-20T14:15:00Z',
    hasAnalysis: true
  }
];

let mockProposals = [
  {
    id: 'prop-1',
    title: 'DOD Cybersecurity Services Proposal',
    sections: [
      {
        id: 'tech-1',
        sectionId: 'tech',
        title: 'Technical Approach',
        content: 'Our comprehensive cybersecurity approach leverages cutting-edge AI and machine learning technologies to provide real-time threat detection and response capabilities...',
        wordCount: 4850,
        status: 'reviewed',
        compliance: {
          wordLimit: { current: 4850, maximum: 5000, compliant: true },
          requirementCoverage: { covered: ['AI/ML', 'Real-time monitoring', 'Incident response'], missing: [], percentage: 95 }
        },
        lastModified: '2024-01-16T09:30:00Z',
        modifiedBy: 'AI Assistant'
      },
      {
        id: 'mgmt-1',
        sectionId: 'mgmt',
        title: 'Management Plan',
        content: 'Our project management methodology follows industry best practices including Agile development, regular stakeholder communication, and risk mitigation strategies...',
        wordCount: 2950,
        status: 'generated',
        compliance: {
          wordLimit: { current: 2950, maximum: 3000, compliant: true },
          requirementCoverage: { covered: ['Agile methodology', 'Risk management'], missing: ['Quality assurance'], percentage: 85 }
        },
        lastModified: '2024-01-16T10:15:00Z',
        modifiedBy: 'AI Assistant'
      }
    ],
    status: 'draft',
    version: 1,
    createdAt: '2024-01-16T08:00:00Z',
    updatedAt: '2024-01-16T10:15:00Z'
  }
];

// GET /api/ai-rfp/documents
router.get('/documents', async (req, res) => {
  try {
    res.json({
      success: true,
      documents: mockDocuments
    });
  } catch (error) {
    console.error('Error fetching RFP documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RFP documents'
    });
  }
});

// GET /api/ai-rfp/proposals
router.get('/proposals', async (req, res) => {
  try {
    res.json({
      success: true,
      proposals: mockProposals
    });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch proposals'
    });
  }
});

// POST /api/ai-rfp/upload
router.post('/upload', async (req, res) => {
  try {
    // Simulate file upload processing
    const filename = req.body.filename || `RFP_Document_${Date.now()}.pdf`;
    const contractId = req.body.contractId || `CONTRACT-${Date.now()}`;
    
    // Simulate AI analysis of the document
    const analysisResults = {
      sections: [
        { id: 'exec', title: 'Executive Summary', wordLimit: 1000, required: true },
        { id: 'tech', title: 'Technical Approach', wordLimit: 5000, required: true },
        { id: 'mgmt', title: 'Management Plan', wordLimit: 3000, required: true },
        { id: 'cost', title: 'Cost Proposal', wordLimit: 2000, required: true }
      ],
      requirements: {
        deadlines: [new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()],
        evaluation_criteria: {
          technical: Math.floor(Math.random() * 30) + 50,
          cost: Math.floor(Math.random() * 30) + 20,
          past_performance: Math.floor(Math.random() * 20) + 10
        }
      }
    };
    
    const newDocument = {
      id: `doc-${Date.now()}`,
      filename,
      contractId,
      requirements: analysisResults.requirements,
      sections: analysisResults.sections,
      uploadedAt: new Date().toISOString(),
      hasAnalysis: true
    };
    
    mockDocuments.push(newDocument);
    
    res.json({
      success: true,
      message: 'RFP document uploaded and analyzed successfully',
      document: newDocument
    });
  } catch (error) {
    console.error('Error uploading RFP document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload RFP document'
    });
  }
});

// POST /api/ai-rfp/generate-proposal
router.post('/generate-proposal', async (req, res) => {
  try {
    const { rfpDocumentId, title } = req.body;
    
    // Find the RFP document
    const rfpDoc = mockDocuments.find(doc => doc.id === rfpDocumentId);
    if (!rfpDoc) {
      return res.status(404).json({
        success: false,
        error: 'RFP document not found'
      });
    }
    
    // Generate realistic proposal sections based on RFP requirements
    const generatedSections = rfpDoc.sections.map(section => {
      const sampleContent = generateSectionContent(section.title);
      const wordCount = sampleContent.split(/\s+/).length;
      
      return {
        id: `${section.id}-${Date.now()}`,
        sectionId: section.id,
        title: section.title,
        content: sampleContent,
        wordCount,
        status: 'generated',
        compliance: {
          wordLimit: { 
            current: wordCount, 
            maximum: section.wordLimit, 
            compliant: wordCount <= section.wordLimit 
          },
          requirementCoverage: { 
            covered: getRandomRequirements(section.title), 
            missing: [], 
            percentage: Math.floor(Math.random() * 20) + 80 
          }
        },
        lastModified: new Date().toISOString(),
        modifiedBy: 'AI Assistant'
      };
    });
    
    const proposal = {
      id: `prop-${Date.now()}`,
      title: title || `Proposal for ${rfpDoc.filename}`,
      sections: generatedSections,
      status: 'draft',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    mockProposals.push(proposal);
    
    res.json({
      success: true,
      proposal
    });
  } catch (error) {
    console.error('Error generating proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate proposal'
    });
  }
});

// Helper function to generate realistic section content
function generateSectionContent(sectionTitle) {
  const contentTemplates = {
    'Executive Summary': 'Our organization brings extensive experience and proven capabilities to deliver exceptional results for this critical project. We understand the unique requirements and challenges outlined in the RFP and have assembled a world-class team of experts to ensure successful project execution. Our approach combines innovative methodologies with industry best practices to deliver solutions that exceed expectations while maintaining the highest standards of quality and security.',
    
    'Technical Approach': 'Our technical methodology leverages cutting-edge technologies and proven frameworks to deliver robust, scalable solutions. We employ agile development practices, continuous integration/continuous deployment (CI/CD) pipelines, and comprehensive testing strategies. Our architecture follows industry standards for security, performance, and maintainability. Key technical components include cloud-native infrastructure, microservices architecture, API-first design, and advanced monitoring and analytics capabilities.',
    
    'Management Plan': 'Our project management approach follows PMI best practices and agile methodologies to ensure successful delivery. We have established clear governance structures, communication protocols, and risk management procedures. Our experienced project managers will provide regular status updates, milestone tracking, and proactive issue resolution. Quality assurance processes are integrated throughout the project lifecycle to maintain the highest standards of deliverable quality.',
    
    'Cost Proposal': 'Our pricing structure reflects competitive market rates while ensuring the highest quality deliverables. We have carefully analyzed the project requirements and allocated resources efficiently to provide maximum value. Our cost model includes transparent pricing for all project phases, with detailed breakdowns for labor, materials, and overhead costs. We offer flexible payment terms and are committed to delivering within the proposed budget constraints.',
    
    'Past Performance': 'Our organization has successfully completed numerous similar projects for government and commercial clients. We maintain an excellent track record of on-time delivery, budget adherence, and customer satisfaction. Our team includes certified professionals with relevant security clearances and specialized expertise in the required domains. References from previous clients are available upon request to demonstrate our commitment to excellence.',
    
    'Software Architecture': 'Our software architecture follows modern design principles including modularity, scalability, and maintainability. We utilize containerized microservices, event-driven architecture, and cloud-native technologies. The system design incorporates robust security measures, comprehensive logging and monitoring, and automated testing frameworks. Our architecture supports high availability, disaster recovery, and seamless integration with existing systems.',
    
    'Testing Strategy': 'Our comprehensive testing approach includes unit testing, integration testing, system testing, and user acceptance testing. We employ automated testing frameworks, continuous testing pipelines, and performance testing tools. Security testing, accessibility testing, and compatibility testing are integral components of our quality assurance process. Test coverage metrics and defect tracking ensure thorough validation of all system components.',
    
    'Security Plan': 'Our security framework implements defense-in-depth strategies with multiple layers of protection. We follow NIST cybersecurity guidelines, implement zero-trust architecture principles, and maintain compliance with relevant security standards. Security measures include encryption at rest and in transit, multi-factor authentication, role-based access controls, and continuous security monitoring. Regular security assessments and penetration testing ensure ongoing protection against emerging threats.'
  };
  
  return contentTemplates[sectionTitle] || `Detailed ${sectionTitle.toLowerCase()} content will be developed based on the specific requirements outlined in the RFP. Our approach emphasizes innovation, quality, and customer satisfaction while maintaining compliance with all specified standards and regulations.`;
}

// Helper function to generate random requirements coverage
function getRandomRequirements(sectionTitle) {
  const requirementsBySection = {
    'Executive Summary': ['Project understanding', 'Key benefits', 'Team qualifications'],
    'Technical Approach': ['Architecture design', 'Technology stack', 'Implementation methodology'],
    'Management Plan': ['Project timeline', 'Resource allocation', 'Risk management'],
    'Cost Proposal': ['Labor costs', 'Material costs', 'Overhead expenses'],
    'Past Performance': ['Similar projects', 'Client references', 'Success metrics'],
    'Software Architecture': ['System design', 'Scalability', 'Security integration'],
    'Testing Strategy': ['Test planning', 'Automation framework', 'Quality metrics'],
    'Security Plan': ['Threat assessment', 'Security controls', 'Compliance measures']
  };
  
  const requirements = requirementsBySection[sectionTitle] || ['General requirements', 'Quality standards', 'Compliance measures'];
  const numCovered = Math.floor(Math.random() * requirements.length) + 1;
  return requirements.slice(0, numCovered);
}

// GET /api/ai-rfp/proposals/:id
router.get('/proposals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Mock proposal data
    const proposal = {
      id,
      title: 'Sample Proposal',
      sections: [],
      status: 'draft',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      proposal
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch proposal'
    });
  }
});

module.exports = router;
