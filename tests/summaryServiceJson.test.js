const { parseFirstJsonValue } = require('../services/summaryService');

test('parses JSON wrapped in markdown fences', () => {
  expect(parseFirstJsonValue('```json\n{"ok":true}\n```')).toEqual({ ok: true });
});

test('parses the first complete JSON value and ignores provider commentary', () => {
  const response = '```json\n{"section":{"content":"A brace in text: }"}}\n```\nGenerated successfully.';
  expect(parseFirstJsonValue(response)).toEqual({ section: { content: 'A brace in text: }' } });
});

test('rejects incomplete JSON instead of returning fabricated content', () => {
  expect(() => parseFirstJsonValue('{"section":')).toThrow(/Incomplete JSON/);
});
