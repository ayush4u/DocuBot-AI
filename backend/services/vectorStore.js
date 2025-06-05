const { ChromaClient } = require('chromadb');
// Remove the heavy transformers dependency for now
// const { pipeline } = require('@xenova/transformers');

class VectorStore {
  constructor() {
    this.client = null;
    this.collection = null;
    this.embedder = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Vector Store...');
      
      // Initialize ChromaDB client with v2 API compatibility
      this.client = new ChromaClient({
        path: process.env.CHROMA_DB_PATH || 'http://localhost:8000'
      });

      try {
        // Test connection with a simple operation instead of heartbeat
        console.log('📡 Testing ChromaDB connection...');
        await this.client.listCollections();
        console.log('📡 ChromaDB connection successful');
      } catch (connectionError) {
        console.log('⚠️ ChromaDB connection failed:', connectionError.message);
        console.log('💡 To use full vector search, ensure ChromaDB is running:');
        console.log('   chroma run --host localhost --port 8000');
        this.isInitialized = false;
        return false;
      }

      // Create or get collection for documents
      this.collection = await this.client.getOrCreateCollection({
        name: 'documents',
        metadata: { description: 'Document chunks for RAG' }
      });

      // Use ChromaDB's built-in embeddings instead of downloading models
      console.log('📥 Using ChromaDB built-in embeddings...');
      this.isInitialized = true;
      console.log('✅ Vector Store initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Vector Store initialization failed:', error.message);
      console.log('🔄 Falling back to simple keyword search mode');
      this.isInitialized = false;
      return false;
    }
  }

  // Split text into chunks for better retrieval
  chunkText(text, chunkSize = 500, overlap = 50) {
    const chunks = [];
    const words = text.split(' ');
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push({
          text: chunk.trim(),
          startIndex: i,
          endIndex: Math.min(i + chunkSize, words.length)
        });
      }
    }
    
    return chunks;
  }

  // Add document to vector store
  async addDocument(filename, content, metadata = {}) {
    if (!this.isInitialized) {
      console.log('⚠️ Vector store not initialized, skipping vector storage');
      return false;
    }

    try {
      console.log(`📚 Processing document: ${filename}`);
      
      // Split document into chunks
      const chunks = this.chunkText(content);
      console.log(`📄 Created ${chunks.length} chunks`);

      // Prepare data for ChromaDB (let ChromaDB handle embeddings automatically)
      const documents = [];
      const metadatas = [];
      const ids = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        documents.push(chunk.text);
        metadatas.push({
          filename,
          originalFilename: metadata.originalFilename || filename,
          chunkIndex: i,
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
          userId: metadata.userId || 'anonymous',
          timestamp: new Date().toISOString(),
          documentType: metadata.documentType || 'general',
          chunkSize: chunk.text.length,
          ...metadata // Include all metadata
        });
        ids.push(`${filename}_chunk_${i}`);
      }

      // Add to ChromaDB (ChromaDB will generate embeddings automatically)
      await this.collection.add({
        ids,
        documents,
        metadatas
      });

      console.log(`✅ Added ${chunks.length} chunks to vector store`);
      return true;
      
    } catch (error) {
      console.error('❌ Error adding document to vector store:', error.message);
      return false;
    }
  }

  // Search for relevant chunks based on query
  async searchRelevant(query, maxResults = 5) {
    if (!this.isInitialized) {
      console.log('⚠️ Vector store not available, using keyword-based fallback search');
      return this.keywordSearch(query, maxResults);
    }

    try {
      console.log(`🔍 Vector searching for: "${query}"`);
      
      // Use ChromaDB's built-in query (it will handle embeddings automatically)
      const results = await this.collection.query({
        queryTexts: [query], // Let ChromaDB generate embeddings for the query
        nResults: maxResults,
        include: ['documents', 'metadatas', 'distances']
      });

      // Format results
      const relevantChunks = [];
      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          relevantChunks.push({
            text: results.documents[0][i],
            metadata: results.metadatas[0][i],
            score: 1 - results.distances[0][i], // Convert distance to similarity score
            distance: results.distances[0][i]
          });
        }
      }

      console.log(`📊 Found ${relevantChunks.length} relevant chunks`);
      return relevantChunks;
      
    } catch (error) {
      console.error('❌ Vector search error:', error.message);
      console.log('🔄 Falling back to keyword search');
      return this.keywordSearch(query, maxResults);
    }
  }

  // Alias for backward compatibility
  async searchSimilar(query, maxResults = 5, options = {}) {
    return this.searchRelevant(query, maxResults);
  }

  // Fallback keyword-based search when vector store is unavailable
  keywordSearch(query, maxResults = 5) {
    console.log(`🔍 Keyword search for: "${query}" (fallback mode)`);
    
    // For now, return empty array since we don't have access to documents here
    // The keyword search should be implemented in the RAG service where documents are available
    return [];
  }

  // Alias for backward compatibility
  async searchSimilar(query, maxResults = 5, options = {}) {
    return this.searchRelevant(query, maxResults);
  }

  // Get document info by filename
  async getDocumentInfo(filename) {
    if (!this.isInitialized) return null;

    try {
      const results = await this.collection.get({
        where: { filename: filename },
        include: ['metadatas']
      });

      if (results.metadatas && results.metadatas.length > 0) {
        const chunks = results.metadatas.length;
        return {
          filename,
          chunkCount: chunks,
          metadata: results.metadatas[0]
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting document info:', error.message);
      return null;
    }
  }

  // List all documents in vector store
  async listDocuments() {
    if (!this.isInitialized) return [];

    try {
      const results = await this.collection.get({
        include: ['metadatas']
      });

      // Group by filename
      const documents = {};
      if (results.metadatas) {
        results.metadatas.forEach(meta => {
          if (!documents[meta.filename]) {
            documents[meta.filename] = {
              filename: meta.filename,
              chunkCount: 0,
              lastUpdated: meta.timestamp || new Date().toISOString()
            };
          }
          documents[meta.filename].chunkCount++;
        });
      }

      return Object.values(documents);
    } catch (error) {
      console.error('❌ Error listing documents:', error.message);
      return [];
    }
  }

  // Delete document from vector store
  async deleteDocument(filename) {
    if (!this.isInitialized) return false;

    try {
      // Get all chunk IDs for this document
      const results = await this.collection.get({
        where: { filename: filename },
        include: ['ids']
      });

      if (results.ids && results.ids.length > 0) {
        await this.collection.delete({
          ids: results.ids
        });
        console.log(`🗑️ Deleted ${results.ids.length} chunks for ${filename}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error deleting document:', error.message);
      return false;
    }
  }

  // Get collection stats
  async getStats() {
    if (!this.isInitialized) {
      return { initialized: false, totalChunks: 0, totalDocuments: 0 };
    }

    try {
      const count = await this.collection.count();
      const documents = await this.listDocuments();
      
      return {
        initialized: true,
        totalChunks: count,
        totalDocuments: documents.length,
        documents: documents
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error.message);
      return { initialized: false, error: error.message };
    }
  }
}

// Create singleton instance
const vectorStore = new VectorStore();

module.exports = {
  VectorStore,
  vectorStore
};
