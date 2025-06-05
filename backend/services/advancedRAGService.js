const { embeddingService } = require('./embeddingService');
const { contextMemoryService } = require('./contextMemoryService');
const { advancedConversationContext } = require('./advancedConversationContext');
const { freeLLMService } = require('./freeLLMService');
const { vectorStore } = require('./vectorStore');
const { saveDocument, getDocuments } = require('../config/database');
const temperatureConfig = require('../config/temperatureConfig');
const intelligentQueryEngine = require('./intelligentQueryEngine');

class AdvancedRAGService {
  constructor() {
    this.isInitialized = false;
    this.processingQueue = new Map();
    this.documentCache = new Map(); // Cache for processed documents
    this.queryCache = new Map(); // Cache for query results
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Advanced RAG Service...');
      
      await Promise.all([
        embeddingService.initialize(),
        vectorStore.initialize()
      ]);
      
      this.isInitialized = true;
      console.log('✅ Advanced RAG Service initialized');
      return true;
    } catch (error) {
      console.error('❌ Advanced RAG Service initialization failed:', error.message);
      return false;
    }
  }

  // Enhanced document processing with smart chunking and metadata
  async processDocument(filename, content, userId = 'anonymous', metadata = {}) {
    try {
      console.log(`📚 Processing document: ${filename} for user: ${userId}`);
      
      // Extract original filename (remove temp prefix if exists)
      const originalFilename = filename.replace(/^file-\d+-\d+-/, '');
      
      // Clean and preprocess content
      const cleanContent = this.preprocessText(content);
      
      // Advanced chunking with multiple strategies and enhanced metadata
      const chunks = this.createAdvancedChunks(cleanContent, {
        chunkSize: 1000, // Increased for better context
        overlap: 250,   // Increased overlap for better continuity
        preserveSentences: true,
        semanticChunking: true,
        filename: originalFilename, // Pass filename to chunks
        documentMetadata: metadata
      });
      
      console.log(`📄 Created ${chunks.length} chunks with enhanced metadata for: ${originalFilename}`);
      
      // Extract document metadata
      const docMetadata = this.extractDocumentMetadata(cleanContent, metadata);
      
      // Add to vector store with enhanced metadata
      let vectorCount = 0;
      try {
        const vectorSuccess = await vectorStore.addDocument(originalFilename, cleanContent, {
          userId,
          chunks: chunks.length,
          originalFilename, // Store original filename
          ...docMetadata,
          processedAt: new Date().toISOString()
        });
        
        if (vectorSuccess) {
          vectorCount = chunks.length; // Each chunk becomes a vector
        }
      } catch (error) {
        console.error('❌ Vector storage failed:', error.message);
      }

      // Save to database with original filename
      const dbSuccess = await saveDocument(originalFilename, cleanContent, userId);
      
      // Generate comprehensive document summary
      const summary = await this.generateAdvancedSummary(cleanContent);
      
      // Extract key entities and topics
      const entities = this.extractEntities(cleanContent);
      const keyTopics = this.extractKeyTopics(cleanContent);
      
      // Save enhanced document context
      await contextMemoryService.saveDocumentContext(
        userId,
        filename,
        filename,
        summary,
        keyTopics,
        { entities, chunks: chunks.length, ...docMetadata }
      );

      // Cache processed document
      this.documentCache.set(`${userId}_${filename}`, {
        content: cleanContent,
        chunks,
        summary,
        entities,
        keyTopics,
        metadata: docMetadata
      });

      console.log(`✅ Document processed with advanced RAG:
   - Text length: ${cleanContent.length} characters
   - Advanced chunks: ${chunks.length}
   - Entities found: ${entities.length}
   - Key topics: ${keyTopics.length}
   - Vectors stored: ${vectorCount}
   - Database saved: ${dbSuccess ? 'Yes' : 'No'}`);

      return {
        success: true,
        filename,
        contentLength: cleanContent.length,
        chunksCreated: chunks.length,
        embeddings: vectorCount, // This is what the route expects
        entitiesFound: entities.length,
        vectorStored: vectorCount > 0,
        databaseSaved: dbSuccess,
        summary,
        keyTopics,
        entities
      };
      
    } catch (error) {
      console.error('❌ Advanced document processing failed:', error.message);
      return { success: false, error: error.message, filename };
    }
  }

  // Advanced multi-document query processing
  async processQuery(query, userId = 'anonymous', options = {}) {
    try {
      console.log(`🔍 Processing advanced RAG query: "${query}"`);
      
      const {
        includeHistory = true,
        maxResults = 10,
        temperature = null, // Will be auto-selected based on query type
        maxTokens = 1024,
        useCache = true,
        crossDocumentSearch = true,
        rerankResults = true
      } = options;

      // Analyze query to determine optimal temperature
      const tempAnalysis = this.analyzeQuery(query);
      const optimalTemperature = temperature || temperatureConfig.getRAGTemperature(tempAnalysis.type);
      
      console.log(`🌡️ Using temperature: ${optimalTemperature} for query type: ${tempAnalysis.type}`);

      // Check query cache first
      const cacheKey = `${userId}_${query}_${optimalTemperature}`;
      if (useCache && this.queryCache.has(cacheKey)) {
        const cached = this.queryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes
          console.log('🎯 Query cache hit');
          return { ...cached.result, fromCache: true };
        }
      }

      // Get all user's documents
      let documents;
      try {
        documents = await this.getUserDocuments(userId);
        console.log(`📚 Retrieved documents:`, {
          type: typeof documents,
          isArray: Array.isArray(documents),
          length: documents ? documents.length : 'N/A',
          sample: documents ? documents[0] : 'N/A'
        });
      } catch (error) {
        console.error('❌ Error getting user documents:', error);
        return this.generateNoDocumentsResponse(query);
      }
      
      // Validate documents array
      if (!Array.isArray(documents)) {
        console.error('❌ Documents is not an array:', typeof documents);
        return this.generateNoDocumentsResponse(query);
      }

      if (documents.length === 0) {
        console.log('📝 No documents found, enabling general conversation mode');
        return await this.handleGeneralConversation(query, userId, options);
      }

      // Special handling for document list queries
      if (query.toLowerCase().includes('documents') && 
          (query.toLowerCase().includes('uploaded') || query.toLowerCase().includes('have'))) {
        return this.generateDocumentListResponse(documents, query);
      }

      // Filter documents based on query context
      let relevantDocuments = documents;
      
      // For queries about "this document" or "it", prioritize recently uploaded documents
      if (query.toLowerCase().includes('this document') || 
          query.toLowerCase().includes('read it') || 
          query.toLowerCase().includes('what') && query.toLowerCase().includes('in')) {
        
        // Sort by upload date (most recent first) and take top 2-3 documents
        relevantDocuments = documents
          .sort((a, b) => new Date(b.uploaded_at || b.created_at) - new Date(a.uploaded_at || a.created_at))
          .slice(0, 3);
        
        console.log(`📄 Focusing on ${relevantDocuments.length} most recent documents for context-aware query`);
      }

      // Intelligent query analysis with filtered documents
      let queryAnalysis;
      try {
        queryAnalysis = intelligentQueryEngine.analyzeQuery(query, relevantDocuments);
        console.log(`🧠 Intelligent Query Analysis:`, JSON.stringify(queryAnalysis, null, 2));
        
        // Check if we can answer with just metadata (like document listing)
        if (intelligentQueryEngine.canAnswerWithMetadata(queryAnalysis)) {
          return this.generateDocumentListResponse(relevantDocuments, query);
        }
        
      } catch (error) {
        console.error('❌ Error in intelligent query analysis:', error);
        // Fallback query analysis
        queryAnalysis = {
          intent: { type: 'general', confidence: 0.5 },
          searchTerms: query.toLowerCase().split(' ').filter(w => w.length > 3),
          temperature: 0.7,
          confidence: 0.5
        };
      }

      // Intelligent multi-strategy retrieval with filtered documents
      const retrievalResults = await this.performIntelligentRetrieval(
        query, 
        relevantDocuments, 
        queryAnalysis,
        maxResults
      );

      // Re-rank results based on relevance
      const rankedChunks = rerankResults ? 
        this.rerankResults(retrievalResults, query, queryAnalysis) : 
        retrievalResults;

      console.log(`📊 Retrieved and ranked ${rankedChunks.length} relevant chunks from ${relevantDocuments.length} documents`);

      // Extract chatId from userId (format: userId_chatId)
      const chatId = userId.includes('_') ? userId.split('_')[1] : 'default';

      // Get advanced conversation context
      const conversationContext = includeHistory ? 
        await advancedConversationContext.buildAdvancedChatContext(chatId, query, {
          maxTokens: 2000,
          includeDocumentRefs: true,
          includeTopicEvolution: true,
          prioritizeRecentDocuments: true,
          contextWindow: 10
        }) : 
        { 
          conversationHistory: '', 
          documentContext: '', 
          topicContext: '',
          contextMetadata: { conversationsUsed: 0 }
        };

      console.log(`🧠 Advanced conversation context: ${conversationContext.contextMetadata.conversationsUsed} conversations, ${conversationContext.contextMetadata.documentsReferenced} docs, ${conversationContext.contextMetadata.topicsCovered} topics`);

      // Build advanced prompt with intelligent context
      const prompt = this.buildIntelligentPrompt(
        query,
        rankedChunks,
        relevantDocuments,
        conversationContext,
        queryAnalysis
      );

      // Generate response with optimal temperature
      const llmResult = await freeLLMService.generateResponse(prompt, {
        temperature: optimalTemperature,
        maxTokens,
        modelType: 'chat'
      });

      console.log('LLM Result:', {
        hasResponse: !!llmResult,
        responseType: typeof llmResult?.response,
        responseLength: llmResult?.response ? llmResult.response.length : 0,
        responseContent: llmResult?.response ? llmResult.response.substring(0, 100) + '...' : 'NO RESPONSE',
        model: llmResult?.model
      });

      // Check if we got a valid response
      if (!llmResult || !llmResult.response || llmResult.response.trim().length === 0) {
        console.log('⚠️ LLM returned empty response, using fallback');
        return this.generateFallbackResponse(query, rankedChunks, relevantDocuments);
      }

      // Post-process response
      const enhancedResponse = this.postProcessResponse(
        llmResult.response,
        rankedChunks,
        relevantDocuments,
        queryAnalysis
      );

      // Save enhanced conversation context with document tracking
      const contextEntry = await advancedConversationContext.saveConversationWithDocumentContext(
        chatId,
        userId,
        query,
        enhancedResponse,
        {
          model: llmResult.model,
          documentsUsed: documents.length,
          chunksRetrieved: rankedChunks.length,
          queryAnalysis,
          retrievalStrategy: 'multi-strategy',
          relevantChunks: rankedChunks,
          queryType: queryAnalysis.type,
          confidence: queryAnalysis.confidence
        }
      );

      const result = {
        response: enhancedResponse,
        relevantChunks: rankedChunks,
        conversationId: contextEntry.id,
        metadata: {
          documentsAnalyzed: documents.length,
          chunksRetrieved: rankedChunks.length,
          queryType: queryAnalysis.intent.type,
          confidence: queryAnalysis.intent.confidence,
          temperature: optimalTemperature,
          temperatureReasoning: `Auto-selected for ${queryAnalysis.intent.type} queries`,
          intelligentAnalysis: {
            intent: queryAnalysis.intent,
            searchTerms: queryAnalysis.searchTerms,
            entities: queryAnalysis.entities,
            keywords: queryAnalysis.keywords
          },
          model: llmResult.model,
          retrievalStrategy: 'multi-strategy'
        }
      };

      // Cache result
      if (useCache) {
        this.queryCache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }

      console.log(`✅ Advanced RAG response generated:
   - Documents analyzed: ${documents.length}
   - Chunks retrieved: ${rankedChunks.length}
   - Query type: ${queryAnalysis.type}
   - Model: ${llmResult.model}`);

      return result;

    } catch (error) {
      console.error('❌ Advanced RAG query processing error:', error.message);
      return {
        response: this.generateErrorFallback(query, error),
        relevantChunks: [],
        error: error.message,
        metadata: { hasError: true, model: 'fallback' }
      };
    }
  }

  // Advanced query analysis
  analyzeQuery(query, documents = []) {
    const queryLower = query.toLowerCase();
    
    // Determine query type
    let type = 'general';
    let confidence = 0.5;
    let targetDocuments = [];
    let extractionType = null;

    // Safety check for documents
    if (!Array.isArray(documents)) {
      console.warn('⚠️ Documents parameter is not an array:', typeof documents);
      documents = [];
    }

    // Specific document queries
    const docNames = documents.map(d => d.filename.toLowerCase());
    const mentionedDocs = docNames.filter(name => 
      queryLower.includes(name.replace(/\.(pdf|docx?|txt)$/i, ''))
    );
    
    if (mentionedDocs.length > 0) {
      type = 'document-specific';
      confidence = 0.9;
      targetDocuments = mentionedDocs;
    }

    // Comparison queries
    if (queryLower.match(/\b(compare|difference|versus|vs|between)\b/)) {
      type = 'comparison';
      confidence = 0.8;
    }

    // Summary queries
    if (queryLower.match(/\b(summarize|summary|overview|main points)\b/)) {
      type = 'summary';
      confidence = 0.85;
    }

    // Extraction queries
    if (queryLower.match(/\b(skills|experience|education|qualifications)\b/)) {
      type = 'extraction';
      extractionType = queryLower.match(/\b(skills|experience|education|qualifications)\b/)[0];
      confidence = 0.8;
    }

    // Search queries
    if (queryLower.match(/\b(find|search|look for|locate)\b/)) {
      type = 'search';
      confidence = 0.7;
    }

    // Multi-document queries
    if (queryLower.match(/\b(all documents|each document|every document|across documents)\b/)) {
      type = 'multi-document';
      confidence = 0.9;
    }

    return {
      type,
      confidence,
      targetDocuments,
      extractionType,
      keywords: this.extractQueryKeywords(query),
      intent: this.determineQueryIntent(query)
    };
  }

  // Intelligent multi-strategy retrieval
  async performIntelligentRetrieval(query, documents, queryAnalysis, maxResults = 10) {
    console.log(`🔍 Performing intelligent retrieval for intent: ${queryAnalysis.intent.type}`);
    
    const allChunks = [];
    const searchQueries = intelligentQueryEngine.generateSearchQueries(queryAnalysis);
    
    console.log(`🔍 Generated search queries:`, searchQueries);

    // Strategy 1: Direct document content search for document listing queries
    if (queryAnalysis.intent.type === 'documentList') {
      // For document listing, we don't need vector search - just return metadata
      return documents.map(doc => ({
        text: `Document: ${doc.original_name || doc.filename} (uploaded: ${new Date(doc.uploaded_at || doc.created_at).toLocaleDateString()})`,
        metadata: {
          filename: doc.original_name || doc.filename,
          uploadDate: doc.uploaded_at || doc.created_at,
          type: 'document_metadata'
        },
        score: 1.0,
        retrievalStrategy: 'metadata'
      }));
    }

    // Strategy 2: Enhanced vector search with multiple queries
    for (const searchQuery of searchQueries) {
      try {
        console.log(`🔍 Vector searching for: "${searchQuery}"`);
        const vectorResults = await vectorStore.searchRelevant(
          searchQuery,
          Math.ceil(maxResults / searchQueries.length)
        );
        
        if (vectorResults && vectorResults.length > 0) {
          console.log(`📊 Found ${vectorResults.length} vector results for "${searchQuery}"`);
          vectorResults.forEach(chunk => {
            chunk.retrievalStrategy = `vector-${searchQuery.substring(0, 20)}`;
            chunk.searchQuery = searchQuery;
          });
          allChunks.push(...vectorResults);
        }
      } catch (error) {
        console.error(`❌ Vector search error for "${searchQuery}":`, error.message);
      }
    }

    // Strategy 3: Text-based search in document content
    if (intelligentQueryEngine.needsDocumentContent(queryAnalysis)) {
      for (const doc of documents) {
        if (doc.text_content) {
          const textMatches = this.searchInText(doc.text_content, queryAnalysis.expandedKeywords, doc);
          textMatches.forEach(match => {
            match.retrievalStrategy = 'text-search';
          });
          allChunks.push(...textMatches);
        }
      }
    }

    // Strategy 4: Metadata search for specific document references
    if (queryAnalysis.documentReferences && queryAnalysis.documentReferences.length > 0) {
      for (const ref of queryAnalysis.documentReferences) {
        const doc = ref.document;
        if (doc.text_content) {
          const chunks = this.extractRelevantChunks(doc.text_content, queryAnalysis.expandedKeywords, doc);
          chunks.forEach(chunk => {
            chunk.retrievalStrategy = 'document-specific';
            chunk.score = (chunk.score || 0.5) * 1.2; // Boost referenced documents
          });
          allChunks.push(...chunks);
        }
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueChunks = this.deduplicateChunks(allChunks);
    const sortedChunks = uniqueChunks.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    console.log(`📊 Found ${sortedChunks.length} total relevant chunks`);
    return sortedChunks.slice(0, maxResults);
  }

  // Search for text patterns in document content
  searchInText(content, keywords, document) {
    const chunks = [];
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineScore = this.calculateLineScore(line, keywords);
      
      if (lineScore > 0.1) {
        // Create context chunk with surrounding lines
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        const contextChunk = lines.slice(start, end).join('\n');
        
        chunks.push({
          text: contextChunk,
          metadata: {
            filename: document.original_name || document.filename,
            line: i + 1,
            type: 'text_match'
          },
          score: lineScore,
          retrievalStrategy: 'text-search'
        });
      }
    }
    
    return chunks;
  }

  // Calculate relevance score for a line of text
  calculateLineScore(line, keywords) {
    const lineLower = line.toLowerCase();
    let score = 0;
    
    for (const keyword of keywords) {
      if (lineLower.includes(keyword.toLowerCase())) {
        score += 0.3;
        
        // Bonus for exact word match
        const wordRegex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
        if (wordRegex.test(lineLower)) {
          score += 0.2;
        }
      }
    }
    
    return Math.min(score, 1.0);
  }

  // Extract relevant chunks from document content
  extractRelevantChunks(content, keywords, document) {
    const chunks = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    for (const sentence of sentences) {
      const score = this.calculateLineScore(sentence, keywords);
      if (score > 0.2) {
        chunks.push({
          text: sentence.trim(),
          metadata: {
            filename: document.original_name || document.filename,
            type: 'sentence_match'
          },
          score: score,
          retrievalStrategy: 'content-extraction'
        });
      }
    }
    
    return chunks;
  }

  // Remove duplicate chunks
  deduplicateChunks(chunks) {
    const seen = new Set();
    return chunks.filter(chunk => {
      const key = chunk.text.substring(0, 100);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Multi-strategy retrieval
  async performMultiStrategyRetrieval(query, documents, queryAnalysis, maxResults) {
    const allChunks = [];

    // Strategy 1: Vector similarity search
    try {
      if (vectorStore.isInitialized) {
        const vectorChunks = await vectorStore.searchRelevant(query, Math.ceil(maxResults * 0.6));
        vectorChunks.forEach(chunk => {
          chunk.retrievalStrategy = 'vector';
          chunk.score = chunk.score || (1 - chunk.distance);
        });
        allChunks.push(...vectorChunks);
      }
    } catch (error) {
      console.log('❌ Vector search failed:', error.message);
    }

    // Strategy 2: Keyword-based search
    const keywordChunks = this.performKeywordSearch(query, documents, Math.ceil(maxResults * 0.4));
    keywordChunks.forEach(chunk => {
      chunk.retrievalStrategy = 'keyword';
    });
    allChunks.push(...keywordChunks);

    // Strategy 3: Entity-based search
    if (queryAnalysis.extractionType) {
      const entityChunks = this.performEntitySearch(queryAnalysis.extractionType, documents, Math.ceil(maxResults * 0.3));
      entityChunks.forEach(chunk => {
        chunk.retrievalStrategy = 'entity';
      });
      allChunks.push(...entityChunks);
    }

    // Strategy 4: Document-specific search
    if (queryAnalysis.targetDocuments.length > 0) {
      const docChunks = this.performDocumentSpecificSearch(query, documents, queryAnalysis.targetDocuments);
      docChunks.forEach(chunk => {
        chunk.retrievalStrategy = 'document-specific';
      });
      allChunks.push(...docChunks);
    }

    // Remove duplicates and limit results
    const uniqueChunks = this.removeDuplicateChunks(allChunks);
    return uniqueChunks.slice(0, maxResults);
  }

  // Enhanced keyword search
  performKeywordSearch(query, documents, maxResults) {
    const keywords = this.extractQueryKeywords(query);
    const chunks = [];

    documents.forEach(doc => {
      if (!doc.content) return;
      
      // Split into sentences and paragraphs
      const sentences = doc.content.split(/[.!?]+/);
      const paragraphs = doc.content.split(/\n\s*\n/);

      // Search in sentences
      sentences.forEach((sentence, index) => {
        const score = this.calculateKeywordScore(sentence, keywords);
        if (score > 0.1) {
          chunks.push({
            text: sentence.trim(),
            metadata: {
              filename: doc.filename,
              sentenceIndex: index,
              searchType: 'sentence'
            },
            score,
            distance: 1 - score
          });
        }
      });

      // Search in paragraphs for better context
      paragraphs.forEach((paragraph, index) => {
        const score = this.calculateKeywordScore(paragraph, keywords) * 0.8; // Slightly lower weight
        if (score > 0.1 && paragraph.trim().length > 100) {
          chunks.push({
            text: paragraph.trim(),
            metadata: {
              filename: doc.filename,
              paragraphIndex: index,
              searchType: 'paragraph'
            },
            score,
            distance: 1 - score
          });
        }
      });
    });

    return chunks
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  // Entity-based search for specific information types
  performEntitySearch(entityType, documents, maxResults = 5) {
    const chunks = [];
    const patterns = this.getEntityPatterns(entityType);

    documents.forEach(doc => {
      if (!doc.content) return;
      
      const sentences = doc.content.split(/[.!?]+/);
      
      sentences.forEach((sentence, index) => {
        let score = 0;
        patterns.forEach(pattern => {
          if (pattern.test(sentence.toLowerCase())) {
            score += 0.3;
          }
        });

        if (score > 0) {
          chunks.push({
            text: sentence.trim(),
            metadata: {
              filename: doc.filename,
              sentenceIndex: index,
              entityType,
              searchType: 'entity'
            },
            score,
            distance: 1 - score
          });
        }
      });
    });

    return chunks
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  // Document-specific search
  performDocumentSpecificSearch(query, documents, targetDocuments) {
    const relevantDocs = documents.filter(doc => 
      targetDocuments.some(target => 
        doc.filename.toLowerCase().includes(target)
      )
    );

    const chunks = [];
    const keywords = this.extractQueryKeywords(query);

    relevantDocs.forEach(doc => {
      const sentences = doc.content.split(/[.!?]+/);
      sentences.forEach((sentence, index) => {
        const score = this.calculateKeywordScore(sentence, keywords) * 1.2; // Boost for specific docs
        if (score > 0.1) {
          chunks.push({
            text: sentence.trim(),
            metadata: {
              filename: doc.filename,
              sentenceIndex: index,
              searchType: 'document-specific'
            },
            score,
            distance: 1 - score
          });
        }
      });
    });

    return chunks.sort((a, b) => b.score - a.score);
  }

  // Advanced result re-ranking
  rerankResults(chunks, query, queryAnalysis) {
    return chunks.map(chunk => {
      let newScore = chunk.score || 0;

      // Boost based on retrieval strategy
      const strategyBoosts = {
        'vector': 1.0,
        'keyword': 0.8,
        'entity': 0.9,
        'document-specific': 1.1
      };
      newScore *= strategyBoosts[chunk.retrievalStrategy] || 1.0;

      // Boost based on query type
      if (queryAnalysis.intent && queryAnalysis.intent.type === 'extraction' && chunk.metadata.entityType === queryAnalysis.extractionType) {
        newScore *= 1.3;
      }

      // Boost for longer, more informative chunks
      if (chunk.text.length > 200) {
        newScore *= 1.1;
      }

      // Penalize very short chunks
      if (chunk.text.length < 50) {
        newScore *= 0.7;
      }

      return { ...chunk, score: newScore };
    }).sort((a, b) => b.score - a.score);
  }

  // Build intelligent prompt based on query analysis
  buildIntelligentPrompt(query, chunks, documents, conversationContext, queryAnalysis) {
    let prompt = '';

    // Add conversation context if available
    if (conversationContext.conversationHistory) {
      prompt += 'CONVERSATION HISTORY:\n';
      prompt += conversationContext.conversationHistory + '\n';
    }

    // Add document context from conversation
    if (conversationContext.documentContext) {
      prompt += conversationContext.documentContext;
    }

    // Special handling for different intent types
    switch (queryAnalysis.intent.type) {
      case 'documentList':
        return this.buildDocumentListPrompt(query, documents);
        
      case 'extraction':
        return this.buildExtractionPrompt(query, chunks, documents, queryAnalysis);
        
      case 'summary':
        return this.buildSummaryPrompt(query, chunks, documents);
        
      default:
        return this.buildGeneralPrompt(query, chunks, documents, conversationContext, queryAnalysis);
    }
  }

  // Build prompt for document listing
  buildDocumentListPrompt(query, documents) {
    const documentList = documents.map((doc, index) => {
      return `${index + 1}. ${doc.original_name || doc.filename}`;
    }).join('\n');

    return `Available documents:
${documentList}

Query: ${query}

List the documents and briefly answer the user's question. Keep it concise.`;
  }

  // Build prompt for content extraction
  buildExtractionPrompt(query, chunks, documents, queryAnalysis) {
    let prompt = `Extract specific information from ${documents.length} document${documents.length > 1 ? 's' : ''}.

RELEVANT CONTENT:
`;

    if (chunks.length > 0) {
      chunks.slice(0, 2).forEach((chunk, index) => {  // Reduced from 3 to 2
        const filename = chunk.metadata?.originalFilename || chunk.metadata?.filename || chunk.filename || 'Unknown Document';
        prompt += `\nFrom "${filename}":\n`;
        const limitedText = chunk.text.length > 150 ? chunk.text.substring(0, 150) + '...' : chunk.text;  // Reduced from 250 to 150
        prompt += `${limitedText}\n`;
      });
    }

    prompt += `\nQuery: ${query}

Provide a concise, direct answer with only the requested information. Keep it brief and focused.`;

    return prompt;
  }

  // Build prompt for summarization
  buildSummaryPrompt(query, chunks, documents) {
    let prompt = `Summarize information from ${documents.length} document${documents.length > 1 ? 's' : ''}.

RELEVANT CONTENT:
`;

    if (chunks.length > 0) {
      chunks.slice(0, 3).forEach((chunk, index) => {  // Reduced from 4 to 3
        const limitedText = chunk.text.length > 150 ? chunk.text.substring(0, 150) + '...' : chunk.text;  // Reduced from 200 to 150
        prompt += `\n${index + 1}. ${limitedText}\n`;
      });
    }

    prompt += `\nQuery: ${query}

Provide a concise summary that directly addresses the user's request. Keep it brief and focused.`;

    return prompt;
  }

  // Build general prompt
  buildGeneralPrompt(query, chunks, documents, conversationContext, queryAnalysis) {
    let prompt = '';

    // Add conversation context (only if directly relevant and keep it short)
    if (conversationContext.conversationHistory && this.isConversationContextRelevant(conversationContext.conversationHistory, query)) {
      const contextLines = conversationContext.conversationHistory.split('\n').slice(-2); // Last 2 lines only
      prompt += 'RECENT CONVERSATION:\n';
      prompt += contextLines.join('\n') + '\n\n';
    }

    // Add relevant information (limit to prevent token overflow)
    if (chunks.length > 0) {
      prompt += 'RELEVANT INFORMATION:\n';
      
      // Limit chunks to prevent token overflow (max 3 chunks)
      chunks.slice(0, 3).forEach((chunk, index) => {
        const filename = chunk.metadata?.originalFilename || chunk.metadata?.filename || chunk.filename || 'Unknown Document';
        prompt += `\nFrom "${filename}":\n`;
        // Limit chunk text to 200 characters to control token count
        const limitedText = chunk.text.length > 200 ? chunk.text.substring(0, 200) + '...' : chunk.text;
        prompt += `${limitedText}\n`;
      });
      
      prompt += '\n';
    }

    prompt += `Query: ${query}

Provide a direct, concise answer based on the available information. Keep it focused and relevant.`;

    return prompt;
  }

  // Check if conversation context is relevant to current query
  isConversationContextRelevant(conversationHistory, currentQuery) {
    if (!conversationHistory) return false;
    
    const lowerHistory = conversationHistory.toLowerCase();
    const lowerQuery = currentQuery.toLowerCase();
    
    // Extract key entities/topics from current query
    const queryWords = lowerQuery.split(' ').filter(word => word.length > 3);
    
    // Check if any significant words from current query appear in conversation history
    const relevantWords = queryWords.filter(word => 
      lowerHistory.includes(word) && 
      !['what', 'when', 'where', 'how', 'why', 'can', 'you', 'tell', 'her', 'his', 'their'].includes(word)
    );
    
    // If we have 2+ relevant connecting words, context might be useful
    return relevantWords.length >= 2;
  }
  buildAdvancedPrompt(query, chunks, documents, conversationContext, queryAnalysis) {
    let prompt = '';

    // Add advanced conversation history with context awareness
    if (conversationContext.conversationHistory) {
      prompt += 'CONVERSATION HISTORY:\n';
      prompt += conversationContext.conversationHistory + '\n';
    }

    // Add document reference context from conversation
    if (conversationContext.documentContext) {
      prompt += conversationContext.documentContext;
    }

    // Add topic evolution context
    if (conversationContext.topicContext) {
      prompt += conversationContext.topicContext;
    }

    // Add current document context
    if (chunks.length > 0) {
      prompt += 'RELEVANT INFORMATION FROM UPLOADED DOCUMENTS:\n';
      prompt += '='.repeat(60) + '\n';
      
      // Group chunks by document for better organization
      const chunksByDoc = {};
      chunks.forEach(chunk => {
        const filename = chunk.metadata.filename;
        if (!chunksByDoc[filename]) {
          chunksByDoc[filename] = [];
        }
        chunksByDoc[filename].push(chunk);
      });

      // Present information organized by document
      Object.entries(chunksByDoc).forEach(([filename, docChunks], index) => {
        prompt += `\nDocument ${index + 1}: ${filename}\n`;
        prompt += '-'.repeat(40) + '\n';
        docChunks.slice(0, 3).forEach((chunk, chunkIndex) => {
          prompt += `${chunkIndex + 1}. ${chunk.text.substring(0, 400)}\n`;
          if (chunk.retrievalStrategy) {
            prompt += `   [Retrieved via: ${chunk.retrievalStrategy}]\n`;
          }
        });
      });
      
      prompt += '='.repeat(60) + '\n\n';
    }

    // Add context-aware instructions
    const instructions = this.getContextAwareInstructions(queryAnalysis, documents.length, conversationContext);
    
    prompt += `${instructions}

CURRENT QUERY: ${query}

Please provide a comprehensive response that:
1. Takes into account our conversation history
2. References relevant information from the uploaded documents
3. Maintains context awareness throughout the response
4. Organizes information clearly when dealing with multiple documents

RESPONSE:`;

    return prompt;
  }

  // Get context-aware instructions
  getContextAwareInstructions(queryAnalysis, documentCount, conversationContext) {
    let baseInstruction = `You are an AI assistant with access to ${documentCount} uploaded document(s) and our conversation history. `;
    
    // Add context-specific instructions
    if (conversationContext.contextMetadata?.queryAnalysis?.isFollowUp) {
      baseInstruction += 'This appears to be a follow-up question to our previous discussion. ';
    }
    
    if (conversationContext.contextMetadata?.queryAnalysis?.referencesPrevious) {
      baseInstruction += 'The user is referencing something from our earlier conversation. ';
    }

    if (conversationContext.contextMetadata?.documentsReferenced > 1) {
      baseInstruction += 'We have been discussing multiple documents in this conversation. ';
    }

    const typeInstructions = {
      'comparison': 'Please compare the information across the different documents and highlight similarities and differences, considering our conversation context.',
      'summary': 'Please provide a comprehensive summary that covers the main points from all relevant documents, building on our previous discussions.',
      'extraction': `Please extract and list all relevant ${queryAnalysis.extractionType || 'information'} found in the documents, considering what we've discussed before.`,
      'search': 'Please search through all documents and provide the most relevant information, keeping in mind our conversation flow.',
      'multi-document': 'Please analyze information across all documents and provide a consolidated response that acknowledges our conversation history.',
      'document-specific': 'Please focus on the specific document(s) mentioned, while maintaining awareness of our conversation context.',
      'general': 'Please provide a detailed response based on the relevant information from the documents and our conversation history.'
    };

    return baseInstruction + (typeInstructions[queryAnalysis.intent?.type] || typeInstructions.general);
  }

  // Helper methods
  extractQueryKeywords(query) {
    return query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isStopWord(word));
  }

  isStopWord(word) {
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'have', 'what', 'when', 'where', 'who', 'will', 'how', 'from'];
    return stopWords.includes(word.toLowerCase());
  }

  calculateKeywordScore(text, keywords) {
    const textLower = text.toLowerCase();
    let score = 0;
    let foundKeywords = 0;

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        foundKeywords++;
        score += matches.length * (keyword.length > 4 ? 1.2 : 1.0); // Boost longer keywords
      }
    });

    // Normalize score
    return foundKeywords > 0 ? (score / Math.max(keywords.length, 1)) * (foundKeywords / keywords.length) : 0;
  }

  getEntityPatterns(entityType) {
    const patterns = {
      'skills': [
        /skills?:/i, /proficient in/i, /experienced with/i, /expertise in/i, 
        /knowledge of/i, /familiar with/i, /competent in/i
      ],
      'experience': [
        /experience:/i, /worked at/i, /employed at/i, /position at/i, 
        /role at/i, /years? of/i, /background in/i
      ],
      'education': [
        /education:/i, /degree in/i, /studied at/i, /university/i, 
        /college/i, /graduated/i, /bachelor/i, /master/i, /phd/i
      ],
      'qualifications': [
        /qualified in/i, /certified in/i, /license/i, /accredited/i, 
        /trained in/i, /qualification/i
      ]
    };
    return patterns[entityType] || [];
  }

  removeDuplicateChunks(chunks) {
    const seen = new Set();
    return chunks.filter(chunk => {
      const key = `${chunk.metadata.filename}_${chunk.text.substring(0, 100)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  determineQueryIntent(query) {
    const queryLower = query.toLowerCase();
    if (queryLower.includes('?')) return 'question';
    if (queryLower.match(/\b(show|list|find|get)\b/)) return 'request';
    if (queryLower.match(/\b(tell|explain|describe)\b/)) return 'explanation';
    return 'general';
  }

  // Enhanced text preprocessing
  preprocessText(text) {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s{3,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Advanced chunking strategies with enhanced metadata
  createAdvancedChunks(text, options = {}) {
    const { 
      chunkSize = 1000, 
      overlap = 250, 
      preserveSentences = true, 
      semanticChunking = true,
      filename = 'unknown',
      documentMetadata = {}
    } = options;
    const chunks = [];

    if (semanticChunking && preserveSentences) {
      // Semantic sentence-based chunking with enhanced context
      const sentences = text.split(/(?<=[.!?])\s+/);
      let currentChunk = '';
      let chunkIndex = 0;
      let charPosition = 0;

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        if (currentChunk.length + sentence.length <= chunkSize) {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
          if (currentChunk) {
            // Add surrounding context for better understanding
            const prevContext = i > 0 ? sentences[i-1].slice(-100) : '';
            const nextContext = i < sentences.length - 1 ? sentences[i+1].slice(0, 100) : '';
            
            chunks.push({
              text: currentChunk.trim(),
              index: chunkIndex++,
              type: 'semantic',
              length: currentChunk.length,
              charPosition,
              filename, // Include filename in chunk metadata
              originalFilename: filename,
              documentMetadata,
              contextBefore: prevContext,
              contextAfter: nextContext,
              sentenceRange: `${Math.max(0, i-5)}-${Math.min(sentences.length-1, i+5)}`,
              timestamp: new Date().toISOString()
            });
            
            charPosition += currentChunk.length;
          }
          
          // Handle overlap with better context preservation
          if (overlap > 0 && chunks.length > 0) {
            const words = currentChunk.split(' ');
            const overlapWords = words.slice(-Math.min(Math.floor(overlap / 10), words.length));
            currentChunk = overlapWords.join(' ') + ' ' + sentence;
          } else {
            currentChunk = sentence;
          }
        }
      }

      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex,
          type: 'semantic',
          length: currentChunk.length,
          charPosition,
          filename,
          originalFilename: filename,
          documentMetadata,
          contextBefore: sentences.length > 1 ? sentences[sentences.length-2].slice(-100) : '',
          contextAfter: '',
          sentenceRange: `${Math.max(0, sentences.length-5)}-${sentences.length-1}`,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // Simple character-based chunking with enhanced metadata
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        const chunk = text.slice(i, i + chunkSize);
        chunks.push({
          text: chunk,
          index: chunks.length,
          type: 'character',
          length: chunk.length,
          charPosition: i,
          filename,
          originalFilename: filename,
          documentMetadata,
          timestamp: new Date().toISOString()
        });
      }
    }

    return chunks;
  }

  // Extract document metadata
  extractDocumentMetadata(content, providedMetadata = {}) {
    const metadata = { ...providedMetadata };
    
    // Extract basic stats
    metadata.wordCount = content.split(/\s+/).length;
    metadata.characterCount = content.length;
    metadata.paragraphCount = content.split(/\n\s*\n/).length;
    
    // Try to extract document type/format hints
    if (content.match(/(skills?|experience|education)/i)) {
      metadata.documentType = 'resume';
    } else if (content.match(/(abstract|introduction|conclusion)/i)) {
      metadata.documentType = 'academic';
    } else if (content.match(/(budget|cost|price|financial)/i)) {
      metadata.documentType = 'financial';
    } else {
      metadata.documentType = 'general';
    }
    
    return metadata;
  }

  // Extract entities from document
  extractEntities(content) {
    const entities = [];
    
    // Simple entity extraction patterns
    const patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      date: /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\w+\s+\d{1,2},?\s+\d{4}\b/g,
      money: /\$\d+(?:,\d{3})*(?:\.\d{2})?/g
    };
    
    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = content.match(pattern) || [];
      matches.forEach(match => {
        entities.push({ type, value: match });
      });
    });
    
    return entities;
  }

  // Generate advanced summary
  async generateAdvancedSummary(content) {
    try {
      const preview = content.substring(0, 3000);
      const summary = await freeLLMService.summarizeText(preview, 200);
      return summary;
    } catch (error) {
      console.log('❌ Advanced summary generation failed:', error.message);
      return content.substring(0, 300) + '...';
    }
  }

  // Extract key topics with better algorithm
  extractKeyTopics(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4 && !this.isStopWord(word));

    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Weight by frequency and word length
    const weightedWords = Object.entries(wordCount)
      .map(([word, count]) => ({
        word,
        score: count * (word.length > 6 ? 1.5 : 1.0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(item => item.word);

    return weightedWords;
  }

  // Response post-processing
  postProcessResponse(response, chunks, documents, queryAnalysis) {
    let enhancedResponse = response;

    // Only add document citations if multiple documents were used and it's relevant
    if (documents.length > 1 && chunks.length > 0 && queryAnalysis.intent.type !== 'extraction') {
      const docsUsed = [...new Set(chunks.map(chunk => chunk.metadata.filename))];
      if (docsUsed.length > 1) {
        enhancedResponse += `\n\n*From: ${docsUsed.join(', ')}*`;
      }
    }

    return enhancedResponse;
  }

  // Handle general conversation when no documents are available
  async handleGeneralConversation(query, userId, options) {
    try {
      console.log(`💬 Handling general conversation: "${query}"`);
      
      const { temperature = 0.7, maxTokens = 1024 } = options;
      
      // Build a general conversation prompt
      const conversationPrompt = `Answer the user's question directly and concisely.

Query: ${query}

Provide a focused, helpful response. Keep it brief and relevant.`;

      // Generate response using the LLM
      const llmResult = await freeLLMService.generateResponse(conversationPrompt, {
        temperature,
        maxTokens: 300, // Reduced from 1024 to 300
        modelType: 'chat'
      });

      console.log('General conversation LLM result:', {
        hasResponse: !!llmResult,
        responseLength: llmResult?.response ? llmResult.response.length : 0,
        model: llmResult?.model
      });

      // Check if we got a valid response
      if (!llmResult || !llmResult.response || llmResult.response.trim().length === 0) {
        console.log('⚠️ General conversation LLM failed, using fallback');
        return this.generateGeneralConversationFallback(query);
      }

      return {
        response: llmResult.response,
        relevantChunks: [],
        conversationId: `general_${Date.now()}`,
        metadata: {
          documentsAnalyzed: 0,
          chunksRetrieved: 0,
          queryType: 'general_conversation',
          confidence: 0.8,
          temperature,
          model: llmResult.model,
          retrievalStrategy: 'general_conversation'
        }
      };

    } catch (error) {
      console.error('❌ General conversation error:', error);
      return this.generateGeneralConversationFallback(query);
    }
  }

  // Fallback for general conversation
  generateGeneralConversationFallback(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || lowerQuery === 'hey') {
      return "Hello! I'm your AI assistant. I can help you with various topics including technology, programming, general knowledge, and more. You can also upload documents if you want me to analyze and answer questions about specific content.";
    }
    
    if (lowerQuery.includes('python') || lowerQuery.includes('code')) {
      return "I'd be happy to help with Python programming! I can write code examples, explain concepts, debug issues, and provide best practices. What specific Python topic would you like to explore?";
    }
    
    if (lowerQuery.includes('help')) {
      return "I'm here to help! I can assist with:\n\n• Programming and coding questions\n• General knowledge and explanations\n• Problem-solving and advice\n• Document analysis (upload files first)\n• Technology discussions\n\nWhat would you like to know about?";
    }
    
    return `I understand you're asking about "${query}". I'm a versatile AI assistant that can help with programming, technology, general knowledge, and more. If you have documents you'd like me to analyze, feel free to upload them and I can provide specific answers about their content. What else can I help you with?`;
  }

  generateErrorFallback(query, error) {
    return `I encountered an error while processing your query about the documents. Please try rephrasing your question or contact support if the issue persists. Error: ${error.message}`;
  }

  // Generate fallback response when LLM fails
  generateFallbackResponse(query, chunks, documents) {
    let fallbackResponse = `I understand you're asking about "${query}". `;
    
    if (documents.length > 0) {
      fallbackResponse += `I have access to ${documents.length} document${documents.length > 1 ? 's' : ''} that may contain relevant information. `;
      
      if (chunks.length > 0) {
        fallbackResponse += `Based on the available information, here's what I found:\n\n`;
        chunks.slice(0, 3).forEach((chunk, index) => {
          const filename = chunk.metadata?.originalFilename || chunk.metadata?.filename || 'Document';
          fallbackResponse += `${index + 1}. From ${filename}:\n${chunk.text.substring(0, 200)}...\n\n`;
        });
      }
    } else {
      fallbackResponse += `However, I don't see any documents uploaded to this chat yet. Please upload some documents first so I can help answer your questions about them.`;
    }
    
    return fallbackResponse;
  }

  // Get user documents
  async getUserDocuments(userId) {
    try {
      console.log(`🔍 Getting documents for userId: ${userId}`);
      const dbDocs = await getDocuments(userId);
      
      // Ensure we always return an array
      if (!dbDocs) {
        console.log(`⚠️ getDocuments returned null/undefined for ${userId}`);
        return [];
      }
      
      if (!Array.isArray(dbDocs)) {
        console.log(`⚠️ getDocuments returned non-array for ${userId}:`, typeof dbDocs);
        return [];
      }
      
      console.log(`✅ Retrieved ${dbDocs.length} documents for ${userId}`);
      return dbDocs;
    } catch (error) {
      console.error('❌ Error getting user documents:', error.message);
      return [];
    }
  }

  // Generate response listing user's documents
  generateDocumentListResponse(documents, query) {
    if (!documents || documents.length === 0) {
      return {
        response: "You haven't uploaded any documents yet. Please upload some documents first to get started with document-based queries.",
        relevantChunks: [],
        metadata: {
          documentsAnalyzed: 0,
          chunksRetrieved: 0,
          queryType: 'document_list',
          confidence: 1.0,
          temperature: 0.1,
          temperatureReasoning: 'Factual document listing',
          sources: [],
          hasDocuments: false
        }
      };
    }

    const documentList = documents.map((doc, index) => {
      const displayName = doc.original_name || doc.filename;
      return `${index + 1}. **${displayName}** (uploaded: ${new Date(doc.uploaded_at || doc.created_at).toLocaleDateString()})`;
    }).join('\n');

    const response = `You have uploaded ${documents.length} document${documents.length > 1 ? 's' : ''}:\n\n${documentList}\n\nYou can ask me questions about any of these documents, compare them, or ask for summaries. What would you like to know?`;

    return {
      response,
      relevantChunks: [],
      metadata: {
        documentsAnalyzed: documents.length,
        chunksRetrieved: 0,
        queryType: 'document_list',
        confidence: 1.0,
        temperature: 0.1,
        temperatureReasoning: 'Factual document listing',
        sources: documents.map(doc => ({
          filename: doc.original_name || doc.filename,
          uploadDate: doc.uploaded_at || doc.created_at
        })),
        hasDocuments: true
      }
    };
  }

  // Clear caches
  clearCaches() {
    this.documentCache.clear();
    this.queryCache.clear();
    console.log('🗑️ RAG caches cleared');
  }
}

// Export singleton instance
const advancedRAGService = new AdvancedRAGService();

module.exports = {
  advancedRAGService,
  AdvancedRAGService
};
