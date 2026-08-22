const VectorService = require('../services/vectorService');

test('returns accurate vector pagination metadata and applies offsets', async () => {
  const service = new VectorService();
  service.isConnected = true;
  service.generateEmbedding = jest.fn().mockResolvedValue([1, 0]);
  service.contractsIndex = {
    queryItems: jest.fn().mockResolvedValue([
      { score: 0.9, item: { metadata: { id: 'one', title: 'One', text: 'First' } } },
      { score: 0.8, item: { metadata: { id: 'two', title: 'Two', text: 'Second' } } },
      { score: 0.7, item: { metadata: { id: 'three', title: 'Three', text: 'Third' } } },
      { score: 0.01, item: { metadata: { id: 'below', title: 'Below threshold', text: 'Ignored' } } },
    ]),
  };

  const page = await service.searchContracts('contract', { limit: 1, offset: 1, threshold: 0.1 });

  expect(page.results.map(result => result.noticeId)).toEqual(['two']);
  expect(page).toMatchObject({ totalResults: 3, hasMore: true, limit: 1, offset: 1 });
});
