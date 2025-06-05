/**
 * Query Classification Service
 * Determines whether a query requires document search or can be answered directly
 */

class QueryClassifier {
  constructor() {
    // Keywords that typically indicate document-related queries
    this.documentKeywords = [
      'document', 'file', 'paper', 'pdf', 'content', 'extract', 'summarize', 'summary',
      'what does', 'according to', 'based on', 'mentioned in', 'described in',
      'find in', 'search for', 'look for', 'contains', 'includes',
      'chapter', 'section', 'page', 'paragraph', 'text', 'article',
      'explains', 'defines', 'states', 'says', 'discusses',
      'uploaded', 'upload', 'docs', 'read the', 'check if', 'have any',
      'resume', 'cv', 'report', 'attachment', 'attached'
    ];

    // Keywords that typically indicate general conversation
    this.generalKeywords = [
      'hello', 'hi', 'hey', 'how are you', 'thanks', 'thank you',
      'can you', 'do you know', 'tell me about', 'explain',
      'write', 'create', 'generate', 'make', 'build',
      'python', 'javascript', 'code', 'programming', 'algorithm',
      'math', 'calculate', 'solve', 'help me'
    ];

    // Question patterns that usually need documents
    this.documentPatterns = [
      /what (is|are|does|do) .+ (in|from) (the|this) (document|file|paper|text)/i,
      /according to (the|this) (document|file|paper|text)/i,
      /based on (the|this) (document|file|paper|text)/i,
      /find .+ in (the|this) (document|file|paper|text)/i,
      /summarize (the|this) (document|file|paper|text)/i,
      /what does (the|this) (document|file|paper|text) say about/i,
      /(can you|could you) (read|check|access|view) .+ (document|file|upload)/i,
      /(have|do) (i|you) (uploaded|have) .+ (document|file|docs)/i,
      /check if .+ (uploaded|docs|document|file)/i,
      /(read|view|access) .+ (document|upload|file|attachment)/i
    ];

    // Question patterns that are usually general
    this.generalPatterns = [
      /^(hi|hello|hey)/i,
      /(can you|could you) (write|create|generate|make|build)/i,
      /(explain|tell me about) (?!.*document)(?!.*file)/i,
      /(how to|how do i) (?!.*document)(?!.*file)/i,
      /write (a|an|some) (code|program|script|function)/i
    ];
  }

  /**
   * Classify a query to determine if it needs document context
   * @param {string} query - The user's query
   * @param {boolean} hasDocuments - Whether documents are available
   * @param {Array} recentContext - Recent conversation for context
   * @returns {Object} Classification result
   */
  classifyQuery(query, hasDocuments = false, recentContext = []) {
    const queryLower = query.toLowerCase().trim();
    
    // If no documents available, always classify as general
    if (!hasDocuments) {
      return {
        type: 'general',
        confidence: 1.0,
        reason: 'No documents available',
        useDocuments: false,
        needsRAG: false
      };
    }

    // Check for explicit document patterns first
    for (const pattern of this.documentPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'document',
          confidence: 0.9,
          reason: 'Explicit document reference pattern',
          useDocuments: true,
          needsRAG: true
        };
      }
    }

    // Check for explicit general patterns
    for (const pattern of this.generalPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'general',
          confidence: 0.8,
          reason: 'General conversation pattern',
          useDocuments: false,
          needsRAG: false
        };
      }
    }

    // Score based on keywords
    let documentScore = 0;
    let generalScore = 0;

    // Count document-related keywords
    for (const keyword of this.documentKeywords) {
      if (queryLower.includes(keyword)) {
        documentScore += this.getKeywordWeight(keyword);
      }
    }

    // Count general keywords
    for (const keyword of this.generalKeywords) {
      if (queryLower.includes(keyword)) {
        generalScore += this.getKeywordWeight(keyword);
      }
    }

    // Analyze query structure
    const structureAnalysis = this.analyzeQueryStructure(query);
    documentScore += structureAnalysis.documentScore;
    generalScore += structureAnalysis.generalScore;

    // Check recent context for document references
    const contextAnalysis = this.analyzeRecentContext(recentContext);
    if (contextAnalysis.recentDocumentDiscussion) {
      documentScore += 0.3;
    }

    // Make decision based on scores
    const totalScore = documentScore + generalScore;
    let confidence, type, useDocuments, needsRAG;

    if (totalScore === 0) {
      // Ambiguous query - use a hybrid approach
      return {
        type: 'hybrid',
        confidence: 0.5,
        reason: 'Ambiguous query - will try both approaches',
        useDocuments: true,
        needsRAG: true,
        fallbackToGeneral: true
      };
    }

    if (documentScore > generalScore) {
      confidence = Math.min(documentScore / totalScore, 0.95);
      type = 'document';
      useDocuments = true;
      needsRAG = true;
    } else {
      confidence = Math.min(generalScore / totalScore, 0.95);
      type = 'general';
      useDocuments = false;
      needsRAG = false;
    }

    return {
      type,
      confidence,
      reason: `Score-based: doc=${documentScore.toFixed(2)}, gen=${generalScore.toFixed(2)}`,
      useDocuments,
      needsRAG,
      scores: { documentScore, generalScore }
    };
  }

  /**
   * Get weight for specific keywords
   */
  getKeywordWeight(keyword) {
    const highWeightKeywords = ['document', 'summarize', 'according to', 'based on'];
    return highWeightKeywords.includes(keyword) ? 0.4 : 0.2;
  }

  /**
   * Analyze query structure for classification hints
   */
  analyzeQueryStructure(query) {
    let documentScore = 0;
    let generalScore = 0;

    // Questions asking for specific information (likely document-related)
    if (/^(what|where|when|who|how) (is|are|does|do|did)/.test(query.toLowerCase())) {
      documentScore += 0.2;
    }

    // Questions asking for creation/generation (likely general)
    if (/^(write|create|generate|make|build|code)/.test(query.toLowerCase())) {
      generalScore += 0.3;
    }

    // Questions with "can you" often general unless mentioning documents
    if (/^can you/.test(query.toLowerCase())) {
      if (!/document|file|paper/.test(query.toLowerCase())) {
        generalScore += 0.2;
      }
    }

    // Long, complex questions often need documents
    if (query.length > 100) {
      documentScore += 0.1;
    }

    // Short questions often general
    if (query.length < 20) {
      generalScore += 0.1;
    }

    return { documentScore, generalScore };
  }

  /**
   * Analyze recent conversation context
   */
  analyzeRecentContext(recentContext) {
    let recentDocumentDiscussion = false;

    if (recentContext && recentContext.length > 0) {
      const recentText = recentContext.slice(-3).join(' ').toLowerCase();
      if (/document|file|paper|content|extract|summarize/.test(recentText)) {
        recentDocumentDiscussion = true;
      }
    }

    return { recentDocumentDiscussion };
  }

  /**
   * Get a human-readable explanation of the classification
   */
  explainClassification(result) {
    const explanations = {
      'document': 'This query appears to be asking about document content and will use RAG search.',
      'general': 'This query seems to be general conversation and will use direct LLM response.',
      'hybrid': 'This query is ambiguous, so we\'ll try document search first, then fall back to general response.'
    };

    return explanations[result.type] || 'Unknown classification type.';
  }
}

module.exports = new QueryClassifier();
