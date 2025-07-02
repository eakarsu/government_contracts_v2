const { LocalIndex } = require('vectra');
const { pipeline } = require('@xenova/transformers');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config/env');

class VectorService {
  constructor() {
    this.contractsIndex = null;
    this.documentsIndex = null;
    this.embedder = null;
    this.isConnected = false;
    this.indexPath = path.join(process.cwd(), 'vector_indexes');
  }

  async initialize() {
    try {
      // Ensure vector indexes directory exists
      await fs.ensureDir(this.indexPath);

      // Initialize the embedding model (using a lightweight model)
      console.log('🔄 Loading embedding model...');
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

      // Initialize local vector indexes
      this.contractsIndex = new LocalIndex(path.join(this.indexPath, 'contracts'));
      this.documentsIndex = new LocalIndex(path.join(this.indexPath, 'documents'));

      // Create indexes if they don't exist
      if (!await this.contractsIndex.isIndexCreated()) {
        await this.contractsIndex.createIndex();
      }
      if (!await this.documentsIndex.isIndexCreated()) {
        await this.documentsIndex.createIndex();
      }

      console.log('✅ Vector database (Vectra) initialized - Pure Node.js solution');
      this.isConnected = true;
    } catch (error) {
      console.warn('⚠️ Vector database initialization failed:', error.message);
      console.warn('⚠️ Vector search features will be disabled.');
      this.isConnected = false;
      // Don't throw error - allow server to start without vector DB
    }
  }

  async indexContract(contract) {
    if (!this.isConnected) {
      console.warn('Vector database not connected - skipping contract indexing');
      return false;
    }

    try {
      const text = `${contract.title || ''} ${contract.description || ''} ${contract.agency || ''}`.trim();
      
      if (!text) {
        console.warn(`Skipping contract ${contract.noticeId} - no text content`);
        return false;
      }

      // Generate embedding
      const embedding = await this.generateEmbedding(text);
      
      // Add to index
      await this.contractsIndex.insertItem({
        vector: embedding,
        metadata: {
          id: contract.noticeId,
          title: contract.title,
          agency: contract.agency,
          naicsCode: contract.naicsCode,
          postedDate: contract.postedDate?.toISOString(),
          setAsideCode: contract.setAsideCode,
          text: text
        }
      });

      console.log(`Indexed contract: ${contract.noticeId}`);
      return true;
    } catch (error) {
      console.error(`Error indexing contract ${contract.noticeId}:`, error);
      return false;
    }
  }

  async indexDocument(document, contractId) {
    if (!this.isConnected) {
      console.warn('Vector database not connected - skipping document indexing');
      return false;
    }

    try {
      const documentId = `${contractId}_${document.filename}`;
      const text = document.content || document.processedData || '';
      
      if (!text) {
        console.warn(`Skipping document ${documentId} - no text content`);
        return false;
      }

      // Generate embedding
      const embedding = await this.generateEmbedding(text);
      
      // Add to index
      await this.documentsIndex.insertItem({
        vector: embedding,
        metadata: {
          id: documentId,
          contractId,
          filename: document.filename,
          processedAt: new Date().toISOString(),
          text: text
        }
      });

      console.log(`Indexed document: ${documentId}`);
      return true;
    } catch (error) {
      console.error(`Error indexing document ${documentId}:`, error);
      return false;
    }
  }

  async searchContracts(query, limit = 10) {
    if (!this.isConnected) {
      console.warn('Vector database not connected - cannot perform vector search');
      return [];
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search in contracts index
      const results = await this.contractsIndex.queryItems(queryEmbedding, limit);
      
      return results.map(result => ({
        id: result.item.metadata.id,
        score: result.score,
        metadata: result.item.metadata,
        document: result.item.metadata.text
      }));
    } catch (error) {
      console.error('Error searching contracts:', error);
      return [];
    }
  }

  async searchDocuments(query, limit = 10) {
    if (!this.isConnected) {
      console.warn('Vector database not connected - cannot perform vector search');
      return [];
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search in documents index
      const results = await this.documentsIndex.queryItems(queryEmbedding, limit);
      
      return results.map(result => ({
        id: result.item.metadata.id,
        score: result.score,
        metadata: result.item.metadata,
        document: result.item.metadata.text
      }));
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  async getCollectionStats() {
    if (!this.isConnected) {
      return { 
        contracts: 0, 
        documents: 0,
        status: 'disconnected'
      };
    }

    try {
      const contractsCount = await this.contractsIndex.listItems().then(items => items.length);
      const documentsCount = await this.documentsIndex.listItems().then(items => items.length);

      return {
        contracts: contractsCount,
        documents: documentsCount,
        status: 'connected'
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return { 
        contracts: 0, 
        documents: 0,
        status: 'error'
      };
    }
  }

  async generateEmbedding(text) {
    if (!this.embedder) {
      throw new Error('Embedding model not initialized');
    }

    try {
      // Generate embedding using the transformer model
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }
}

module.exports = new VectorService();
