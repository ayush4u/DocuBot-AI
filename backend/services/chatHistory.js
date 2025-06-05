const { saveChatMessage, getChatHistory } = require('../config/database');

class ChatHistoryService {
  constructor() {
    this.memoryStore = new Map(); // Fallback for when database is not available
  }

  // Save a chat interaction
  async saveChat(userId, userMessage, aiResponse, metadata = {}) {
    try {
      // Save to database
      const saved = await saveChatMessage(userMessage, aiResponse, userId, metadata.documentId, metadata.chatId);
      
      // Also save to memory as backup
      const chatId = saved.id || Date.now();
      const chat = {
        id: chatId,
        userId,
        userMessage,
        aiResponse,
        metadata,
        timestamp: new Date().toISOString()
      };
      
      if (!this.memoryStore.has(userId)) {
        this.memoryStore.set(userId, []);
      }
      this.memoryStore.get(userId).unshift(chat);
      
      // Keep only last 50 chats in memory
      if (this.memoryStore.get(userId).length > 50) {
        this.memoryStore.get(userId) = this.memoryStore.get(userId).slice(0, 50);
      }
      
      return chat;
      
    } catch (error) {
      console.error('❌ Error saving chat:', error.message);
      
      // Fallback to memory only
      const chatId = Date.now();
      const chat = {
        id: chatId,
        userId,
        userMessage,
        aiResponse,
        metadata,
        timestamp: new Date().toISOString()
      };
      
      if (!this.memoryStore.has(userId)) {
        this.memoryStore.set(userId, []);
      }
      this.memoryStore.get(userId).unshift(chat);
      
      return chat;
    }
  }

  // Get chat history for a user
  async getHistory(userId, limit = 20) {
    try {
      // Try to get from database first
      const dbHistory = await getChatHistory(userId, limit);
      
      if (dbHistory && dbHistory.length > 0) {
        return dbHistory.map(chat => ({
          id: chat.id,
          userId: chat.user_id,
          userMessage: chat.user_message,
          aiResponse: chat.ai_response,
          metadata: { documentId: chat.document_id },
          timestamp: chat.created_at
        }));
      }
      
      // Fallback to memory
      const memoryHistory = this.memoryStore.get(userId) || [];
      return memoryHistory.slice(0, limit);
      
    } catch (error) {
      console.error('❌ Error getting chat history:', error.message);
      
      // Return memory history
      const memoryHistory = this.memoryStore.get(userId) || [];
      return memoryHistory.slice(0, limit);
    }
  }

  // Get chat context (recent messages for context)
  async getChatContext(userId, maxMessages = 5) {
    const history = await this.getHistory(userId, maxMessages);
    
    // Format as conversation context
    const context = history.reverse().map(chat => 
      `Human: ${chat.userMessage}\nAssistant: ${chat.aiResponse}`
    ).join('\n\n');
    
    return context;
  }

  // Search chat history
  async searchHistory(userId, query, limit = 10) {
    const history = await this.getHistory(userId, 100); // Get more for searching
    
    const queryLower = query.toLowerCase();
    const matches = history.filter(chat => 
      chat.userMessage.toLowerCase().includes(queryLower) ||
      chat.aiResponse.toLowerCase().includes(queryLower)
    );
    
    return matches.slice(0, limit);
  }

  // Get chat statistics
  async getStats(userId) {
    const history = await this.getHistory(userId, 1000);
    
    const stats = {
      totalChats: history.length,
      messagesThisWeek: 0,
      averageResponseLength: 0,
      topTopics: [],
      firstChat: null,
      lastChat: null
    };
    
    if (history.length === 0) return stats;
    
    // Calculate stats
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    let totalResponseLength = 0;
    const topics = {};
    
    history.forEach(chat => {
      const chatDate = new Date(chat.timestamp);
      
      // Count messages this week
      if (chatDate > oneWeekAgo) {
        stats.messagesThisWeek++;
      }
      
      // Calculate average response length
      totalResponseLength += chat.aiResponse.length;
      
      // Extract topics (simple keyword extraction)
      const words = chat.userMessage.toLowerCase().split(' ')
        .filter(word => word.length > 4)
        .filter(word => !['what', 'when', 'where', 'how', 'why', 'which', 'this', 'that', 'with', 'from'].includes(word));
      
      words.forEach(word => {
        topics[word] = (topics[word] || 0) + 1;
      });
    });
    
    stats.averageResponseLength = Math.round(totalResponseLength / history.length);
    stats.topTopics = Object.entries(topics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));
    
    stats.firstChat = history[history.length - 1];
    stats.lastChat = history[0];
    
    return stats;
  }

  // Clear chat history for user
  async clearHistory(userId) {
    try {
      // Clear from memory
      this.memoryStore.delete(userId);
      
      // Note: Database clearing would require additional implementation
      // For now, we just clear memory cache
      
      return true;
    } catch (error) {
      console.error('❌ Error clearing history:', error.message);
      return false;
    }
  }
}

// Create singleton instance
const chatHistoryService = new ChatHistoryService();

module.exports = {
  ChatHistoryService,
  chatHistoryService
};
