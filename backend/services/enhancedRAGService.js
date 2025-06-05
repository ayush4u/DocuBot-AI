const { embeddingService } = require('./embeddingService');
const { contextMemoryService } = require('./contextMemoryService');
const { freeLLMService } = require('./freeLLMService');
const { vectorStore } = require('./vectorStore');
const { saveDocument, getDocuments } = require('../config/database');

class EnhancedRAGService {
  constructor() {
    this.isInitialized = false;
    this.processingQueue = new Map();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Enhanced RAG Service...');
      
      // Initialize all components
      await Promise.all([
        embeddingService.initialize(),
        vectorStore.initialize()
      ]);
      
      this.isInitialized = true;
      console.log('✅ Enhanced RAG Service initialized with:');
      console.log('  📊 Embeddings:', embeddingService.getStats());
      console.log('  🗄️ Vector Store: ChromaDB');
      console.log('  🤖 LLM: Multiple Hugging Face models');
      console.log('  🧠 Context Memory: Active');
      
      return true;
    } catch (error) {
      console.error('❌ Enhanced RAG Service initialization failed:', error.message);
      return false;
    }
  }

  // Enhanced document processing with better chunking and metadata
  async processDocument(filename, content, userId = 'anonymous', metadata = {}) {
    try {
      console.log(`📚 Processing document: ${filename} for user: ${userId}`);
      
      // Enhanced text preprocessing
      const cleanContent = this.preprocessText(content);
      
      // Smart chunking with overlap
      const chunks = this.createSmartChunks(cleanContent, {
        chunkSize: 800,
        overlap: 200,
        preserveSentences: true
      });
      
      console.log(`📄 Created ${chunks.length} chunks`);
      
      // Generate embeddings for each chunk (if local embeddings available)
      let embeddings = [];
      if (embeddingService.isInitialized) {
        embeddings = await embeddingService.generateBatchEmbeddings(
          chunks.map(chunk => chunk.text)
        );
      }
      
      // Add to vector store
      const vectorSuccess = await vectorStore.addDocument(filename, cleanContent, {
        userId,
        chunks: chunks.length,
        ...metadata,
        processedAt: new Date().toISOString()
      });

      // Save to database
      const dbSuccess = await saveDocument(filename, cleanContent, userId);
      
      // Generate document summary for context
      const summary = await this.generateDocumentSummary(cleanContent);
      
      // Extract key topics
      const keyTopics = this.extractKeyTopics(cleanContent);
      
      // Save document context
      await contextMemoryService.saveDocumentContext(
        userId,
        filename,
        filename,
        summary,
        keyTopics
      );

      console.log(`✅ Document processed:
   - Text length: ${cleanContent.length} characters
   - Database saved: ${dbSuccess ? 'Yes' : 'No'}
   - Vector stored: ${vectorSuccess ? 'Yes' : 'No'}
   - Chunks: ${chunks.length}
   - Summary: ${summary.substring(0, 100)}...`);

      return {
        success: true,
        filename,
        contentLength: cleanContent.length,
        chunksCreated: chunks.length,
        vectorStored: vectorSuccess,
        databaseSaved: dbSuccess,
        summary,
        keyTopics,
        embeddings: embeddings.length
      };
      
    } catch (error) {
      console.error('❌ Document processing failed:', error.message);
      return {
        success: false,
        error: error.message,
        filename
      };
    }
  }

  // Enhanced query processing with context memory
  async processQuery(query, userId = 'anonymous', options = {}) {
    try {
      console.log(`💬 RAG Chat Query from ${userId}: "${query}"`);
      console.log(`🔍 Processing RAG query: "${query}"`);
      
      const {
        includeHistory = true,
        maxResults = 5,
        temperature = 0.7,
        maxTokens = 512,
        useCache = true
      } = options;

      // Check semantic cache first
      if (useCache) {
        const cachedResponse = await contextMemoryService.getCachedResponse(userId, query);
        if (cachedResponse) {
          console.log(`🎯 Cache hit! Returning cached response`);
          return {
            response: cachedResponse.response,
            fromCache: true,
            similarity: cachedResponse.similarity,
            originalQuery: cachedResponse.originalQuery,
            metadata: { cached: true }
          };
        }
      }

      // Get user's documents
      const documents = await this.getUserDocuments(userId);
      console.log(`📚 Retrieved ${documents.length} documents from memory for user ${userId}`);

      // Get conversation history with smart context building
      const conversationContext = await contextMemoryService.buildSmartContext(
        userId,
        query,
        1500 // max tokens for context
      );
      
      console.log(`🕐 Retrieved ${conversationContext.conversationsUsed} relevant conversations for user ${userId}`);

      // Vector search for relevant chunks
      let relevantChunks = [];
      if (documents.length > 0) {
        try {
          console.log(`🔍 Vector searching for: "${query}"`);
          relevantChunks = await vectorStore.searchRelevant(query, maxResults);
          console.log(`📊 Found ${relevantChunks.length} relevant chunks`);
        } catch (error) {
          console.log(`❌ Vector search error: ${error.message}`);
          console.log(`🔄 Falling back to keyword search`);
          relevantChunks = this.keywordSearch(query, documents, maxResults);
        }
      }

      // Build enhanced prompt with all context
      const prompt = freeLLMService.buildEnhancedPrompt(
        query,
        conversationContext.context,
        relevantChunks,
        conversationContext.relevantConversations
      );

      // Generate response with multiple model fallbacks
      const llmResult = await freeLLMService.generateResponse(prompt, {
        temperature,
        maxTokens,
        modelType: 'chat'
      });

      // Save conversation to context memory
      const contextEntry = await contextMemoryService.saveConversationContext(
        userId,
        query,
        llmResult.response,
        {
          model: llmResult.model,
          relevantChunks: relevantChunks.length,
          documentsUsed: documents.length,
          vectorSearch: relevantChunks.length > 0,
          conversationContext: conversationContext.conversationsUsed,
          fromCache: llmResult.fromCache
        }
      );

      // Cache response for future similar queries
      if (useCache && !llmResult.fromCache) {
        await contextMemoryService.cacheResponse(userId, query, llmResult.response, {
          model: llmResult.model,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ RAG Response generated:
   - Chunks found: ${relevantChunks.length}
   - Vector search: ${relevantChunks.length > 0 ? 'Yes' : 'No'}
   - Model used: ${llmResult.model}
   - Context conversations: ${conversationContext.conversationsUsed}
   - Response cached: ${useCache && !llmResult.fromCache}`);

      return {
        response: llmResult.response,
        relevantChunks,
        conversationId: contextEntry.id,
        metadata: {
          chunksFound: relevantChunks.length,
          documentCount: documents.length,
          vectorSearchUsed: relevantChunks.length > 0,
          hasHistory: conversationContext.conversationsUsed > 0,
          model: llmResult.model,
          fromCache: llmResult.fromCache,
          contextTokens: conversationContext.totalTokens
        }
      };

    } catch (error) {
      console.error('❌ RAG query processing error:', error.message);
      
      // Enhanced fallback response
      const fallbackResponse = freeLLMService.generateIntelligentFallback(
        `Question: ${query}\n\nResponse:`
      );
      
      return {
        response: fallbackResponse,
        relevantChunks: [],
        error: error.message,
        metadata: {
          chunksFound: 0,
          vectorSearchUsed: false,
          model: 'fallback',
          hasError: true
        }
      };
    }
  }

  // Enhanced text preprocessing
  preprocessText(text) {
    if (!text) return '';
    
    return text
      .replace(/\r\n/g, '\n')          // Normalize line endings
      .replace(/\t/g, ' ')            // Replace tabs with spaces
      .replace(/\s{2,}/g, ' ')        // Collapse multiple spaces
      .replace(/\n{3,}/g, '\n\n')     // Limit consecutive newlines
      .trim();
  }

  // Smart chunking with sentence preservation
  createSmartChunks(text, options = {}) {
    const {
      chunkSize = 800,
      overlap = 200,
      preserveSentences = true
    } = options;

    const chunks = [];
    
    if (preserveSentences) {
      // Split by sentences first
      const sentences = text.split(/(?<=[.!?])\s+/);
      let currentChunk = '';
      let chunkIndex = 0;

      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length <= chunkSize) {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
          if (currentChunk) {
            chunks.push({
              text: currentChunk.trim(),
              index: chunkIndex++,
              startChar: text.indexOf(currentChunk.trim()),
              length: currentChunk.length
            });
          }
          
          // Start new chunk with overlap
          if (overlap > 0 && chunks.length > 0) {
            const words = currentChunk.split(' ');
            const overlapWords = words.slice(-Math.floor(overlap / 10));
            currentChunk = overlapWords.join(' ') + ' ' + sentence;
          } else {
            currentChunk = sentence;
          }
        }
      }

      // Add final chunk
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex,
          startChar: text.lastIndexOf(currentChunk.trim()),
          length: currentChunk.length
        });
      }
    } else {
      // Simple character-based chunking
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        const chunk = text.slice(i, i + chunkSize);
        chunks.push({
          text: chunk,
          index: chunks.length,
          startChar: i,
          length: chunk.length
        });
      }
    }

    return chunks;
  }

  // Generate document summary
  async generateDocumentSummary(content) {
    try {
      const preview = content.substring(0, 2000);
      const summary = await freeLLMService.summarizeText(preview, 150);
      return summary;
    } catch (error) {
      console.log('❌ Summary generation failed:', error.message);
      return content.substring(0, 200) + '...';
    }
  }

  // Extract key topics from text
  extractKeyTopics(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4);

    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  // Enhanced keyword search fallback
  keywordSearch(query, documents, maxResults = 5) {
    const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const chunks = [];

    documents.forEach(doc => {
      const sentences = doc.content.split(/[.!?]+/);
      sentences.forEach((sentence, index) => {
        let score = 0;
        keywords.forEach(keyword => {
          if (sentence.toLowerCase().includes(keyword)) {
            score++;
          }
        });

        if (score > 0) {
          chunks.push({
            text: sentence.trim(),
            metadata: {
              filename: doc.filename,
              sentenceIndex: index,
              searchType: 'keyword'
            },
            score: score / keywords.length,
            distance: 1 - (score / keywords.length)
          });
        }
      });
    });

    return chunks
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  // Get user documents
  async getUserDocuments(userId) {
    try {
      const dbDocs = await getDocuments(userId);
      return dbDocs || [];
    } catch (error) {
      console.error('❌ Error getting user documents:', error.message);
      return [];
    }
  }

  // Get comprehensive system statistics
  async getSystemStats() {
    const vectorStats = await vectorStore.getStats();
    const embeddingStats = embeddingService.getStats();
    const llmStats = freeLLMService.getStats();
    const memoryStats = contextMemoryService.getSystemStats();

    return {
      initialized: this.isInitialized,
      vectorStore: vectorStats,
      embeddings: embeddingStats,
      llm: llmStats,
      memory: memoryStats,
      components: {
        vectorStore: '✅ ChromaDB',
        embeddings: embeddingStats.initialized ? '✅ Xenova Transformers' : '✅ ChromaDB Built-in',
        llm: '✅ Hugging Face Free Models',
        memory: '✅ Enhanced Context Memory',
        database: '✅ Supabase + In-Memory Fallback'
      }
    };
  }

  // User management
  async clearUserData(userId) {
    try {
      await Promise.all([
        vectorStore.deleteUserDocuments(userId),
        contextMemoryService.clearUserContext(userId)
      ]);
      console.log(`🗑️ Cleared all data for user: ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error clearing user data:', error.message);
      return false;
    }
  }
}

// Export singleton instance
const enhancedRAGService = new EnhancedRAGService();

module.exports = {
  enhancedRAGService,
  ragService: enhancedRAGService, // Backward compatibility
  EnhancedRAGService
};
