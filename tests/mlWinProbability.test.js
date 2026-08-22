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
