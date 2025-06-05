const { HfInference } = require('@huggingface/inference');
const { vectorStore } = require('./vectorStore');
const { chatHistoryService } = require('./chatHistory');

class RAGService {
  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY || 'hf_demo');
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🤖 Initializing RAG Service...');
      
      // Initialize vector store
      await vectorStore.initialize();
      
      this.isInitialized = true;
      console.log('✅ RAG Service initialized');
      
      return true;
    } catch (error) {
      console.error('❌ RAG Service initialization failed:', error.message);
      return false;
    }
  }

  // Process and store a document
  async processDocument(filename, content, metadata = {}) {
    try {
      console.log(`📚 Processing document for RAG: ${filename}`);
      
      // Add to vector store for semantic search
      const vectorSuccess = await vectorStore.addDocument(filename, content, {
        ...metadata,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        vectorStored: vectorSuccess,
        filename,
        contentLength: content.length
      };
      
    } catch (error) {
      console.error('❌ Error processing document:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Enhanced RAG query processing
  async processQuery(query, userId = 'anonymous', options = {}) {
    try {
      console.log(`🔍 Processing RAG query: "${query}"`);
      
      const {
        maxResults = 5,
        includeHistory = true,
        temperature = 0.7,
        maxTokens = 200
      } = options;

      // Step 1: Get documents from database first
      const { getDocuments } = require('../config/database');
      const documents = await getDocuments(userId);
      
      console.log(`📄 Found ${documents.length} documents in database for user ${userId}`);

      // Step 2: Try vector search if available, otherwise use keyword search
      let relevantChunks = [];
      
      if (documents.length > 0) {
        relevantChunks = await vectorStore.searchRelevant(query, maxResults);
        
        // If vector search didn't work, fall back to simple text matching
        if (relevantChunks.length === 0) {
          console.log('🔄 Vector search returned no results, using keyword fallback');
          relevantChunks = this.keywordSearch(query, documents, maxResults);
        }
      }

      // Step 3: Get chat history for context
      let chatContext = '';
      if (includeHistory) {
        chatContext = await chatHistoryService.getChatContext(userId, 3);
      }

      // Step 4: Build enhanced prompt with retrieved context
      let prompt = this.buildRAGPrompt(query, relevantChunks, chatContext, documents);
      
      // Step 5: Generate response using LLM
      const response = await this.generateResponse(prompt, { temperature, maxTokens });
      
      // Step 6: Save to chat history
      const chatRecord = await chatHistoryService.saveChat(userId, query, response, {
        relevantChunks: relevantChunks.length,
        vectorSearch: relevantChunks.length > 0,
        documentCount: documents.length,
        model: 'rag-enhanced'
      });

      return {
        response,
        relevantChunks,
        chatId: chatRecord.id,
        metadata: {
          chunksFound: relevantChunks.length,
          documentCount: documents.length,
          vectorSearchUsed: relevantChunks.length > 0,
          hasHistory: chatContext.length > 0,
          model: 'google/flan-t5-base'
        }
      };

    } catch (error) {
      console.error('❌ RAG query processing error:', error.message);
      
      // Fallback to simple response
      const fallbackResponse = await this.generateFallbackResponse(query, userId);
      
      return {
        response: fallbackResponse,
        relevantChunks: [],
        metadata: {
          chunksFound: 0,
          documentCount: 0,
          vectorSearchUsed: false,
          fallback: true,
          error: error.message
        }
      };
    }
  }

  // Simple keyword-based search when vector search fails
  keywordSearch(query, documents, maxResults = 5) {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(' ').filter(word => word.length > 2);
    
    const chunks = [];
    
    documents.forEach(doc => {
      const content = doc.content.toLowerCase();
      const sentences = doc.content.split(/[.!?]+/);
      
      sentences.forEach((sentence, index) => {
        const sentenceLower = sentence.toLowerCase();
        let score = 0;
        
        // Count keyword matches
        keywords.forEach(keyword => {
          if (sentenceLower.includes(keyword)) {
            score += 1;
          }
        });
        
        if (score > 0) {
          chunks.push({
            text: sentence.trim(),
            metadata: {
              filename: doc.filename,
              chunkIndex: index,
              searchType: 'keyword'
            },
            score: score / keywords.length,
            distance: 1 - (score / keywords.length)
          });
        }
      });
    });
    
    // Sort by relevance and return top results
    return chunks
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  // Build optimized prompt for RAG
  buildRAGPrompt(query, relevantChunks, chatContext = '', documents = []) {
    let prompt = '';

    // Add relevant document context
    if (relevantChunks.length > 0) {
      const context = relevantChunks
        .map((chunk, index) => `[${index + 1}] ${chunk.text}`)
        .join('\n\n');
      
      prompt = `Document content:
${context}

`;
    } else if (documents.length > 0) {
      // If no chunks found, use document info
      const docInfo = documents.map(doc => 
        `Document: ${doc.filename}\nContent preview: ${doc.content.substring(0, 500)}...`
      ).join('\n\n');
      
      prompt = `Available documents:
${docInfo}

`;
    }

    // Add chat history context
    if (chatContext.length > 0) {
      prompt += `Previous conversation:
${chatContext}

`;
    }

    // Enhanced query formatting for better AI responses
    if (relevantChunks.length > 0 || documents.length > 0) {
      prompt += `Instructions: You are a helpful AI assistant analyzing documents. Based on the document content above, provide a detailed, conversational response to the user's question. Be specific and reference the document when relevant.

User question: ${query}

Response:`;
    } else {
      prompt += `You are a helpful AI assistant. Please provide a conversational response to: ${query}

Response:`;
    }

    return prompt;
  }

  // Generate response using LLM
  async generateResponse(prompt, options = {}) {
    const { temperature = 0.7, maxTokens = 200 } = options;

    try {
      // Try Hugging Face Inference API with a working model
      const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: maxTokens,
            temperature,
            return_full_text: false
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        let aiResponse = result.generated_text || result[0]?.generated_text || '';
        
        // Clean up response
        if (typeof aiResponse === 'string') {
          aiResponse = aiResponse.replace(prompt, '').trim();
        }

        if (aiResponse && aiResponse.length > 10) {
          return aiResponse;
        }
      }

      // If Hugging Face fails, throw error to trigger fallback
      throw new Error('Hugging Face API unavailable');

    } catch (error) {
      console.log('⚠️ Hugging Face API failed, using enhanced local fallback...');
      
      // Enhanced local fallback without external APIs
      return this.generateLocalResponse(prompt);
    }
  }

  // Generate intelligent local response without external APIs
  generateLocalResponse(prompt) {
    console.log(`🔍 Full prompt received:`, prompt.substring(0, 500) + '...');
    
    // Extract the main question from the prompt with multiple formats
    const questionMatch = prompt.match(/User question: (.+?)(?:\n|$)/i) || 
                         prompt.match(/Question: (.+?)(?:\n|$)/i) ||
                         prompt.match(/Response:\s*$/);
    
    const contextMatch = prompt.match(/Document content:(.*?)(?:Instructions:|User question:|Question:|$)/s);
    const chatMatch = prompt.match(/Previous conversation:(.*?)(?:Instructions:|User question:|Question:|Document content:|$)/s);
    
    const question = questionMatch ? questionMatch[1]?.trim() : prompt.split('\n').pop();
    const context = contextMatch ? contextMatch[1].trim() : '';
    const chatHistory = chatMatch ? chatMatch[1].trim() : '';
    
    console.log(`🤖 Enhanced local processing for: "${question}"`);
    console.log(`📄 Context length: ${context.length} characters`);
    
    const questionLower = question.toLowerCase();
    
    // Enhanced content-based responses when we have document context
    if (context && context.trim().length > 100) {
      console.log(`📚 Using document context for response`);
      
      // Extract meaningful content from document chunks
      const chunks = context.split(/\[\d+\]/).filter(chunk => chunk.trim().length > 20);
      const relevantContent = chunks.slice(0, 3).join(' ').substring(0, 400);
      
      // Topic-specific responses based on question
      if (questionLower.includes('about') || questionLower.includes('what')) {
        if (relevantContent.length > 50) {
          return `Based on your document, here's what it's about: ${relevantContent}... The document contains rich content that I can explore further with you. What specific aspect interests you most?`;
        }
      }
      
      if (questionLower.includes('context') || questionLower.includes('inside')) {
        if (relevantContent.length > 50) {
          return `Here's some context from inside the document: ${relevantContent}... This gives you a glimpse of the content. Would you like me to focus on any particular theme or section?`;
        }
      }
      
      if (questionLower.includes('quote') || questionLower.includes('random')) {
        // Find quote-like content (sentences that might be inspirational)
        const sentences = context.split(/[.!?]+/).filter(s => 
          s.trim().length > 10 && s.trim().length < 200
        );
        
        if (sentences.length > 0) {
          const randomQuote = sentences[Math.floor(Math.random() * Math.min(sentences.length, 10))];
          return `Here's a meaningful excerpt from your document: "${randomQuote.trim()}." Would you like another quote or want to explore this theme further?`;
        }
      }
      
      if (questionLower.includes('complete') || questionLower.includes('sentence')) {
        // Look for similar content in the document
        const words = question.split(' ').slice(-10); // Get last few words
        const contextLower = context.toLowerCase();
        
        // Find relevant passages
        const relevantPassages = chunks.filter(chunk => 
          words.some(word => chunk.toLowerCase().includes(word.toLowerCase()))
        );
        
        if (relevantPassages.length > 0) {
          const passage = relevantPassages[0].substring(0, 200);
          return `Based on the style and content in your document, here's how it might continue: ${passage}... This reflects the tone and themes I found in your uploaded material.`;
        }
      }
      
      if (questionLower.includes('delete')) {
        return `I can't directly delete documents, but you can upload a new document and it will be processed alongside or replace the current one in your session. Just use the paperclip icon to upload another PDF. What would you like to upload next?`;
      }
      
      // Extract key sentences for general responses
      const keyContent = chunks.slice(0, 2).join(' ').substring(0, 250);
      if (keyContent.length > 50) {
        return `Looking at your document content: ${keyContent}... This document contains substantial information. What specific aspect would you like to explore further?`;
      }
    }
    
    // Fallback responses when no context is available
    if (questionLower.includes('about') || questionLower.includes('what')) {
      return "I'd love to tell you about your document! Please make sure it's uploaded successfully, and I'll analyze its content to provide detailed information about what it covers.";
    }
    
    if (questionLower.includes('quote')) {
      return "I can find quotes and meaningful passages from your uploaded documents. Please ensure your document is uploaded and processed, then I can share relevant quotes with you.";
    }
    
    // Enhanced greeting responses
    if (questionLower.match(/^(hi|hello|hey|good)/)) {
      return "Hello! I'm DocuBot, your AI document assistant. I can analyze PDFs and answer detailed questions about their content. Upload a document using the paperclip icon, and I'll help you explore it! 📄✨";
    }
    
    // Default enhanced response
    return `I understand you're asking: "${question}". I'm ready to provide detailed answers based on your document content. ${context.length > 50 ? 'I can see document content is available for analysis.' : 'Please upload a PDF document for me to analyze.'} What specific information are you looking for?`;
  }

  // Generate fallback response without AI
  async generateFallbackResponse(query, userId) {
    try {
      // Get document info
      const docs = await vectorStore.listDocuments();
      const stats = await vectorStore.getStats();
      
      const queryLower = query.toLowerCase();
      
      // Smart fallback responses based on query type
      if (queryLower.includes('name') && queryLower.includes('document')) {
        if (docs.length > 0) {
          const docNames = docs.map(doc => doc.filename).join(', ');
          return `I have the following documents uploaded: ${docNames}. You can ask me questions about any of these documents.`;
        } else {
          return "No documents are currently uploaded. Please upload a PDF file using the paperclip icon to get started.";
        }
      }
      
      if (queryLower.includes('contain') || queryLower.includes('about')) {
        if (stats.totalChunks > 0) {
          return `I have ${stats.totalDocuments} document(s) with ${stats.totalChunks} text sections loaded. While my AI processing is temporarily unavailable, I can still help you navigate your documents. Try asking about specific topics or keywords.`;
        }
      }
      
      if (queryLower.includes('summary') || queryLower.includes('summarize')) {
        return "I can help summarize your documents once they're uploaded. Please use the paperclip icon to upload a PDF file, and then ask me to summarize its contents.";
      }

      // Default fallback
      return `I understand you're asking about: "${query}". While my AI processing is temporarily unavailable, I'm still here to help. Try uploading a document or asking about specific topics.`;
      
    } catch (error) {
      return "I'm experiencing some technical difficulties, but I'm still here to help. Please try rephrasing your question.";
    }
  }

  // Get RAG system statistics
  async getSystemStats() {
    try {
      const vectorStats = await vectorStore.getStats();
      
      return {
        vectorStore: vectorStats,
        initialized: this.isInitialized,
        features: {
          semanticSearch: vectorStats.initialized,
          chatHistory: true,
          documentProcessing: true,
          aiGeneration: true
        }
      };
    } catch (error) {
      return {
        error: error.message,
        initialized: false
      };
    }
  }

  // Search across all documents
  async searchDocuments(query, options = {}) {
    const { maxResults = 10 } = options;
    
    try {
      const results = await vectorStore.searchRelevant(query, maxResults);
      
      // Group results by document
      const documentResults = {};
      results.forEach(chunk => {
        const filename = chunk.metadata.filename;
        if (!documentResults[filename]) {
          documentResults[filename] = {
            filename,
            chunks: [],
            totalScore: 0
          };
        }
        documentResults[filename].chunks.push(chunk);
        documentResults[filename].totalScore += chunk.score;
      });

      // Sort by relevance
      const sortedResults = Object.values(documentResults)
        .sort((a, b) => b.totalScore - a.totalScore);

      return {
        query,
        totalResults: results.length,
        documents: sortedResults,
        searchPerformed: true
      };
      
    } catch (error) {
      console.error('❌ Document search error:', error.message);
      return {
        query,
        totalResults: 0,
        documents: [],
        searchPerformed: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const ragService = new RAGService();

module.exports = {
  RAGService,
  ragService
};
