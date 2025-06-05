// DATABASE ARCHITECTURE EXPLANATION
// ==================================

/*
🏗️ TWO-DATABASE ARCHITECTURE:

┌─────────────────────────────────────────────────────────────────┐
│                        USER UPLOADS PDF                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DOCUMENT PROCESSING                           │
│  • Extract text from PDF                                       │
│  • Clean and preprocess text                                   │
│  • Split into chunks (800 chars with 200 overlap)             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│   SUPABASE DB   │         │   CHROMADB      │
│   (PostgreSQL)  │         │   (Vectors)     │
└─────────────────┘         └─────────────────┘

📊 SUPABASE STORES:             🔍 CHROMADB STORES:
├── 👤 users                    ├── 📊 embeddings (vectors)
├── 📄 documents                ├── 🧩 text_chunks  
├── 💬 chat_messages            ├── 🏷️ metadata
├── 🕐 chat_history              └── 📐 similarity_indexes
└── 👥 user_sessions

WHEN USER ASKS QUESTION:
┌─────────────────────────────────────────────────────────────────┐
│  1. Question: "What does the document say about X?"             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. ChromaDB: Vector search for relevant chunks                │
│     • Convert question to embedding vector                     │
│     • Find similar document chunks                             │
│     • Return top 5 most relevant pieces                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Supabase: Get conversation history                         │
│     • Retrieve recent chat messages                            │
│     • Get user context and preferences                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. LLM: Generate answer using both contexts                   │
│     • Relevant document chunks (from ChromaDB)                 │
│     • Conversation history (from Supabase)                     │
│     • Generate contextual response                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Supabase: Save the new conversation                        │
│     • Store user question                                      │
│     • Store AI response                                        │
│     • Update chat history                                      │
└─────────────────────────────────────────────────────────────────┘

🔑 KEY INSIGHT:
• Supabase = "What was said" (chat storage, user data)
• ChromaDB = "What was meant" (semantic understanding, context)

🎯 WHY TWO DATABASES?
• Supabase: Great for relational data, user auth, chat history
• ChromaDB: Specialized for vector similarity, semantic search
• Together: Powerful RAG system with both memory and understanding

💡 FALLBACK SYSTEM:
• If Supabase fails → Use in-memory storage (still works)
• If ChromaDB fails → Use keyword search (still works)
• System gracefully degrades but never stops working
*/

// Example of how they work together in your code:

async function processUserQuestion(question, userId) {
  // 1. Get conversation context from Supabase
  const chatHistory = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  // 2. Get relevant document chunks from ChromaDB  
  const relevantChunks = await chromadb.collection
    .query({
      queryTexts: [question],
      nResults: 5
    });

  // 3. Combine both contexts for LLM
  const prompt = `
    Previous conversation: ${chatHistory.map(c => c.message).join('\n')}
    
    Relevant document content: ${relevantChunks.documents.join('\n')}
    
    Question: ${question}
    Answer:
  `;

  // 4. Get AI response
  const aiResponse = await llm.generate(prompt);

  // 5. Save new conversation to Supabase
  await supabase
    .from('chat_messages')
    .insert({
      user_id: userId,
      question: question,
      response: aiResponse,
      created_at: new Date()
    });

  return aiResponse;
}
