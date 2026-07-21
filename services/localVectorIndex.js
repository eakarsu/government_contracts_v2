const crypto = require('crypto');
const path = require('path');
const fs = require('fs-extra');

function magnitude(vector) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosine(left, right, leftNorm, rightNorm) {
  if (left.length !== right.length || !leftNorm || !rightNorm) return 0;
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  return dot / (leftNorm * rightNorm);
}

class LocalVectorIndex {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'index.json');
    this.mutation = Promise.resolve();
  }

  isIndexCreated() {
    return fs.pathExists(this.file);
  }

  async createIndex() {
    await fs.ensureDir(this.directory);
    if (!(await this.isIndexCreated())) {
      await this.write({ items: [], metadata_config: {}, version: 1 });
    }
  }

  async read() {
    const document = await fs.readJson(this.file);
    if (!document || !Array.isArray(document.items)) throw new Error(`Invalid vector index: ${this.file}`);
    return document;
  }

  async write(document) {
    await fs.ensureDir(this.directory);
    const temporary = path.join(this.directory, `.index-${process.pid}-${crypto.randomUUID()}.tmp`);
    await fs.writeJson(temporary, document);
    await fs.move(temporary, this.file, { overwrite: true });
  }

  insertItem(item) {
    this.mutation = this.mutation.then(async () => {
      if (!Array.isArray(item.vector) || item.vector.length === 0 || item.vector.some(value => !Number.isFinite(value))) {
        throw new Error('A finite, non-empty vector is required');
      }
      const document = await this.read();
      const stored = {
        id: item.id || crypto.randomUUID(),
        metadata: item.metadata || {},
        norm: magnitude(item.vector),
        vector: item.vector,
      };
      const existing = document.items.findIndex(entry => entry.metadata?.id && entry.metadata.id === stored.metadata.id);
      if (existing >= 0) document.items[existing] = stored;
      else document.items.push(stored);
      await this.write(document);
      return stored;
    });
    return this.mutation;
  }

  async listItems() {
    return (await this.read()).items;
  }

  async queryItems(vector, limit = 10) {
    if (!Array.isArray(vector) || vector.length === 0) throw new Error('Query vector is required');
    const queryNorm = magnitude(vector);
    return (await this.listItems())
      .map(item => ({ item, score: cosine(vector, item.vector, queryNorm, item.norm || magnitude(item.vector)) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(0, limit));
  }
}

module.exports = LocalVectorIndex;
