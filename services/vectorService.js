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

  async searchContracts(query, options = {}) {
    const { limit = 10, threshold = 0.01 } = options; // Much lower threshold
    
    if (!this.isConnected) {
      console.warn('Vector database not connected - cannot perform vector search');
      return [];
    }

    try {
      // Generate embedding for query
      console.log(`🔍 Generating embedding for query: "${query}"`);
      const queryEmbedding = await this.generateEmbedding(query);
      console.log(`🔍 Generated embedding with length: ${queryEmbedding.length}`);
      
      // Search in contracts index with higher limit for filtering
      const searchLimit = Math.max(limit * 3, 50);
      console.log(`🔍 Searching contracts index with limit: ${searchLimit}`);
      const results = await this.contractsIndex.queryItems(queryEmbedding, searchLimit);
      
      console.log(`🔍 Vector search found ${results.length} raw results for query: "${query}"`);
      
      // Log first few results with scores for debugging
      if (results.length > 0) {
        console.log('🔍 Top 3 raw results:');
        results.slice(0, 3).forEach((result, index) => {
          console.log(`  ${index + 1}. Score: ${result.score.toFixed(4)}, Title: ${result.item.metadata.title || 'No title'}`);
        });
      }
      
      // Filter by threshold and limit
      const filteredResults = results
        .filter(result => {
          const passesThreshold = result.score >= threshold;
          if (!passesThreshold) {
            console.log(`🔍 Filtered out result with score ${result.score.toFixed(4)} (below threshold ${threshold})`);
          }
          return passesThreshold;
        })
        .slice(0, limit)
        .map(result => ({
          id: result.item.metadata.id,
          noticeId: result.item.metadata.id,
          title: result.item.metadata.title,
          description: result.item.metadata.text,
          agency: result.item.metadata.agency,
          naicsCode: result.item.metadata.naicsCode,
          postedDate: result.item.metadata.postedDate,
          score: result.score,
          metadata: result.item.metadata,
          document: result.item.metadata.text,
          // Add the percentage fields that the frontend expects
          semanticScore: Math.round(result.score * 100),
          keywordScore: 0,
          naicsMatch: result.item.metadata.naicsCode ? 85 : 0
        }));
      
      console.log(`🔍 After filtering (threshold: ${threshold}): ${filteredResults.length} results`);
      
      return filteredResults;
    } catch (error) {
      console.error('❌ Error searching contracts:', error);
      return [];
    }
  }

  async searchDocuments(query, limit = 10) {
    console.log(`🔍 [DEBUG] searchDocuments called with query: "${query}", limit: ${limit}`);
    
    if (!this.isConnected) {
      console.warn('⚠️ [DEBUG] Vector database not connected - cannot perform vector search');
      return [];
    }

    try {
      // Generate embedding for query
      console.log(`🔍 [DEBUG] Generating embedding for query...`);
      const queryEmbedding = await this.generateEmbedding(query);
      console.log(`🔍 [DEBUG] Generated embedding with length: ${queryEmbedding.length}`);
      
      // Search in documents index
      console.log(`🔍 [DEBUG] Searching documents index...`);
      const results = await this.documentsIndex.queryItems(queryEmbedding, limit);
      console.log(`🔍 [DEBUG] Raw search results count: ${results.length}`);
      
      const mappedResults = results.map(result => ({
        id: result.item.metadata.id,
        score: result.score,
        metadata: result.item.metadata,
        document: result.item.metadata.text
      }));
      
      console.log(`🔍 [DEBUG] Mapped results:`, mappedResults.map(r => ({ id: r.id, score: r.score, textLength: r.document?.length || 0 })));
      
      return mappedResults;
    } catch (error) {
      console.error('❌ [DEBUG] Error searching documents:', error);
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
      const contractsItems = await this.contractsIndex.listItems();
      const documentsItems = await this.documentsIndex.listItems();
      
      console.log(`Vector DB Stats: ${contractsItems.length} contracts, ${documentsItems.length} documents indexed`);
      
      // Log a few sample contract titles for debugging
      if (contractsItems.length > 0) {
        console.log('Sample indexed contracts:');
        contractsItems.slice(0, 5).forEach((item, index) => {
          console.log(`  ${index + 1}. Title: "${item.metadata.title || 'No title'}" ID: ${item.metadata.id}`);
          console.log(`      Agency: ${item.metadata.agency || 'No agency'}`);
          console.log(`      Text length: ${item.metadata.text?.length || 0} chars`);
        });
      }

      return {
        contracts: contractsItems.length,
        documents: documentsItems.length,
        status: 'connected',
        sample_contracts: contractsItems.slice(0, 5).map(item => ({
          id: item.metadata.id,
          title: item.metadata.title,
          agency: item.metadata.agency,
          textLength: item.metadata.text?.length || 0
        }))
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

  async getContractById(noticeId) {
    if (!this.isConnected) {
      console.warn('Vector database not connected - cannot get contract by ID');
      return null;
    }

    try {
      console.log(`🔍 Searching vector database for contract ID: ${noticeId}`);
      const contractsItems = await this.contractsIndex.listItems();
      
      const contract = contractsItems.find(item => item.metadata.id === noticeId);
      
      if (contract) {
        console.log(`✅ Found contract in vector DB: ${noticeId}`);
        return {
          id: contract.metadata.id,
          noticeId: contract.metadata.id,
          title: contract.metadata.title,
          description: contract.metadata.text,
          agency: contract.metadata.agency,
          naicsCode: contract.metadata.naicsCode,
          postedDate: contract.metadata.postedDate,
          setAsideCode: contract.metadata.setAsideCode,
          resourceLinks: []
        };
      }
      
      console.log(`❌ Contract not found in vector DB: ${noticeId}`);
      return null;
    } catch (error) {
      console.error('Error getting contract by ID:', error);
      return null;
    }
  }

  async getDetailedDocumentStats() {
    if (!this.isConnected) {
      return {
        total_indexed: 0,
        by_contract: [],
        by_file_type: {},
        recent_indexed: [],
        status: 'disconnected'
      };
    }

    try {
      const allDocuments = await this.documentsIndex.listItems();
      
      // Group by contract
      const byContract = {};
      const byFileType = {};
      const recentIndexed = [];

      allDocuments.forEach(item => {
        const metadata = item.metadata;
        
        // Group by contract
        if (metadata.contractId) {
          if (!byContract[metadata.contractId]) {
            byContract[metadata.contractId] = 0;
          }
          byContract[metadata.contractId]++;
        }

        // Group by file type
        if (metadata.filename) {
          const extension = metadata.filename.split('.').pop()?.toLowerCase() || 'unknown';
          if (!byFileType[extension]) {
            byFileType[extension] = 0;
          }
          byFileType[extension]++;
        }

        // Recent indexed (if has processedAt)
        if (metadata.processedAt) {
          recentIndexed.push({
            id: metadata.id,
            filename: metadata.filename,
            contractId: metadata.contractId,
            processedAt: metadata.processedAt,
            textLength: metadata.text?.length || 0
          });
        }
      });

      // Sort recent by date
      recentIndexed.sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt));

      // Convert byContract to array and sort by count
      const contractStats = Object.entries(byContract)
        .map(([contractId, count]) => ({ contractId, documentCount: count }))
        .sort((a, b) => b.documentCount - a.documentCount);

      return {
        total_indexed: allDocuments.length,
        by_contract: contractStats.slice(0, 10), // Top 10 contracts
        by_file_type: byFileType,
        recent_indexed: recentIndexed.slice(0, 20), // Last 20 indexed
        status: 'connected'
      };
    } catch (error) {
      console.error('Error getting detailed document stats:', error);
      return {
        total_indexed: 0,
        by_contract: [],
        by_file_type: {},
        recent_indexed: [],
        status: 'error'
      };
    }
  }

  async searchDocumentsAdvanced(query, options = {}) {
    const {
      limit = 10,
      contractId = null,
      fileType = null,
      minScore = 0.1,
      includeContent = false
    } = options;

    console.log(`🔍 [DEBUG] Advanced search called with query: "${query}"`);
    console.log(`🔍 [DEBUG] Options:`, { limit, contractId, fileType, minScore, includeContent });
    
    if (!this.isConnected) {
      console.warn('⚠️ [DEBUG] Vector database not connected - cannot perform search');
      return {
        results: [],
        total: 0,
        query,
        filters: { contractId, fileType },
        status: 'disconnected'
      };
    }

    try {
      // Generate embedding for query
      console.log(`🔍 [DEBUG] Generating embedding for advanced search...`);
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search in documents index with higher limit for filtering
      const searchLimit = Math.max(limit * 3, 50); // Get more results for filtering
      console.log(`🔍 [DEBUG] Searching with limit: ${searchLimit}`);
      const results = await this.documentsIndex.queryItems(queryEmbedding, searchLimit);
      
      console.log(`🔍 [DEBUG] Raw search results: ${results.length}`);
      
      // Filter results based on criteria
      let filteredResults = results.filter(result => {
        // Score filter
        if (result.score < minScore) {
          return false;
        }

        const metadata = result.item.metadata;

        // Contract filter
        if (contractId && metadata.contractId !== contractId) {
          return false;
        }

        // File type filter
        if (fileType && metadata.filename) {
          const extension = metadata.filename.split('.').pop()?.toLowerCase();
          if (extension !== fileType.toLowerCase()) {
            return false;
          }
        }

        return true;
      });

      // Limit final results
      filteredResults = filteredResults.slice(0, limit);

      console.log(`🔍 [DEBUG] Filtered results: ${filteredResults.length}`);

      // Check for downloaded files and parse processed data
      const fs = require('fs-extra');
      const path = require('path');
      const downloadPath = path.join(process.cwd(), 'downloaded_documents');

      const mappedResults = await Promise.all(filteredResults.map(async (result) => {
        const metadata = result.item.metadata;
        
        // Check if file is downloaded locally
        let isDownloaded = false;
        let localFilePath = null;
        
        try {
          if (await fs.pathExists(downloadPath)) {
            const files = await fs.readdir(downloadPath);
            const matchingFile = files.find(file => 
              file.includes(metadata.contractId) && 
              (file.includes(metadata.filename?.replace(/\.[^/.]+$/, '')) || 
               file.includes('document'))
            );
            
            if (matchingFile) {
              isDownloaded = true;
              localFilePath = path.join(downloadPath, matchingFile);
            }
          }
        } catch (error) {
          console.warn(`⚠️ [DEBUG] Error checking downloaded files: ${error.message}`);
        }

        // Parse processed data to extract summarization
        let summarization = null;
        let fullContent = metadata.text;
        
        try {
          // Check if there's processed data in the queue
          const { prisma } = require('../config/database');
          const queueEntry = await prisma.documentProcessingQueue.findFirst({
            where: {
              contractNoticeId: metadata.contractId,
              filename: metadata.filename,
              status: 'completed',
              processedData: { not: null }
            }
          });

          if (queueEntry && queueEntry.processedData) {
            const processedData = JSON.parse(queueEntry.processedData);
            
            if (processedData.content) {
              fullContent = processedData.content;
            }
            
            if (processedData.summary || processedData.analysis) {
              summarization = {
                summary: processedData.summary,
                analysis: processedData.analysis,
                keyPoints: processedData.keyPoints || processedData.key_points,
                recommendations: processedData.recommendations,
                wordCount: processedData.wordCount || processedData.word_count,
                pageCount: processedData.pageCount || processedData.page_count
              };
            }
          }
        } catch (error) {
          console.warn(`⚠️ [DEBUG] Error parsing processed data for ${metadata.filename}: ${error.message}`);
        }

        return {
          id: metadata.id,
          score: result.score,
          metadata: metadata,
          document: includeContent ? fullContent : (fullContent?.substring(0, 300) + '...'),
          preview: fullContent?.substring(0, 200) + '...',
          filename: metadata.filename,
          contractId: metadata.contractId,
          processedAt: metadata.processedAt,
          isDownloaded: isDownloaded,
          localFilePath: localFilePath,
          summarization: summarization,
          hasFullContent: !!fullContent,
          hasSummarization: !!summarization
        };
      }));
      
      return {
        results: mappedResults,
        total: filteredResults.length,
        query,
        filters: { contractId, fileType, minScore },
        status: 'connected'
      };
    } catch (error) {
      console.error('❌ [DEBUG] Error in advanced document search:', error);
      return {
        results: [],
        total: 0,
        query,
        filters: { contractId, fileType },
        status: 'error',
        error: error.message
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

module.exports = VectorService;
