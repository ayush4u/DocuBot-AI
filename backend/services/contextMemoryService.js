class ContextMemoryService {
  constructor() {
    // In-memory storage (can be enhanced with Redis later)
    this.userContexts = new Map();
    this.conversationHistory = new Map();
    this.documentContexts = new Map();
    this.semanticCache = new Map();
  }

  // Enhanced context management
  async saveConversationContext(userId, message, response, metadata = {}) {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }

    const conversation = this.conversationHistory.get(userId);
    const contextEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      userMessage: message,
      botResponse: response,
      metadata: {
        tokens: message.length + response.length,
        relevantDocs: metadata.relevantDocs || [],
        confidence: metadata.confidence || 0.5,
        embeddings: metadata.embeddings || null,
        ...metadata
      }
    };

    conversation.push(contextEntry);

    // Keep only last 50 conversations per user to manage memory
    if (conversation.length > 50) {
      conversation.splice(0, conversation.length - 50);
    }

    console.log(`💾 Saved conversation context for user: ${userId}`);
    return contextEntry;
  }

  // Get conversation history with smart context selection
  async getConversationHistory(userId, limit = 10, includeEmbeddings = false) {
    const conversations = this.conversationHistory.get(userId) || [];
    
    // Get recent conversations
    const recentConversations = conversations.slice(-limit);
    
    if (!includeEmbeddings) {
      return recentConversations.map(conv => ({
        userMessage: conv.userMessage,
        botResponse: conv.botResponse,
        timestamp: conv.timestamp
      }));
    }

    return recentConversations;
  }

  // Smart context building for prompts
  async buildSmartContext(userId, currentQuery, maxTokens = 2000) {
    const conversations = this.conversationHistory.get(userId) || [];
    
    if (conversations.length === 0) {
      return { context: '', relevantConversations: [] };
    }

    // Sort by relevance (more recent = higher score)
    const scoredConversations = conversations.map((conv, index) => ({
      ...conv,
      recencyScore: index / conversations.length,
      relevanceScore: this.calculateRelevanceScore(currentQuery, conv.userMessage),
      totalScore: 0
    }));

    // Calculate combined score (recency + relevance)
    scoredConversations.forEach(conv => {
      conv.totalScore = (conv.recencyScore * 0.3) + (conv.relevanceScore * 0.7);
    });

    // Sort by total score
    scoredConversations.sort((a, b) => b.totalScore - a.totalScore);

    // Build context within token limit
    let context = '';
    let tokenCount = 0;
    const relevantConversations = [];

    for (const conv of scoredConversations) {
      const convText = `User: ${conv.userMessage}\nBot: ${conv.botResponse}\n\n`;
      const convTokens = convText.length;
      
      if (tokenCount + convTokens <= maxTokens) {
        context = convText + context; // Add to beginning for chronological order
        tokenCount += convTokens;
        relevantConversations.unshift(conv);
      } else {
        break;
      }
    }

    return {
      context: context.trim(),
      relevantConversations,
      totalTokens: tokenCount,
      conversationsUsed: relevantConversations.length
    };
  }

  // Calculate relevance score between two texts
  calculateRelevanceScore(query, previousMessage) {
    if (!query || !previousMessage) return 0;

    const queryWords = query.toLowerCase().split(/\s+/);
    const messageWords = previousMessage.toLowerCase().split(/\s+/);
    
    let matches = 0;
    queryWords.forEach(word => {
      if (word.length > 3 && messageWords.includes(word)) {
        matches++;
      }
    });

    return matches / Math.max(queryWords.length, 1);
  }

  // Document context management
  async saveDocumentContext(userId, documentId, filename, summary, keyTopics = []) {
    if (!this.documentContexts.has(userId)) {
      this.documentContexts.set(userId, new Map());
    }

    const userDocs = this.documentContexts.get(userId);
    userDocs.set(documentId, {
      id: documentId,
      filename,
      summary,
      keyTopics,
      uploadedAt: new Date().toISOString(),
      accessCount: 0,
      lastAccessed: null
    });

    console.log(`📚 Saved document context for user: ${userId}, doc: ${filename}`);
  }

  // Get document context for user
  async getDocumentContext(userId, limit = 5) {
    const userDocs = this.documentContexts.get(userId);
    if (!userDocs) return [];

    return Array.from(userDocs.values())
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(0, limit);
  }

  // Semantic caching for similar queries
  async getCachedResponse(userId, query, similarityThreshold = 0.8) {
    const userCache = this.semanticCache.get(userId);
    if (!userCache) return null;

    for (const [cachedQuery, cachedResponse] of userCache) {
      const similarity = this.calculateRelevanceScore(query, cachedQuery);
      if (similarity >= similarityThreshold) {
        console.log(`🎯 Cache hit for user: ${userId}, similarity: ${similarity.toFixed(2)}`);
        return {
          response: cachedResponse.response,
          fromCache: true,
          similarity,
          originalQuery: cachedQuery
        };
      }
    }

    return null;
  }

  // Cache response for future similar queries
  async cacheResponse(userId, query, response, metadata = {}) {
    if (!this.semanticCache.has(userId)) {
      this.semanticCache.set(userId, new Map());
    }

    const userCache = this.semanticCache.get(userId);
    
    // Limit cache size per user
    if (userCache.size >= 20) {
      const firstKey = userCache.keys().next().value;
      userCache.delete(firstKey);
    }

    userCache.set(query, {
      response,
      metadata,
      cachedAt: new Date().toISOString()
    });
  }

  // Get user session statistics
  getUserStats(userId) {
    const conversations = this.conversationHistory.get(userId) || [];
    const documents = this.documentContexts.get(userId) || new Map();
    const cache = this.semanticCache.get(userId) || new Map();

    return {
      totalConversations: conversations.length,
      totalDocuments: documents.size,
      cacheEntries: cache.size,
      lastActivity: conversations.length > 0 ? conversations[conversations.length - 1].timestamp : null,
      documentsUploaded: Array.from(documents.values()).map(doc => ({
        filename: doc.filename,
        uploadedAt: doc.uploadedAt
      }))
    };
  }

  // Clear user context (for logout/reset)
  clearUserContext(userId) {
    this.conversationHistory.delete(userId);
    this.documentContexts.delete(userId);
    this.semanticCache.delete(userId);
    console.log(`🗑️ Cleared all context for user: ${userId}`);
  }

  // Get system statistics
  getSystemStats() {
    return {
      totalUsers: this.conversationHistory.size,
      totalConversations: Array.from(this.conversationHistory.values()).reduce((sum, convs) => sum + convs.length, 0),
      totalDocuments: Array.from(this.documentContexts.values()).reduce((sum, docs) => sum + docs.size, 0),
      memoryUsage: {
        conversations: this.conversationHistory.size,
        documents: this.documentContexts.size,
        cache: this.semanticCache.size
      }
    };
  }
}

// Export singleton instance
const contextMemoryService = new ContextMemoryService();

module.exports = {
  contextMemoryService,
  ContextMemoryService
};
