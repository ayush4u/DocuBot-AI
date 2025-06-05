class AdvancedConversationContext {
  constructor() {
    this.chatContexts = new Map(); // chatId -> conversation context
    this.documentReferences = new Map(); // chatId -> document references tracking
    this.topicEvolution = new Map(); // chatId -> topic progression
    this.entityMemory = new Map(); // chatId -> entity tracking
    this.initialized = false;
  }

  // Initialize the advanced conversation context service
  async initialize() {
    console.log('🚀 Initializing Advanced Conversation Context...');
    this.initialized = true;
    console.log('✅ Advanced Conversation Context initialized');
  }

  // Enhanced chat context for multi-document conversations
  async saveConversationWithDocumentContext(chatId, userId, message, response, metadata = {}) {
    if (!this.chatContexts.has(chatId)) {
      this.chatContexts.set(chatId, {
        conversations: [],
        documentReferences: new Set(),
        topics: new Set(),
        entities: new Set(),
        patterns: []
      });
    }

    const chatContext = this.chatContexts.get(chatId);
    
    // Extract document references from the conversation
    const docRefs = this.extractDocumentReferences(message, response, metadata);
    docRefs.forEach(ref => chatContext.documentReferences.add(ref));

    // Extract topics and entities
    const topics = this.extractTopics(message + ' ' + response);
    const entities = this.extractEntitiesFromText(message + ' ' + response);
    
    topics.forEach(topic => chatContext.topics.add(topic));
    entities.forEach(entity => chatContext.entities.add(entity));

    // Save conversation with enhanced metadata
    const conversation = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      userMessage: message,
      botResponse: response,
      documentsReferenced: docRefs,
      topicsDiscussed: topics,
      entitiesFound: entities,
      queryType: metadata.queryType || 'general',
      chunksUsed: metadata.chunksRetrieved || 0,
      confidence: metadata.confidence || 0.5,
      metadata
    };

    chatContext.conversations.push(conversation);

    // Keep last 50 conversations per chat
    if (chatContext.conversations.length > 50) {
      chatContext.conversations.splice(0, chatContext.conversations.length - 50);
    }

    // Track conversation patterns
    this.trackConversationPatterns(chatId, conversation);

    console.log(`💬 Enhanced conversation context saved for chat ${chatId}`);
    console.log(`   - Documents referenced: ${docRefs.length}`);
    console.log(`   - Topics: ${topics.length}`);
    console.log(`   - Entities: ${entities.length}`);

    return conversation;
  }

  // Build advanced context for current query
  async buildAdvancedChatContext(chatId, currentQuery, options = {}) {
    const {
      maxTokens = 2000,
      includeDocumentRefs = true,
      includeTopicEvolution = true,
      prioritizeRecentDocuments = true,
      contextWindow = 10
    } = options;

    const chatContext = this.chatContexts.get(chatId);
    if (!chatContext || chatContext.conversations.length === 0) {
      return {
        conversationHistory: '',
        documentContext: '',
        topicContext: '',
        relevantConversations: [],
        contextMetadata: {
          conversationsUsed: 0,
          documentsReferenced: 0,
          topicsCovered: 0
        }
      };
    }

    // Analyze current query
    const queryAnalysis = this.analyzeQueryInContext(currentQuery, chatContext);

    // Only include conversation history if context dependency is medium or high
    let relevantConversations = [];
    if (queryAnalysis.contextDependency === 'high' || queryAnalysis.contextDependency === 'medium') {
      relevantConversations = this.selectRelevantConversations(
        chatContext.conversations,
        currentQuery,
        queryAnalysis,
        contextWindow
      );
    }

    // Build conversation history
    let conversationHistory = '';
    let tokenCount = 0;
    const usedConversations = [];

    for (const conv of relevantConversations) {
      const convText = `Human: ${conv.userMessage}\nAssistant: ${conv.botResponse}\n\n`;
      const convTokens = convText.length;
      
      if (tokenCount + convTokens <= maxTokens * 0.6) { // Reserve space for other context
        conversationHistory += convText;
        tokenCount += convTokens;
        usedConversations.push(conv);
      } else {
        break;
      }
    }

    // Build document context
    let documentContext = '';
    if (includeDocumentRefs) {
      documentContext = this.buildDocumentReferenceContext(chatContext, queryAnalysis);
    }

    // Build topic evolution context
    let topicContext = '';
    if (includeTopicEvolution) {
      topicContext = this.buildTopicEvolutionContext(chatContext, queryAnalysis);
    }

    return {
      conversationHistory,
      documentContext,
      topicContext,
      relevantConversations: usedConversations,
      contextMetadata: {
        conversationsUsed: usedConversations.length,
        documentsReferenced: Array.from(chatContext.documentReferences).length,
        topicsCovered: Array.from(chatContext.topics).length,
        queryAnalysis
      }
    };
  }

  // Analyze query in the context of chat history
  analyzeQueryInContext(query, chatContext) {
    const queryLower = query.toLowerCase();
    
    // Check for follow-up patterns
    const isFollowUp = this.detectFollowUpPattern(query, chatContext.conversations.slice(-3));
    
    // Check for comparison requests
    const isComparison = queryLower.match(/\b(compare|difference|versus|vs|between)\b/);
    
    // Check for reference to previous discussions
    const referencesPrevious = queryLower.match(/\b(you mentioned|earlier|before|previous|last time)\b/);
    
    // Check for document-specific queries
    const mentionsDocuments = Array.from(chatContext.documentReferences).some(doc =>
      queryLower.includes(doc.toLowerCase().replace(/\.(pdf|docx?|txt)$/i, ''))
    );

    // Determine context dependency - be more conservative
    let contextDependency = 'low';
    if (referencesPrevious) contextDependency = 'high';
    else if (isFollowUp || isComparison) contextDependency = 'medium';
    else if (mentionsDocuments) contextDependency = 'low'; // Changed from medium to low

    return {
      isFollowUp,
      isComparison,
      referencesPrevious,
      mentionsDocuments,
      contextDependency,
      suggestedScope: this.suggestQueryScope(query, chatContext)
    };
  }

  // Select most relevant conversations for context
  selectRelevantConversations(conversations, currentQuery, analysis, limit = 10) {
    if (conversations.length === 0) return [];

    // Score conversations based on multiple factors
    const scoredConversations = conversations.map((conv, index) => {
      let score = 0;

      // Recency score (more recent = higher) - reduced weight
      score += (index / conversations.length) * 0.2;

      // Semantic similarity score - increased weight for relevance
      const similarity = this.calculateSemanticSimilarity(currentQuery, conv.userMessage);
      score += similarity * 0.6;

      // Document reference overlap - only if query mentions documents
      if (analysis.mentionsDocuments) {
        score += this.calculateDocumentOverlap(currentQuery, conv.documentsReferenced) * 0.3;
      }

      // Follow-up bonus - only for very recent conversations
      if (analysis.isFollowUp && index >= conversations.length - 2) {
        score += 0.2;
      }

      // Query type consistency
      if (conv.queryType === analysis.suggestedScope) {
        score += 0.1;
      }

      // Penalty for low similarity
      if (similarity < 0.3) {
        score -= 0.5;
      }

      return { ...conv, relevanceScore: score };
    });

    // Filter out low-relevance conversations and sort by relevance
    const relevantConversations = scoredConversations
      .filter(conv => conv.relevanceScore > 0.4) // Only include conversations with score > 0.4
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, Math.min(limit, 3)); // Limit to maximum 3 most relevant conversations

    console.log(`Selected ${relevantConversations.length} relevant conversations out of ${conversations.length} total`);
    
    return relevantConversations;
  }

  // Build document reference context
  buildDocumentReferenceContext(chatContext, analysis) {
    const docRefs = Array.from(chatContext.documentReferences);
    if (docRefs.length === 0) return '';

    let context = 'DOCUMENT CONTEXT FROM CONVERSATION HISTORY:\n';
    context += `You have been discussing ${docRefs.length} document(s): ${docRefs.join(', ')}\n`;
    
    if (analysis.mentionsDocuments) {
      context += 'This query specifically references these documents.\n';
    }
    
    context += '\n';
    return context;
  }

  // Build topic evolution context
  buildTopicEvolutionContext(chatContext, analysis) {
    const topics = Array.from(chatContext.topics).slice(0, 10);
    if (topics.length === 0) return '';

    let context = 'CONVERSATION TOPICS COVERED:\n';
    context += `Previous discussion topics: ${topics.join(', ')}\n`;
    
    if (analysis.isFollowUp) {
      context += 'This appears to be a follow-up question about previous topics.\n';
    }
    
    context += '\n';
    return context;
  }

  // Extract document references from conversation
  extractDocumentReferences(message, response, metadata) {
    const refs = new Set();
    
    // From metadata
    if (metadata.relevantChunks) {
      metadata.relevantChunks.forEach(chunk => {
        if (chunk.metadata && chunk.metadata.filename) {
          refs.add(chunk.metadata.filename);
        }
      });
    }

    // From text analysis
    const text = (message + ' ' + response).toLowerCase();
    const docPatterns = [
      /\b(\w+\.pdf)\b/g,
      /\b(\w+\.docx?)\b/g,
      /\b(\w+\.txt)\b/g,
      /\b(resume|cv|document|file)\b/g
    ];

    docPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => refs.add(match));
      }
    });

    return Array.from(refs);
  }

  // Extract topics from text
  extractTopics(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4);

    const topicWords = words.filter(word => 
      !this.isStopWord(word) && 
      !this.isCommonWord(word)
    );

    return [...new Set(topicWords)].slice(0, 5);
  }

  // Extract entities from text
  extractEntitiesFromText(text) {
    const entities = new Set();
    
    // Simple patterns for common entities
    const patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
      skill: /\b(javascript|python|java|react|node|sql|aws|azure)\b/gi
    };

    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => entities.add(`${type}:${match}`));
    });

    return Array.from(entities);
  }

  // Track conversation patterns
  trackConversationPatterns(chatId, conversation) {
    if (!this.topicEvolution.has(chatId)) {
      this.topicEvolution.set(chatId, []);
    }

    const evolution = this.topicEvolution.get(chatId);
    evolution.push({
      timestamp: conversation.timestamp,
      topics: conversation.topicsDiscussed,
      queryType: conversation.queryType,
      documentsUsed: conversation.documentsReferenced.length
    });

    // Keep last 20 entries
    if (evolution.length > 20) {
      evolution.splice(0, evolution.length - 20);
    }
  }

  // Detect follow-up patterns
  detectFollowUpPattern(query, recentConversations) {
    if (recentConversations.length === 0) return false;

    const queryLower = query.toLowerCase();
    const lastConv = recentConversations[recentConversations.length - 1];
    
    // Check for direct references
    if (queryLower.match(/\b(also|too|and|additionally|furthermore)\b/)) return true;
    if (queryLower.match(/\b(what about|how about|tell me more)\b/)) return true;
    
    // Check for pronoun references
    if (queryLower.match(/\b(it|they|them|this|that|those)\b/)) return true;
    
    // Check for topic continuity
    const lastTopics = lastConv.topicsDiscussed || [];
    const currentTopics = this.extractTopics(query);
    const topicOverlap = currentTopics.filter(topic => lastTopics.includes(topic));
    
    return topicOverlap.length > 0;
  }

  // Calculate semantic similarity (simple implementation)
  calculateSemanticSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  // Calculate document overlap
  calculateDocumentOverlap(query, documentRefs) {
    if (!documentRefs || documentRefs.length === 0) return 0;
    
    const queryLower = query.toLowerCase();
    const mentioned = documentRefs.filter(doc => 
      queryLower.includes(doc.toLowerCase().replace(/\.(pdf|docx?|txt)$/i, ''))
    );
    
    return mentioned.length / documentRefs.length;
  }

  // Suggest query scope
  suggestQueryScope(query, chatContext) {
    const queryLower = query.toLowerCase();
    
    if (queryLower.match(/\b(compare|difference|versus)\b/)) return 'comparison';
    if (queryLower.match(/\b(summarize|summary|overview)\b/)) return 'summary';
    if (queryLower.match(/\b(skills|experience|education)\b/)) return 'extraction';
    if (queryLower.match(/\b(find|search|look for)\b/)) return 'search';
    if (Array.from(chatContext.documentReferences).length > 1) return 'multi-document';
    
    return 'general';
  }

  // Helper methods
  isStopWord(word) {
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'have'];
    return stopWords.includes(word.toLowerCase());
  }

  isCommonWord(word) {
    const commonWords = ['that', 'this', 'with', 'from', 'they', 'been', 'said', 'each', 'which', 'would', 'there'];
    return commonWords.includes(word.toLowerCase());
  }

  // Get chat statistics
  getChatStatistics(chatId) {
    const chatContext = this.chatContexts.get(chatId);
    if (!chatContext) return null;

    return {
      totalConversations: chatContext.conversations.length,
      documentsDiscussed: Array.from(chatContext.documentReferences).length,
      topicsCovered: Array.from(chatContext.topics).length,
      entitiesFound: Array.from(chatContext.entities).length,
      averageQueryLength: chatContext.conversations.reduce((sum, conv) => 
        sum + conv.userMessage.length, 0) / chatContext.conversations.length,
      queryTypes: this.getQueryTypeDistribution(chatContext.conversations)
    };
  }

  getQueryTypeDistribution(conversations) {
    const types = {};
    conversations.forEach(conv => {
      const type = conv.queryType || 'general';
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  // Clear chat context
  clearChatContext(chatId) {
    this.chatContexts.delete(chatId);
    this.documentReferences.delete(chatId);
    this.topicEvolution.delete(chatId);
    this.entityMemory.delete(chatId);
    console.log(`🗑️ Chat context cleared for chat ${chatId}`);
  }
}

// Export singleton
const advancedConversationContext = new AdvancedConversationContext();
module.exports = { advancedConversationContext, AdvancedConversationContext };
