const { ChromaClient } = require('chromadb');
const config = require('../config/env');

class VectorService {
  constructor() {
    this.client = new ChromaClient({
      path: config.chromaUrl,
      auth: config.chromaApiKey ? { provider: 'token', credentials: config.chromaApiKey } : undefined
    });
    this.contractsCollection = null;
    this.documentsCollection = null;
  }

  async initialize() {
    try {
      // Create or get collections
      this.contractsCollection = await this.client.getOrCreateCollection({
        name: 'contracts',
        metadata: { description: 'Government contracts collection' }
      });

      this.documentsCollection = await this.client.getOrCreateCollection({
        name: 'documents',
        metadata: { description: 'Contract documents collection' }
      });

      console.log('✅ Vector database (ChromaDB) initialized');
    } catch (error) {
      console.error('❌ Vector database initialization failed:', error);
      throw error;
    }
  }

  async indexContract(contract) {
    try {
      const text = `${contract.title || ''} ${contract.description || ''} ${contract.agency || ''}`.trim();
      
      if (!text) {
        console.warn(`Skipping contract ${contract.noticeId} - no text content`);
        return;
      }

      await this.contractsCollection.add({
        ids: [contract.noticeId],
        documents: [text],
        metadatas: [{
          title: contract.title,
          agency: contract.agency,
          naicsCode: contract.naicsCode,
          postedDate: contract.postedDate?.toISOString(),
          setAsideCode: contract.setAsideCode
        }]
      });

      console.log(`Indexed contract: ${contract.noticeId}`);
    } catch (error) {
      console.error(`Error indexing contract ${contract.noticeId}:`, error);
      throw error;
    }
  }

  async indexDocument(document, contractId) {
    try {
      const documentId = `${contractId}_${document.filename}`;
      
      await this.documentsCollection.add({
        ids: [documentId],
        documents: [document.content || document.processedData || ''],
        metadatas: [{
          contractId,
          filename: document.filename,
          processedAt: new Date().toISOString()
        }]
      });

      console.log(`Indexed document: ${documentId}`);
    } catch (error) {
      console.error(`Error indexing document ${documentId}:`, error);
      throw error;
    }
  }

  async searchContracts(query, limit = 10) {
    try {
      const results = await this.contractsCollection.query({
        queryTexts: [query],
        nResults: limit
      });

      return results.ids[0].map((id, index) => ({
        id,
        score: results.distances[0][index],
        metadata: results.metadatas[0][index],
        document: results.documents[0][index]
      }));
    } catch (error) {
      console.error('Error searching contracts:', error);
      throw error;
    }
  }

  async searchDocuments(query, limit = 10) {
    try {
      const results = await this.documentsCollection.query({
        queryTexts: [query],
        nResults: limit
      });

      return results.ids[0].map((id, index) => ({
        id,
        score: results.distances[0][index],
        metadata: results.metadatas[0][index],
        document: results.documents[0][index]
      }));
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  async getCollectionStats() {
    try {
      const contractsCount = await this.contractsCollection.count();
      const documentsCount = await this.documentsCollection.count();

      return {
        contracts: contractsCount,
        documents: documentsCount
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return { contracts: 0, documents: 0 };
    }
  }
}

module.exports = new VectorService();
