const {
  affectedSections,
  amendmentChanges,
  opportunitySnapshot,
  requirementSentences,
} = require('../services/rfpProductionService');

test('extracts explicit solicitation requirements without inventing prose', () => {
  const extracted = requirementSentences({
    page1: 'The contractor shall provide weekly status reports. Background information is informational only.',
    page2: ['All personnel must complete agency security training.', 'The contractor shall provide weekly status reports.'],
  });
  expect(extracted).toEqual([
    'The contractor shall provide weekly status reports.',
    'All personnel must complete agency security training.',
  ]);
});

test('detects amendment fields and maps them to affected proposal sections', () => {
  const previous = opportunitySnapshot({
    noticeId: 'A-1', title: 'Data platform', description: 'Original scope',
    responseDeadline: '2026-09-01T12:00:00Z', resourceLinks: ['https://sam.gov/a/download'],
  });
  const current = opportunitySnapshot({
    noticeId: 'A-1', title: 'Data platform', description: 'Amended scope',
    responseDeadline: '2026-09-08T12:00:00Z', resourceLinks: ['https://sam.gov/a/download', 'https://sam.gov/b/download'],
  });
  const changes = amendmentChanges(previous, current);
  expect(changes.map(change => change.field)).toEqual(expect.arrayContaining(['descriptionHash', 'responseDeadline', 'resourceLinks']));
  expect(affectedSections(changes)).toEqual(expect.arrayContaining(['schedule_milestones', '*']));
});
