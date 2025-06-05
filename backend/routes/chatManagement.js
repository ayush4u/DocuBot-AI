const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { enhancedRAGService } = require('../services/enhancedRAGService');
const { advancedRAGService } = require('../services/advancedRAGService');
const { freeLLMService } = require('../services/freeLLMService');
const queryClassifier = require('../services/queryClassifier');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Legacy in-memory storage (kept for backward compatibility during migration)
const userChats = new Map(); // userId -> [chatId1, chatId2, ...]
const chatData = new Map(); // chatId -> { id, name, userId, createdAt, documents: [], messages: [] }
const chatDocuments = new Map(); // chatId -> [documentId1, documentId2, ...]

/**
 * @swagger
 * components:
 *   schemas:
 *     Chat:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique chat identifier
 *         name:
 *           type: string
 *           description: Chat name/title
 *         userId:
 *           type: string
 *           description: Owner user ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         documentCount:
 *           type: integer
 *           description: Number of documents uploaded to this chat
 *         messageCount:
 *           type: integer
 *           description: Number of messages in this chat
 *         hasDocuments:
 *           type: boolean
 *           description: Whether this chat has document context
 */

/**
 * @swagger
 * /chats:
 *   post:
 *     summary: Create a new chat conversation
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Chat name/title
 *                 example: "My Research Chat"
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: Chat created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chat'
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Chat name is required' });
    }

    // Create new chat in Supabase (let Supabase generate the UUID)
    const { data: newChat, error } = await supabase
      .from('chats')
      .insert([
        {
          title: name.trim(),  // Use 'title' instead of 'name' to match DB schema
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating chat:', error);
      return res.status(500).json({ error: 'Failed to create chat' });
    }

    console.log(`✅ Created new chat: ${newChat.id} for user: ${userId}`);

    res.status(201).json({
      id: newChat.id,
      name: newChat.title,  // Return as 'name' for API consistency
      userId: newChat.user_id,
      createdAt: newChat.created_at,
      updatedAt: newChat.updated_at,
      messageCount: 0
    });

  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

/**
 * @swagger
 * /chats:
 *   get:
 *     summary: Get all chats for the authenticated user
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's chats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chats:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Chat'
 *                 total:
 *                   type: integer
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(`📋 Getting chats for user: ${userId}`);

    // Get chats from Supabase with message count
    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        id,
        title,
        user_id,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching chats:', error);
      return res.status(500).json({ error: 'Failed to retrieve chats' });
    }

    // Get message counts for each chat
    const chatsWithCounts = await Promise.all(
      (chats || []).map(async (chat) => {
        const { count, error: countError } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chat.id);

        return {
          ...chat,
          messageCount: countError ? 0 : (count || 0)
        };
      })
    );

    console.log(`📋 Found ${chatsWithCounts?.length || 0} chats for user ${userId}`);
    if (chatsWithCounts && chatsWithCounts.length > 0) {
      console.log('📋 Chat IDs:', chatsWithCounts.map(c => c.id));
    }

    // Format the response
    const formattedChats = chatsWithCounts.map(chat => ({
      id: chat.id,
      name: chat.title,  // Return as 'name' for API consistency
      userId: chat.user_id,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      messageCount: chat.messageCount
    }));

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    console.log(`📋 Returning ${formattedChats.length} formatted chats`);
    res.json({
      chats: formattedChats,
      total: formattedChats.length
    });

  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to retrieve chats' });
  }
});

/**
 * @swagger
 * /chats/{chatId}:
 *   get:
 *     summary: Get specific chat details with messages
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Chat details with messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chat:
 *                   $ref: '#/components/schemas/Chat'
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       message:
 *                         type: string
 *                       response:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       hasDocumentContext:
 *                         type: boolean
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       filename:
 *                         type: string
 *                       uploadedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Chat not found
 */
router.get('/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Get chat details
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get all messages for this chat, ordered by creation time
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    // Get documents for this chat
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, filename, original_name, file_size, pages, uploaded_at')
      .eq('chat_id', chatId);

    // Format conversation for ChatGPT-like structure
    const conversation = [];
    messages.forEach(msg => {
      // Handle messages that have both user_message and ai_response (legacy format)
      if (msg.user_message && msg.ai_response) {
        // This is a complete message pair - add both user and assistant messages
        conversation.push({
          id: msg.id + '_user',
          role: 'user',
          content: msg.user_message,
          timestamp: msg.created_at
        });
        conversation.push({
          id: msg.id + '_assistant',
          role: 'assistant',
          content: msg.ai_response,
          timestamp: msg.created_at,
          model: msg.model_used,
          responseType: msg.response_type,
          responseTime: msg.response_time_ms,
          sources: msg.sources || []
        });
      } else if (msg.role === 'user' && msg.user_message) {
        conversation.push({
          id: msg.id,
          role: 'user',
          content: msg.user_message,
          timestamp: msg.created_at
        });
      } else if (msg.role === 'assistant' && msg.ai_response) {
        conversation.push({
          id: msg.id,
          role: 'assistant',
          content: msg.ai_response,
          timestamp: msg.created_at,
          model: msg.model_used,
          responseType: msg.response_type,
          responseTime: msg.response_time_ms,
          sources: msg.sources || []
        });
      } else if (msg.role === 'user' && msg.content) {
        conversation.push({
          id: msg.id,
          role: 'user',
          content: msg.content,
          timestamp: msg.created_at
        });
      } else if (msg.role === 'assistant' && msg.content) {
        conversation.push({
          id: msg.id,
          role: 'assistant',
          content: msg.content,
          timestamp: msg.created_at,
          model: msg.model_used,
          responseType: msg.response_type,
          responseTime: msg.response_time_ms,
          sources: msg.sources || []
        });
      }
    });

    res.json({
      chat: {
        id: chat.id,
        name: chat.title,
        userId: chat.user_id,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
        messageCount: conversation.length,
        documentCount: documents?.length || 0,
        hasDocuments: (documents?.length || 0) > 0
      },
      messages: conversation,
      documents: documents || []
    });

  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to retrieve chat' });
  }
});

/**
 * @swagger
 * /chats/{chatId}/messages:
 *   get:
 *     summary: Get messages for a specific chat
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: List of messages for the chat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       content:
 *                         type: string
 *                       role:
 *                         type: string
 *                         enum: [user, assistant]
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Chat not found
 */
router.get('/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;
    console.log(`📨 Getting messages for chat: ${chatId}, user: ${userId}`);

    // Verify chat exists and belongs to user
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chat) {
      console.error('❌ Chat not found:', chatError);
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get all messages for this chat, ordered by creation time
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    console.log(`📨 Found ${messages?.length || 0} messages for chat ${chatId}`);

    // Format messages for frontend
    const formattedMessages = [];
    messages.forEach(msg => {
      // Handle messages that have both user_message and ai_response (legacy format)
      if (msg.user_message && msg.ai_response) {
        // This is a complete message pair - add both user and assistant messages
        formattedMessages.push({
          id: msg.id + '_user',
          content: msg.user_message,
          role: 'user',
          timestamp: msg.created_at
        });
        formattedMessages.push({
          id: msg.id + '_assistant',
          content: msg.ai_response,
          role: 'assistant',
          timestamp: msg.created_at
        });
      } else if (msg.role === 'user' && msg.user_message) {
        formattedMessages.push({
          id: msg.id,
          content: msg.user_message,
          role: 'user',
          timestamp: msg.created_at
        });
      } else if (msg.role === 'assistant' && msg.ai_response) {
        formattedMessages.push({
          id: msg.id,
          content: msg.ai_response,
          role: 'assistant',
          timestamp: msg.created_at
        });
      } else if (msg.role === 'user' && msg.content) {
        formattedMessages.push({
          id: msg.id,
          content: msg.content,
          role: 'user',
          timestamp: msg.created_at
        });
      } else if (msg.role === 'assistant' && msg.content) {
        formattedMessages.push({
          id: msg.id,
          content: msg.content,
          role: 'assistant',
          timestamp: msg.created_at
        });
      }
    });

    console.log(`📨 Returning ${formattedMessages.length} formatted messages`);

    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({
      messages: formattedMessages
    });

  } catch (error) {
    console.error('❌ Get chat messages error:', error);
    res.status(500).json({ error: 'Failed to retrieve chat messages' });
  }
});

/**
 * @swagger
 * /chats/{chatId}/messages:
 *   post:
 *     summary: Send message to a specific chat (RAG if documents exist, regular LLM if not)
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's message/question
 *                 minLength: 1
 *                 maxLength: 2000
 *             required:
 *               - message
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messageId:
 *                   type: string
 *                 response:
 *                   type: string
 *                 chatId:
 *                   type: string
 *                 hasDocumentContext:
 *                   type: boolean
 *                 responseType:
 *                   type: string
 *                   enum: [rag, llm]
 *                 relevantChunks:
 *                   type: integer
 *                 model:
 *                   type: string
 *                 responseTime:
 *                   type: number
 *       404:
 *         description: Chat not found
 */
router.post('/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Verify chat exists and belongs to user
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id, user_id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get documents count for this chat (for classification)
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .eq('chat_id', chatId);

    if (docsError) {
      console.log(`⚠️ Error fetching documents for chat ${chatId}:`, docsError);
    }
    
    const hasDocuments = documents && documents.length > 0;
    console.log(`📊 Documents check for chat ${chatId}: ${documents ? documents.length : 0} documents found, hasDocuments: ${hasDocuments}`);

    // Get recent conversation context for better classification
    const { data: recentMessages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('user_message, ai_response')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(3);

    const recentConversation = recentMessages ? 
      recentMessages.reverse().map(msg => `User: ${msg.user_message}\nAssistant: ${msg.ai_response}`) : [];

    // Intelligently classify the query
    const classification = queryClassifier.classifyQuery(message, hasDocuments, recentConversation);
    
    console.log(`🤖 Query Classification: ${classification.type} (confidence: ${(classification.confidence * 100).toFixed(1)}%)`);
    console.log(`📝 Reason: ${classification.reason}`);

    const startTime = Date.now();
    let response, responseType, relevantChunks = 0, model, sources = [];

    if (classification.needsRAG && hasDocuments) {
      // Use Advanced RAG system with multi-document support
      console.log(`💬 Advanced RAG Chat in ${chatId}: "${message}" (${documents.length} documents)`);
      
      try {
        const ragResult = await advancedRAGService.processQuery(message, `${userId}_${chatId}`, {
          maxResults: 10,
          includeHistory: true,
          temperature: 0.7,
          maxTokens: 500, // Reduced from 1024 to 500 for more concise responses
          useCache: true,
          crossDocumentSearch: true,
          rerankResults: true
        });

        response = ragResult.response;
        responseType = 'advanced-rag';
        relevantChunks = ragResult.relevantChunks?.length || 0;
        model = ragResult.metadata?.model || 'advanced_rag_system';
        sources = ragResult.relevantChunks?.map(chunk => ({
          filename: chunk.metadata.filename,
          score: chunk.score,
          strategy: chunk.retrievalStrategy
        })) || [];

        // Enhanced logging for advanced RAG
        console.log(`✅ Advanced RAG Response in ${chatId}: ${Date.now() - startTime}ms`);
        console.log(`   - Documents analyzed: ${ragResult.metadata?.documentsAnalyzed || 0}`);
        console.log(`   - Chunks retrieved: ${ragResult.metadata?.chunksRetrieved || 0}`);
        console.log(`   - Query type: ${ragResult.metadata?.queryType || 'general'}`);
        console.log(`   - Retrieval strategy: ${ragResult.metadata?.retrievalStrategy || 'multi-strategy'}`);

        // If RAG response is too generic and this is a hybrid query, fall back to general
        if (classification.type === 'hybrid' && ragResult.response && 
            ragResult.response.includes('upload a document')) {
          throw new Error('RAG response too generic for hybrid query');
        }

      } catch (error) {
        console.log(`🔄 Advanced RAG failed, falling back to general chat: ${error.message}`);
        classification.needsRAG = false; // Fall back to general chat
      }
    }

    if (!classification.needsRAG || !hasDocuments) {
      // Use intelligent conversational AI
      console.log(`💬 AI Chat in ${chatId}: "${message}" (intelligent conversation mode)`);
      
      // Build smart conversational context
      let conversationalPrompt = '';

      // Add conversation history if available
      if (recentConversation.length > 0) {
        conversationalPrompt += 'Previous conversation:\n';
        recentConversation.forEach(conv => {
          conversationalPrompt += `${conv}\n`;
        });
        conversationalPrompt += '\n';
      }

      // Create a more natural prompt based on query type
      if (classification.type === 'general' || !classification.needsRAG) {
        conversationalPrompt += `You are a helpful, knowledgeable AI assistant. Please provide a natural, helpful response to the following message. Be conversational and informative.\n\nHuman: ${message}\nAssistant:`;
      } else {
        conversationalPrompt += `You are a helpful AI assistant. The user seems to be asking about documents, but no relevant documents are available in this chat. Please respond naturally and suggest they upload relevant documents if needed.\n\nHuman: ${message}\nAssistant:`;
      }

      const llmResult = await freeLLMService.generateResponse(conversationalPrompt, {
        temperature: 0.8,
        maxTokens: 512,
        modelType: 'chat'
      });

      response = llmResult.response;
      responseType = classification.needsRAG ? 'rag_fallback' : 'ai_chat';
      model = llmResult.model;
    }

    const responseTime = Date.now() - startTime;

    // Create message record (let Supabase generate UUID)
    
    // Save message to Supabase database (legacy format: both user and AI in one record)
    const { data: savedMessage, error: messageError } = await supabase
      .from('chat_messages')
      .insert([
        {
          chat_id: chatId,
          user_id: userId,
          user_message: message.trim(),
          ai_response: response,
          response_type: responseType,
          model_used: model,
          response_time_ms: responseTime,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (messageError) {
      console.error('Error saving message:', messageError);
      return res.status(500).json({ error: 'Failed to save message' });
    }

    // Update chat's updated_at timestamp
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    console.log(`✅ ${responseType.toUpperCase()} Response in ${chatId}: ${responseTime}ms`);

    res.json({
      messageId: savedAIMessage.id,  // Use AI message UUID
      response,
      chatId,
      hasDocumentContext: hasDocuments,
      responseType,
      relevantChunks,
      model,
      responseTime,
      queryClassification: {
        type: classification.type,
        confidence: Math.round(classification.confidence * 100),
        reason: classification.reason
      },
      sources: sources
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * @swagger
 * /chats/{chatId}/messages:
 *   get:
 *     summary: Get all messages for a specific chat
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: List of messages in the chat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       content:
 *                         type: string
 *                       role:
 *                         type: string
 *                         enum: [user, assistant]
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Chat not found
 */
router.get('/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Verify chat exists and belongs to user
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Get messages for this chat
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return res.status(500).json({ error: 'Failed to retrieve messages' });
    }

    // Format messages for frontend
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      role: msg.role,
      timestamp: msg.created_at
    }));

    res.json({
      messages: formattedMessages
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

/**
 * @swagger
 * /chats/{chatId}:
 *   put:
 *     summary: Update chat name/title
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: New chat name
 *             required:
 *               - name
 *     responses:
 *       200:
 *         description: Chat updated successfully
 *       404:
 *         description: Chat not found
 */
router.put('/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { name } = req.body;
    const userId = req.user.userId;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Chat name is required' });
    }

    // Update chat title in Supabase
    const { data: updatedChat, error } = await supabase
      .from('chats')
      .update({ 
        title: name.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updatedChat) {
      console.error('Error updating chat:', error);
      return res.status(404).json({ error: 'Chat not found or update failed' });
    }

    console.log(`✏️ Updated chat name: ${chatId} to "${name}"`);

    res.json({
      id: updatedChat.id,
      name: updatedChat.title,
      userId: updatedChat.user_id,
      createdAt: updatedChat.created_at,
      updatedAt: updatedChat.updated_at
    });

  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

/**
 * @swagger
 * /chats/{chatId}:
 *   delete:
 *     summary: Delete a chat and all its data
 *     tags: [Chat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat ID
 *     responses:
 *       200:
 *         description: Chat deleted successfully
 *       404:
 *         description: Chat not found
 */
router.delete('/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.userId;

    // Verify chat exists and belongs to user
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Delete the chat (CASCADE will automatically delete messages and documents)
    const { error: deleteError } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting chat:', deleteError);
      return res.status(500).json({ error: 'Failed to delete chat' });
    }

    console.log(`🗑️ Deleted chat: ${chatId} for user: ${userId}`);

    res.json({ 
      message: 'Chat deleted successfully',
      deletedChatId: chatId
    });

  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Export the router and chat storage for use by upload routes
module.exports = {
  router,
  chatData,
  chatDocuments,
  userChats
};
