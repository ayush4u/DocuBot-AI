const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory store for anonymous user limits (in production, use Redis or database)
const anonymousLimits = new Map();

// Limits for anonymous users
const ANONYMOUS_LIMITS = {
  maxDocuments: 1,
  maxChats: 5,
  maxMessagesPerChat: 20
};

// Get client identifier (IP + User-Agent)
const getClientId = (req) => {
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  return `${ip}-${userAgent}`;
};

// Check if user has exceeded anonymous limits
const checkAnonymousLimits = async (req, res, next) => {
  // If user is authenticated, skip limits
  if (req.user && req.user.userId && req.user.userId !== 'anonymous') {
    return next();
  }

  const clientId = getClientId(req);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000; // 24 hours

  // Initialize or get client data
  if (!anonymousLimits.has(clientId)) {
    anonymousLimits.set(clientId, {
      documents: 0,
      chats: 0,
      messages: 0,
      lastActivity: now,
      chatIds: new Set()
    });
  }

  const clientData = anonymousLimits.get(clientId);

  // Clean up old entries (older than 24 hours)
  if (now - clientData.lastActivity > oneDay) {
    clientData.documents = 0;
    clientData.chats = 0;
    clientData.messages = 0;
    clientData.chatIds.clear();
  }

  clientData.lastActivity = now;

  // Store client data for use in route handlers
  req.anonymousData = clientData;
  req.clientId = clientId;

  next();
};

// Middleware to check document upload limits
const checkDocumentLimit = (req, res, next) => {
  if (req.user && req.user.userId && req.user.userId !== 'anonymous') {
    return next(); // Authenticated users have no limits
  }

  const clientData = req.anonymousData;

  if (clientData.documents >= ANONYMOUS_LIMITS.maxDocuments) {
    return res.status(429).json({
      error: 'Anonymous user limit exceeded',
      message: 'Anonymous users can upload only 1 document. Please sign up for unlimited access.',
      limit: ANONYMOUS_LIMITS.maxDocuments,
      current: clientData.documents,
      action: 'signup_required'
    });
  }

  next();
};

// Middleware to check chat creation limits
const checkChatLimit = (req, res, next) => {
  if (req.user && req.user.userId && req.user.userId !== 'anonymous') {
    return next(); // Authenticated users have no limits
  }

  const clientData = req.anonymousData;

  if (clientData.chats >= ANONYMOUS_LIMITS.maxChats) {
    return res.status(429).json({
      error: 'Anonymous user limit exceeded',
      message: 'Anonymous users can create only 5 chats. Please sign up for unlimited access.',
      limit: ANONYMOUS_LIMITS.maxChats,
      current: clientData.chats,
      action: 'signup_required'
    });
  }

  next();
};

// Middleware to check message limits per chat
const checkMessageLimit = (req, res, next) => {
  if (req.user && req.user.userId && req.user.userId !== 'anonymous') {
    return next(); // Authenticated users have no limits
  }

  const clientData = req.anonymousData;
  const chatId = req.params.chatId || req.body.chatId || 'default';

  if (clientData.messages >= ANONYMOUS_LIMITS.maxMessagesPerChat) {
    return res.status(429).json({
      error: 'Anonymous user limit exceeded',
      message: 'Anonymous users can send only 20 messages per chat. Please sign up for unlimited access.',
      limit: ANONYMOUS_LIMITS.maxMessagesPerChat,
      current: clientData.messages,
      action: 'signup_required'
    });
  }

  next();
};

// Helper function to increment counters
const incrementCounter = (req, type) => {
  if (req.user && req.user.userId && req.user.userId !== 'anonymous') {
    return; // Don't track authenticated users
  }

  const clientData = req.anonymousData;
  if (type === 'document') {
    clientData.documents++;
  } else if (type === 'chat') {
    clientData.chats++;
    const chatId = req.params.chatId || req.body.chatId || 'default';
    clientData.chatIds.add(chatId);
  } else if (type === 'message') {
    clientData.messages++;
  }
};

// Clean up old entries periodically (every hour)
setInterval(() => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  for (const [clientId, data] of anonymousLimits.entries()) {
    if (now - data.lastActivity > oneDay) {
      anonymousLimits.delete(clientId);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

module.exports = {
  checkAnonymousLimits,
  checkDocumentLimit,
  checkChatLimit,
  checkMessageLimit,
  incrementCounter,
  ANONYMOUS_LIMITS
};
