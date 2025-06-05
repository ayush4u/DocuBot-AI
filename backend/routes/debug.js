const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get in-memory data for debugging
router.get('/data', authenticateToken, (req, res) => {
  const { chatData, userChats } = require('./chatManagement');
  
  // Get user's data
  const userId = req.user.userId;
  const userChatIds = userChats.get(userId) || [];
  const userChatsData = userChatIds.map(chatId => chatData.get(chatId));
  
  res.json({
    userId,
    totalChats: userChatIds.length,
    chats: userChatsData,
    memoryStore: {
      totalChatsInMemory: chatData.size,
      totalUsersInMemory: userChats.size
    }
  });
});

module.exports = router;
