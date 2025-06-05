require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { initializeDatabase } = require('./config/database');

const http = require('http');
const app = express();
app.use(cors());

// Body parsing middleware - only for routes that need JSON
const jsonParser = express.json({ limit: '10mb' });
const urlencodedParser = express.urlencoded({ limit: '10mb', extended: true });

// Apply JSON parsing only to specific routes that need it
app.use('/auth', jsonParser);
app.use('/user', jsonParser);
app.use('/system', jsonParser);
app.use('/chats', jsonParser);
app.use('/api/temperature', jsonParser);
app.use('/api/auth', jsonParser);

// Initialize database on startup
async function initializeApp() {
  console.log('🚀 Starting DocuBot backend...');
  
  // Initialize database (Supabase or fallback to memory)
  await initializeDatabase();
  
  // Initialize Enhanced RAG system with all free components
  const { enhancedRAGService } = require('./services/enhancedRAGService');
  const { advancedRAGService } = require('./services/advancedRAGService');
  const { embeddingService } = require('./services/embeddingService');
  const { advancedConversationContext } = require('./services/advancedConversationContext');
  
  console.log('🤖 Initializing Enhanced RAG System with Free Components...');
  console.log('  📊 Embeddings: Xenova Transformers (Local)');
  console.log('  🗄️ Vector Store: ChromaDB');
  console.log('  🤖 LLM: Hugging Face Free Models');
  console.log('  🧠 Memory: Enhanced Context System');
  console.log('  💾 Database: Supabase + In-Memory Fallback');
  console.log('  💬 Conversation Context: Advanced Multi-Document Tracking');
  
  await enhancedRAGService.initialize();
  await advancedRAGService.initialize();
  await advancedConversationContext.initialize();
  
  console.log('✅ All systems initialized and ready!');
}

// Initialize database
initializeApp();

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const systemRoutes = require('./routes/system');
const chatRoutes = require('./routes/chat');

// New Chat Management Routes
const { router: chatManagementRoutes } = require('./routes/chatManagement');
const chatDocumentRoutes = require('./routes/chatDocuments');
const temperatureTestRoutes = require('./routes/temperatureTest');

app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/system', systemRoutes);
app.use('/api/chat', chatRoutes);

// ChatGPT-like interface routes
app.use('/chats', chatManagementRoutes);
app.use('/api/chats', chatManagementRoutes);
app.use('/chats', chatDocumentRoutes);

// Temperature testing and configuration routes
app.use('/api/temperature', temperatureTestRoutes);

// Create global document store for chat system
global.documentStore = global.documentStore || new Map();

// Swagger setup - Load comprehensive API documentation
const swaggerDocument = require('./swagger.json');

// Enhance with route-based documentation (if any exists)
const swaggerOptions = {
  swaggerDefinition: swaggerDocument,
  apis: ['./routes/*.js', './index.js'], // Include route files for additional documentation
};

// Use the comprehensive JSON documentation as primary source
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Enhanced RAG Chatbot API Documentation",
  explorer: true,
  swaggerOptions: {
    docExpansion: 'list',
    defaultModelExpandDepth: 2,
    defaultModelsExpandDepth: 1,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true
  }
}));

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const setupSocket = require('./socket');
setupSocket(server);
server.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
