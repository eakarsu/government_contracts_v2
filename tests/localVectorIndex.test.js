const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const LocalVectorIndex = require('../services/localVectorIndex');

test('persists, replaces, and ranks local vector records deterministically', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gov-vector-index-'));
  try {
    const index = new LocalVectorIndex(directory);
    expect(await index.isIndexCreated()).toBe(false);
    await index.createIndex();
    await index.insertItem({ vector: [1, 0], metadata: { id: 'first', title: 'First' } });
    await index.insertItem({ vector: [0, 1], metadata: { id: 'second', title: 'Second' } });
    await index.insertItem({ vector: [0.9, 0.1], metadata: { id: 'first', title: 'Updated' } });

    const items = await index.listItems();
    expect(items).toHaveLength(2);
    expect(items.find(item => item.metadata.id === 'first').metadata.title).toBe('Updated');

    const results = await index.queryItems([1, 0], 2);
    expect(results.map(result => result.item.metadata.id)).toEqual(['first', 'second']);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  } finally {
    await fs.remove(directory);
  }
});
