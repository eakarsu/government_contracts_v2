const predictor = require('../services/mlWinProbability');

test('prediction math encodes categorical features as finite values', async () => {
  predictor.model = predictor.getDefaultModel();
  const result = await predictor.predictWinProbability({
    title: 'Cloud data engineering services',
    description: 'Secure software, data, and network delivery',
    agency: 'Department of Defense',
    naicsCode: '541512',
    setAsideCode: 'SBA',
    postedDate: '2026-08-01T00:00:00.000Z',
    responseDeadline: '2026-09-01T00:00:00.000Z',
    resourceLinks: [{ url: 'https://example.invalid/solicitation.pdf' }],
  });

  expect(Number.isFinite(result.probability)).toBe(true);
  expect(result.probability).toBeGreaterThanOrEqual(0);
  expect(result.probability).toBeLessThanOrEqual(100);
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  expect(result.confidence).toBeLessThanOrEqual(100);
});

test('unknown categorical values do not produce NaN', () => {
  expect(predictor.normalizeFeature('OTHER', 'naicsCategory')).toBe(0.25);
  expect(predictor.normalizeFeature('NONE', 'setAsideType')).toBe(0);
  expect(predictor.normalizeFeature('unexpected', 'unknownFeature')).toBe(0);
});

test('normalizes only valid six-digit company NAICS codes', () => {
  expect(predictor.normalizeProfileNaicsCodes({
    experienceInNaics: [237310, ' 541512 ', '237-310', 'NAICS 541519 - Other Computer Related Services', 'CONSTRUCTION', '12345'],
    naicsCodes: '["541512", "236220"]',
  })).toEqual(['237310', '541512', '541519', '236220']);
});

test('compares profile codes to the actual contract code without treating category labels as exact', () => {
  expect(predictor.evaluateNaicsEvidence({ experienceInNaics: ['237310'] }, '237310')).toMatchObject({
    status: 'exact', exactMatch: true, sharedPrefixLength: 6, score: 1,
  });
  expect(predictor.evaluateNaicsEvidence({ experienceInNaics: ['237320'] }, '237310')).toMatchObject({
    status: 'related', exactMatch: false, sharedPrefixLength: 4, score: 0.2,
  });
  expect(predictor.evaluateNaicsEvidence({ experienceInNaics: ['236220'] }, '237310')).toMatchObject({
    status: 'mismatch', exactMatch: false, score: 0,
  });
  expect(predictor.evaluateNaicsEvidence({ experienceInNaics: ['CONSTRUCTION'] }, '237310')).toMatchObject({
    status: 'unverified', exactMatch: false, profileCodes: [],
  });
});

test('missing or mismatched NAICS evidence cannot produce inflated probability or confidence', async () => {
  const contract = {
    title: 'North Shore road striping',
    description: 'Road striping and highway construction services',
    agency: 'Department of the Interior',
    naicsCode: '237310',
    setAsideCode: 'SBA',
    awardAmount: '1000000',
    postedDate: '2026-08-01T00:00:00.000Z',
    responseDeadline: '2026-09-01T00:00:00.000Z',
    resourceLinks: [{ url: 'https://example.invalid/solicitation.pdf' }],
  };

  predictor.model = predictor.getDefaultModel();
  const unverified = await predictor.predictWinProbability(contract, { companyProfile: {} });
  const mismatch = await predictor.predictWinProbability(contract, { companyProfile: { experienceInNaics: ['541512'] } });
  const exact = await predictor.predictWinProbability(contract, { companyProfile: { experienceInNaics: ['237310'] } });

  expect(unverified.naicsEvidence.status).toBe('unverified');
  expect(unverified.probability).toBeLessThanOrEqual(69);
  expect(unverified.confidence).toBeLessThanOrEqual(55);
  expect(mismatch.naicsEvidence.status).toBe('mismatch');
  expect(mismatch.probability).toBeLessThanOrEqual(59);
  expect(mismatch.confidence).toBeLessThanOrEqual(70);
  expect(exact.naicsEvidence.status).toBe('exact');
  expect(exact.probability).toBeGreaterThan(mismatch.probability);
  expect(exact.probability).toBeGreaterThan(unverified.probability);
  expect(exact.confidence).toBeLessThan(100);
});
