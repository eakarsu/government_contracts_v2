const rfpService = require('../services/rfpService');
const summaryService = require('../services/summaryService');

describe('RFP generation prompt', () => {
  const template = {
    name: 'Custom Evidence Template',
    agency: 'FCC',
    description: 'Use the customer-defined response structure.',
    evaluationCriteria: { technicalWeight: 70, costWeight: 30 },
    sections: [
      {
        id: 'service_plan',
        title: 'Service Plan',
        description: 'Explain the landscape and snow service plan.',
        required: true,
        maxWords: 1200,
        format: 'table',
        mappings: ['operations', 'equipment']
      }
    ]
  };

  const company = {
    companyName: 'Example Company',
    basicInfo: {
      dunsNumber: '123456789',
      cageCode: '1A2B3',
      certifications: ['Certified Supplier'],
      sizeStandard: 'Small Business',
      naicsCode: ['561730']
    },
    capabilities: {
      coreCompetencies: ['Snow removal'],
      technicalSkills: ['Commercial plow operation'],
      securityClearances: ['Facility access approved'],
      methodologies: ['Weather-triggered mobilization']
    },
    pastPerformance: [{ contractName: 'Winter Services', client: 'Example Agency' }],
    keyPersonnel: [{ name: 'Alex Doe', role: 'Project Manager' }]
  };

  test('uses the selected template instead of a hardcoded section list', () => {
    const prompt = rfpService.buildContractContent(
      { title: 'Grounds Work', agency: 'FCC', description: 'Maintain the grounds.' },
      company,
      'Prioritize mobilization.',
      [],
      template
    );

    expect(prompt).toContain('Custom Evidence Template');
    expect(prompt).toContain('JSON key: service_plan');
    expect(prompt).toContain('Explain the landscape and snow service plan.');
    expect(prompt).toContain('Format: table');
    expect(prompt).toContain('Evidence mappings: operations, equipment');
    expect(prompt).toContain('target approximately 840 words');
    expect(prompt).toContain('service_plan.');
    expect(prompt).not.toContain('Executive Summary');
  });

  test('passes the complete verified company profile to the model', () => {
    const prompt = rfpService.buildContractContent(
      { title: 'Grounds Work', agency: 'FCC' },
      company,
      null,
      [],
      template
    );

    expect(prompt).toContain('Commercial plow operation');
    expect(prompt).toContain('Weather-triggered mobilization');
    expect(prompt).toContain('Certified Supplier');
    expect(prompt).toContain('Winter Services');
    expect(prompt).toContain('Alex Doe');
    expect(prompt).toContain('No processed solicitation document content is available');
  });

  test('passes the complete retained SAM.gov opportunity record to the model', () => {
    const prompt = rfpService.buildContractContent(
      {
        title: 'Cloud Platform',
        agency: 'Example Agency',
        samData: {
          noticeId: 'notice-123',
          solicitationNumber: 'SOL-2026-001',
          responseDeadLine: '2026-09-30T17:00:00-04:00',
          pointOfContact: [{ type: 'primary', email: 'contracting@example.gov' }],
          placeOfPerformance: { city: { name: 'Washington' }, state: { code: 'DC' } },
          resourceLinks: ['https://sam.gov/api/prod/opps/v3/opportunities/resources/files/example/download']
        }
      },
      company,
      null,
      [],
      template
    );

    expect(prompt).toContain('COMPLETE SAM.GOV OPPORTUNITY RECORD');
    expect(prompt).toContain('SOL-2026-001');
    expect(prompt).toContain('contracting@example.gov');
    expect(prompt).toContain('Washington');
    expect(prompt).toContain('/download');
  });

  test('routes enhanced business data and custom company sections into the proposal prompt', () => {
    const enhancedCompany = {
      ...company,
      businessDetails: {
        legalBusinessName: 'Example Legal LLC',
        ueiNumber: 'EXAMPLEUEI',
        laborCategories: ['Technical Lead'],
        pricingApproach: 'Use approved labor rates.'
      },
      additionalSections: [{
        id: 'quality_approach',
        title: 'Quality Approach',
        content: 'Requirements traceability and acceptance gates.'
      }],
      pastPerformance: [
        { status: 'placeholder', contractName: 'Do not claim this project' },
        { status: 'verified', contractName: 'Verified Delivery' }
      ],
      keyPersonnel: [
        { status: 'placeholder', name: 'Unassigned', role: 'Technical Lead' },
        { status: 'verified', name: 'Verified Person', role: 'Program Manager' }
      ]
    };
    const prompt = rfpService.buildContractContent(
      { title: 'Grounds Work', agency: 'FCC' },
      enhancedCompany,
      null,
      [],
      template,
      ['Requirements traceability']
    );

    expect(prompt).toContain('Example Legal LLC');
    expect(prompt).toContain('Technical Lead');
    expect(prompt).toContain('Requirements traceability and acceptance gates.');
    expect(prompt).toContain('USER FOCUS AREAS: Requirements traceability');
    expect(prompt).toContain('Verified Delivery');
    expect(prompt).toContain('Verified Person');
    expect(prompt).not.toContain('Do not claim this project');
    expect(prompt).not.toContain('"name": "Unassigned"');
  });

  test('extracts a generated section through a configured mapping', () => {
    const content = rfpService.extractSectionFromStructuredResponse(
      { operations: 'Verified service-plan narrative.' },
      template.sections[0]
    );
    expect(content).toBe('Verified service-plan narrative.');
  });

  test('splits a long proposal into bounded, ordered generation batches', () => {
    const sections = Array.from({ length: 7 }, (_, index) => ({
      id: `section_${index + 1}`,
      title: `Section ${index + 1}`,
      required: true,
      maxWords: 1000
    }));

    const batches = rfpService.createSectionBatches(sections, 2800, 4);

    expect(batches).toHaveLength(2);
    expect(batches.flat().map(section => section.id)).toEqual(sections.map(section => section.id));
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(4);
      expect(rfpService.templateTargetWordCount(batch)).toBeLessThanOrEqual(2800);
      expect(rfpService.sectionBatchTokenBudget(batch)).toBeLessThanOrEqual(32000);
    }
  });

  test('generates every section across multiple provider requests', async () => {
    const sections = Array.from({ length: 7 }, (_, index) => ({
      id: `section_${index + 1}`,
      title: `Section ${index + 1}`,
      required: true,
      maxWords: 1000
    }));
    const generatedContent = Object.fromEntries(
      sections.map(section => [section.id, `Generated content for ${section.title}.`])
    );
    const summarize = jest.spyOn(summaryService, 'summarizeContent')
      .mockResolvedValue({ success: true, result: generatedContent });

    try {
      const generated = await rfpService.generateAllSections(
        { ...template, sections },
        { title: 'Test Contract', agency: 'Test Agency' },
        company
      );

      expect(summarize).toHaveBeenCalledTimes(2);
      expect(generated.map(section => section.id)).toEqual(sections.map(section => section.id));
      expect(generated.every(section => section.status === 'generated')).toBe(true);
    } finally {
      summarize.mockRestore();
    }
  });
});
