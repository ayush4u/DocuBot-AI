const express = require('express');
const router = express.Router();
const multer = require('multer');
const { enhancedRAGService } = require('../services/enhancedRAGService');
const { advancedRAGService } = require('../services/advancedRAGService');
const { contextMemoryService } = require('../services/contextMemoryService');
const documentParser = require('../services/documentParser');
const { optionalAuth } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Accept various document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
      'application/json',
      'application/x-yaml',
      'text/yaml',
      'text/x-yaml'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`), false);
    }
  }
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 50MB per file.' 
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Too many files. Maximum 10 files allowed.' 
      });
    }
  }
  
  if (error.message.includes('File type')) {
    return res.status(400).json({ 
      error: error.message 
    });
  }
  
  next(error);
};

// Apply error handling middleware
router.use(handleMulterError);

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Send a message and get AI response using RAG
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's message/question
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Optional files to upload and process
 *     responses:
 *       200:
 *         description: AI response with RAG context
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 relevantChunks:
 *                   type: array
 *                 metadata:
 *                   type: object
 *       400:
 *         description: Invalid request
 */
router.post('/', optionalAuth, (req, res, next) => {
  // Check if this is a multipart request
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // Use multer for multipart data
    upload.array('files', 10)(req, res, next);
  } else {
    // For JSON requests, parse the body manually
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        req.body = JSON.parse(body);
        next();
      } catch (error) {
        res.status(400).json({ error: 'Invalid JSON' });
      }
    });
  }
}, handleMulterError, async (req, res) => {
  try {
    // Get user ID from JWT token if authenticated, otherwise use anonymous
    let userId = req.user?.userId || req.user?.email || 'anonymous';
    console.log(`👤 Chat request from userId: ${userId}, authenticated: ${!!req.user}`);
    
    // Get chatId from request body, or create a new one
    let chatId = req.body.chatId;
    let isNewChat = false;
    if (!chatId) {
      // Create a new chat session if no chatId provided
      chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      isNewChat = true;
      console.log(`🆕 Created new chat session: ${chatId}`);
    } else {
      console.log(`📝 Continuing chat session: ${chatId}`);
    }
    
    // For authenticated users, create/update chat session in database
    if (req.user && req.user.userId && req.user.userId !== 'anonymous') {
      console.log(`👤 Processing chat for authenticated user: ${req.user.userId}`);
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          console.error('❌ Supabase credentials not found');
          return;
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        if (isNewChat) {
          console.log(`📝 Creating new chat in database for user: ${req.user.userId}`);
          // Create new chat in Supabase
          const { data: newChat, error } = await supabase
            .from('chats')
            .insert([
              {
                title: `Chat ${new Date().toLocaleDateString()}`,
                user_id: req.user.userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ])
            .select()
            .single();
            
          if (error) {
            console.error('❌ Error creating chat session:', error);
          } else {
            console.log(`✅ Created chat session in database: ${newChat.id}`);
            // Update the chatId to use the database-generated UUID
            chatId = newChat.id;
          }
        } else {
          console.log(`📝 Updating existing chat: ${chatId}`);
          // Update existing chat's updated_at timestamp
          const { error } = await supabase
            .from('chats')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', chatId)
            .eq('user_id', req.user.userId);
            
          if (error) {
            console.error('❌ Error updating chat session:', error);
          } else {
            console.log(`✅ Updated chat session: ${chatId}`);
          }
        }
      } catch (error) {
        console.error('❌ Error managing chat session:', error);
      }
    } else {
      console.log(`⚠️ Not creating chat session - user not authenticated or anonymous`);
    }
    
    // For anonymous users, use a consistent chat ID to maintain conversation context
    if (userId === 'anonymous') {
      // Use a fixed chat ID for anonymous users to maintain document context
      userId = `${userId}_default`;
    } else {
      // For authenticated users, use the specific chat ID
      userId = `${userId}_${chatId}`;
    }

    // Check anonymous user limits
    if (userId.startsWith('anonymous_')) {
      // Check conversation limit (3 conversations max)
      const chatId = userId.split('_')[1] || 'default';
      try {
        const { chatHistoryService } = require('../services/chatHistory');
        const history = await chatHistoryService.getHistory(userId, 10);
        
        if (history.length >= 3) {
          return res.status(429).json({ 
            error: 'Anonymous users are limited to 3 conversations. Please sign in to continue chatting.',
            limitExceeded: true,
            type: 'conversation_limit'
          });
        }
      } catch (error) {
        console.log('⚠️ Could not check conversation history for limits:', error.message);
      }

      // Check document upload limit (2 documents max)
      if (req.files && req.files.length > 0) {
        try {
          const { getDocuments } = require('../config/database');
          const existingDocs = await getDocuments(userId);
          
          if (existingDocs.length + req.files.length > 2) {
            return res.status(429).json({ 
              error: 'Anonymous users can upload maximum 2 documents. Please sign in to upload more.',
              limitExceeded: true,
              type: 'upload_limit',
              currentCount: existingDocs.length,
              attempting: req.files.length
            });
          }
        } catch (error) {
          console.log('⚠️ Could not check document count for limits:', error.message);
        }
      }
    }
    
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Message is required and cannot be empty' 
      });
    }

    console.log(`💬 Advanced RAG Chat Query from ${userId}: "${message}"`);
    console.log(`📎 Files uploaded: ${req.files ? req.files.length : 0}`);

    // Process any uploaded files first
    let fileProcessingResults = [];
    if (req.files && req.files.length > 0) {
      console.log('📄 Processing uploaded files...');
      for (const file of req.files) {
        try {
          console.log(`  📄 Processing: ${file.originalname} (${file.size} bytes)`);

          // Parse document content based on file type using buffer
          const parsedContent = await documentParser.parseBuffer(file.buffer, file.mimetype, file.originalname);

          if (!parsedContent || !parsedContent.text) {
            throw new Error('Failed to extract text from document');
          }

          const result = await advancedRAGService.processDocument(parsedContent.text, file.originalname, userId);
          fileProcessingResults.push({
            filename: file.originalname,
            size: file.size,
            status: 'processed',
            chunks: result.chunksCreated || 0,
            pages: parsedContent.pages || 1
          });
        } catch (error) {
          console.error(`❌ Error processing ${file.originalname}:`, error.message);
          fileProcessingResults.push({
            filename: file.originalname,
            size: file.size,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    // Process query using Advanced RAG system with multi-document support
    const result = await advancedRAGService.processQuery(message, userId, {
      maxResults: 10,
      includeHistory: true,
      temperature: 0.7,
      maxTokens: 500, // Reduced from 1024 to 500 for more concise responses
      useCache: true,
      crossDocumentSearch: true,
      rerankResults: true
    });

    // Enhanced response with detailed multi-document metadata
    const response = {
      response: result.response,
      conversationId: result.conversationId,
      chatId: chatId, // Include the chat session ID

      // File processing results
      files: fileProcessingResults,

      // Advanced RAG Context Information
      context: {
        documentsAnalyzed: result.metadata.documentsAnalyzed || 0,
        chunksRetrieved: result.metadata.chunksRetrieved || 0,
        queryType: result.metadata.queryType || 'general',
        confidence: result.metadata.confidence || 0.5,
        relevantChunks: result.relevantChunks.map(chunk => ({
          filename: chunk.metadata.filename,
          score: Math.round(chunk.score * 100) / 100,
          strategy: chunk.retrievalStrategy || 'unknown',
          preview: chunk.text.substring(0, 150) + '...'
        })),
        retrievalStrategy: result.metadata.retrievalStrategy
      },

      // System Information
      system: {
        model: result.metadata.model || 'advanced-rag',
        ragVersion: 'advanced-multi-document',
        fallback: result.metadata.hasError || false,
        processingTime: new Date().toISOString(),
        fromCache: result.fromCache || false
      }
    };

    console.log(`✅ Advanced RAG Response generated:`);
    console.log(`   - Documents analyzed: ${result.metadata.documentsAnalyzed || 0}`);
    console.log(`   - Chunks retrieved: ${result.metadata.chunksRetrieved || 0}`);
    console.log(`   - Query type: ${result.metadata.queryType || 'general'}`);
    console.log(`   - Model used: ${result.metadata.model}`);
    console.log(`   - Retrieval strategy: ${result.metadata.retrievalStrategy}`);

    // Save chat message to history for authenticated users
    if (req.user && req.user.userId && req.user.userId !== 'anonymous') {
      try {
        const { chatHistoryService } = require('../services/chatHistory');
        console.log(`💾 Saving chat for user: ${req.user.userId}`);
        await chatHistoryService.saveChat(
          req.user.userId,
          message,
          result.response,
          {
            conversationId: result.conversationId,
            documentsAnalyzed: result.metadata.documentsAnalyzed || 0,
            chunksRetrieved: result.metadata.chunksRetrieved || 0,
            queryType: result.metadata.queryType || 'general',
            model: result.metadata.model || 'advanced-rag',
            chatId: chatId // Add chatId to metadata
          }
        );
        console.log(`✅ Chat saved successfully for user: ${req.user.userId}`);
      } catch (historyError) {
        console.error('❌ Failed to save chat history:', historyError.message);
        // Don't fail the request if history saving fails
      }
    } else {
      console.log(`⚠️ Not saving chat - user not authenticated or anonymous. User:`, req.user);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Chat processing error:', error);
    
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      system: {
        ragEnabled: false,
        fallback: true,
        error: true
      }
    });
  }
});

// Additional RAG endpoints for learning and debugging

/**
 * @swagger
 * /chat/search:
 *   post:
 *     summary: Search documents using vector similarity
 *     tags: [Chat]
 */
router.post('/search', async (req, res) => {
  try {
    const { query, maxResults = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await ragService.searchDocuments(query, { maxResults });
    
    res.json({
      query,
      results: results.documents,
      totalResults: results.totalResults,
      searchPerformed: results.searchPerformed
    });

  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * @swagger
 * /chat/history:
 *   get:
 *     summary: Get chat history for a user
 *     tags: [Chat]
 */
router.get('/history', async (req, res) => {
  try {
    const { userId = 'anonymous', limit = 20 } = req.query;
    
    const { chatHistoryService } = require('../services/chatHistory');
    const history = await chatHistoryService.getHistory(userId, parseInt(limit));
    
    res.json({
      userId,
      totalMessages: history.length,
      history: history.map(chat => ({
        id: chat.id,
        userMessage: chat.userMessage,
        aiResponse: chat.aiResponse,
        timestamp: chat.timestamp,
        metadata: chat.metadata
      }))
    });

  } catch (error) {
    console.error('❌ History retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
});

/**
 * @swagger
 * /chat/stats:
 *   get:
 *     summary: Get RAG system statistics
 *     tags: [Chat]
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await ragService.getSystemStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

module.exports = router;
