const { createClient } = require('@supabase/supabase-js');

// In-memory storage for development
const memoryDocuments = new Map();
const memoryChatHistory = new Map();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

// Initialize database
async function initializeDatabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️ Supabase credentials not found, using in-memory storage');
    console.log('💡 Set SUPABASE_URL and SUPABASE_ANON_KEY in .env for persistent storage');
    return true; // Don't exit, just use memory storage
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test connection with a simple query
    console.log('🔄 Testing Supabase connection...');
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    
    if (error) {
      if (error.message.includes('JWT') || error.message.includes('token')) {
        console.log('⚠️ Supabase JWT token issue:', error.message);
        console.log('💡 Please check your SUPABASE_ANON_KEY in .env file');
        console.log('🔄 Falling back to in-memory storage for now');
        supabase = null; // Disable Supabase, use memory storage
        return true;
      } else {
        console.log('⚠️ Supabase connection warning:', error.message);
        console.log('📝 Note: This is normal if you have no data yet or RLS is enabled');
        console.log('✅ Supabase client initialized - will work for authentication');
      }
    } else {
      console.log('✅ Supabase connected successfully');
    }
    return true;
  } catch (error) {
    console.log('⚠️ Supabase connection error:', error.message);
    console.log('� Falling back to in-memory storage');
    supabase = null;
    return true;
  }
}

// Document operations
async function saveDocument(filename, content, userId = 'anonymous') {
  if (!supabase) {
    console.log('⚠️ Supabase not available, using in-memory storage');
    const docId = `${userId}_${filename}_${Date.now()}`;
    memoryDocuments.set(docId, {
      id: docId,
      filename,
      content,
      user_id: userId,
      created_at: new Date().toISOString()
    });
    console.log(`📝 Document saved to memory: ${filename}`);
    return memoryDocuments.get(docId);
  }

  try {
    const { data, error } = await supabase
      .from('documents')
      .insert([
        {
          filename: filename,
          content: content,
          user_id: userId,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.message.includes('JWT') || error.message.includes('token')) {
        console.log('❌ JWT token expired, falling back to memory storage');
        supabase = null; // Disable Supabase for this session
        return saveDocument(filename, content, userId); // Retry with memory storage
      }
      throw error;
    }
    console.log(`📝 Document saved to Supabase: ${filename}`);
    return data;
  } catch (error) {
    console.error('Save document error:', error.message);
    // Fallback to in-memory
    const docId = `${userId}_${filename}_${Date.now()}`;
    memoryDocuments.set(docId, {
      id: docId,
      filename,
      content,
      user_id: userId,
      created_at: new Date().toISOString()
    });
    console.log(`📝 Document saved to memory (fallback): ${filename}`);
    return { id: docId, filename, content };
  }
}

async function getDocuments(userId = 'anonymous') {
  if (!supabase) {
    // Fallback to in-memory
    const docs = Array.from(memoryDocuments.values())
      .filter(doc => doc.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    console.log(`📚 Retrieved ${docs.length} documents from memory for user ${userId}`);
    return docs;
  }

  try {
    // Handle anonymous users differently
    if (userId === 'anonymous') {
      console.log(`🔍 Getting documents for anonymous user`);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', 'anonymous')
        .order('created_at', { ascending: false });
        
      if (error) {
        if (error.message.includes('JWT') || error.message.includes('token')) {
          console.log('❌ JWT token expired, falling back to memory storage');
          supabase = null;
          return getDocuments(userId);
        }
        throw error;
      }
      console.log(`📚 Retrieved ${data?.length || 0} documents from Supabase for anonymous user`);
      return data || [];
    }

    // Extract chat_id from userId format: realUserId_chatId
    let chatId = null;
    if (userId.includes('_')) {
      chatId = userId.split('_')[1]; // Get chat_id part
      console.log(`🔍 Extracted chat_id: ${chatId} from userId: ${userId}`);
    } else {
      console.log(`⚠️ Invalid userId format: ${userId}, expected format: userId_chatId`);
      return [];
    }
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.includes('JWT') || error.message.includes('token')) {
        console.log('❌ JWT token expired, falling back to memory storage');
        supabase = null; // Disable Supabase for this session
        return getDocuments(userId); // Retry with memory storage
      }
      throw error;
    }
    console.log(`📚 Retrieved ${data?.length || 0} documents from Supabase for user ${userId}`);
    return data || [];
  } catch (error) {
    console.error('Get documents error:', error.message);
    // Fallback to in-memory
    const docs = Array.from(memoryDocuments.values())
      .filter(doc => doc.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    console.log(`📚 Retrieved ${docs.length} documents from memory (fallback) for user ${userId}`);
    return docs;
  }
}

// Chat operations
async function saveChatMessage(message, response, userId = 'anonymous', documentId = null, chatId = null) {
  if (!supabase) {
    // Just log for in-memory mode
    const chatId = Date.now();
    const chat = {
      id: chatId,
      chat_id: chatId,
      user_id: userId,
      user_message: message,
      ai_response: response,
      document_id: documentId,
      created_at: new Date().toISOString()
    };
    
    if (!memoryChatHistory.has(userId)) {
      memoryChatHistory.set(userId, []);
    }
    memoryChatHistory.get(userId).unshift(chat);
    
    // Keep only last 50 messages
    if (memoryChatHistory.get(userId).length > 50) {
      memoryChatHistory.get(userId) = memoryChatHistory.get(userId).slice(0, 50);
    }
    
    console.log(`💬 Chat message saved to memory for user ${userId}`);
    return chat;
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          chat_id: chatId,
          user_id: userId,
          user_message: message,
          ai_response: response,
          document_id: documentId,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    console.log(`💬 Chat message saved to Supabase for user ${userId}`);
    return data;
  } catch (error) {
    console.error('Save chat message error:', error.message);
    // Fallback to memory
    const chatId = Date.now();
    const chat = {
      id: chatId,
      chat_id: chatId,
      user_id: userId,
      user_message: message,
      ai_response: response,
      document_id: documentId,
      created_at: new Date().toISOString()
    };
    
    if (!memoryChatHistory.has(userId)) {
      memoryChatHistory.set(userId, []);
    }
    memoryChatHistory.get(userId).unshift(chat);
    
    console.log(`💬 Chat message saved to memory (fallback) for user ${userId}`);
    return chat;
  }
}

async function getChatHistory(userId = 'anonymous', limit = 50) {
  if (!supabase) {
    const history = memoryChatHistory.get(userId) || [];
    console.log(`🕐 Retrieved ${history.length} chat messages from memory for user ${userId}`);
    return history.slice(0, limit);
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    console.log(`🕐 Retrieved ${data?.length || 0} chat messages from Supabase for user ${userId}`);
    return data || [];
  } catch (error) {
    console.error('Get chat history error:', error.message);
    // Fallback to memory
    const history = memoryChatHistory.get(userId) || [];
    console.log(`🕐 Retrieved ${history.length} chat messages from memory (fallback) for user ${userId}`);
    return history.slice(0, limit);
  }
}

module.exports = {
  initializeDatabase,
  saveDocument,
  getDocuments,
  saveChatMessage,
  getChatHistory,
  get supabase() { return supabase; }
};
