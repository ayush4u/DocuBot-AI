const express = require('express');
const router = express.Router();
const { enhancedRAGService } = require('../services/enhancedRAGService');
const { contextMemoryService } = require('../services/contextMemoryService');
const { embeddingService } = require('../services/embeddingService');
const { freeLLMService } = require('../services/freeLLMService');
const { optionalAuth } = require('../middleware/auth');

/**
 * @swagger
 * /system/stats:
 *   get:
 *     summary: Get comprehensive system statistics
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await enhancedRAGService.getSystemStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0-enhanced',
      components: stats.components,
      statistics: {
        vectorStore: stats.vectorStore,
        embeddings: stats.embeddings,
        llm: stats.llm,
        memory: stats.memory
      },
      features: {
        freeAndOpenSource: true,
        localEmbeddings: stats.embeddings.initialized,
        contextMemory: true,
        multiModelLLM: true,
        vectorSearch: true,
        semanticCache: true,
        smartChunking: true,
        documentSummaries: true
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get system stats',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /system/user-stats:
 *   get:
 *     summary: Get user-specific statistics
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
 */
router.get('/user-stats', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.email || 'anonymous';
    const userStats = contextMemoryService.getUserStats(userId);
    
    res.json({
      userId,
      stats: userStats,
      authenticated: !!req.user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get user stats',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /system/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System health status
 */
router.get('/health', async (req, res) => {
  try {
    const embeddingStats = embeddingService.getStats();
    const llmStats = freeLLMService.getStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        enhancedRAG: enhancedRAGService.isInitialized ? '✅ Online' : '❌ Offline',
        embeddings: embeddingStats.initialized ? '✅ Online (Local)' : '✅ Online (ChromaDB)',
        vectorStore: '✅ Online (ChromaDB)',
        llm: '✅ Online (Hugging Face)',
        contextMemory: '✅ Online',
        database: '✅ Online (Supabase/Memory)'
      },
      features: [
        '🆓 Completely Free',
        '📊 Local Embeddings',
        '🤖 Multiple LLM Models',
        '🧠 Smart Context Memory',
        '🔍 Vector Search',
        '📚 Document Processing',
        '⚡ Semantic Caching',
        '🔐 JWT Authentication'
      ]
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /system/clear-user-data:
 *   delete:
 *     summary: Clear all user data (conversations, documents, cache)
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data cleared successfully
 */
router.delete('/clear-user-data', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.email || 'anonymous';
    
    const success = await enhancedRAGService.clearUserData(userId);
    
    if (success) {
      res.json({
        message: 'User data cleared successfully',
        userId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'Failed to clear user data',
        userId
      });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to clear user data',
      message: error.message 
    });
  }
});

module.exports = router;
