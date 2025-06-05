# API Documentation

Complete API reference for the Knowledge-Based ChatGPT Clone system.

## Base URL
```
http://localhost:3001
```

## Authentication
All endpoints (except registration and login) require JWT authentication:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 🔐 Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "verified": true
  }
}
```

#### Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### 💬 Chat Management

#### Get All Chats
```http
GET /chats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "chats": [
    {
      "id": "chat-uuid",
      "name": "My Chat",
      "createdAt": "2025-08-30T10:00:00Z",
      "messageCount": 5,
      "hasDocuments": true
    }
  ]
}
```

#### Create New Chat
```http
POST /chats
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Chat"
}
```

**Response:**
```json
{
  "success": true,
  "chat": {
    "id": "chat-uuid",
    "name": "New Chat",
    "createdAt": "2025-08-30T10:00:00Z"
  }
}
```

#### Delete Chat
```http
DELETE /chats/{chatId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Chat deleted successfully"
}
```

#### Send Message to Chat
```http
POST /chats/{chatId}/message
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "What is this document about?"
}
```

**Response:**
```json
{
  "success": true,
  "response": "This document discusses...",
  "aiType": "RAG",
  "conversation": [
    {
      "role": "user",
      "content": "What is this document about?",
      "timestamp": "2025-08-30T10:00:00Z"
    },
    {
      "role": "assistant", 
      "content": "This document discusses...",
      "timestamp": "2025-08-30T10:00:30Z"
    }
  ]
}
```

### 📄 Document Management

#### Upload Document to Chat
```http
POST /chats/{chatId}/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <PDF file>
```

**Response:**
```json
{
  "success": true,
  "message": "✅ Document uploaded and processed successfully!\n\n📄 Your document is now available for AI-powered questions\n✅ Document is now searchable and ready for AI-powered questions\n📄 5,432 characters processed\n🔍 Vector embeddings created for semantic search\n💬 You can now ask detailed questions about this document!",
  "document": {
    "filename": "document.pdf",
    "id": "document.pdf",
    "textLength": 5432,
    "pages": 10,
    "processingResults": {
      "databaseStored": true,
      "vectorStored": true,
      "ragEnabled": true
    }
  }
}
```

#### Get Chat Documents
```http
GET /chats/{chatId}/documents
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "chatId": "chat-uuid",
  "documents": [
    {
      "filename": "document.pdf",
      "uploadedAt": "2025-08-30T10:00:00Z",
      "size": 1024000,
      "pages": 10
    }
  ]
}
```

### 🔍 System Information

#### Health Check
```http
GET /
```

**Response:**
```
Backend is running!
```

#### System Status
```http
GET /system/status
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "vectorStore": "connected",
    "llm": "connected"
  }
}
```

## Smart AI Routing

The system automatically chooses the best AI approach:

- **RAG Mode**: Used when a chat has uploaded documents
  - Searches document context for relevant information
  - Provides document-based answers
  - Cites sources from uploaded PDFs

- **LLM Mode**: Used for general conversations
  - Uses Hugging Face free models
  - General knowledge responses
  - No document context required

## Error Responses

All endpoints may return these error formats:

```json
{
  "error": "Error message description",
  "details": "Additional error details if available"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created successfully
- `400` - Bad request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `404` - Resource not found
- `500` - Internal server error

## Rate Limits

- Hugging Face API: Daily limits apply
- File uploads: 10MB max per file
- Message length: 2000 characters max

## Getting Started

1. **Register**: Create account with `/auth/register`
2. **Create Chat**: Use `/chats` POST to create new conversation with `{"name": "Chat Name"}`
3. **Upload Document**: Use `/chats/{chatId}/upload` to add PDF context
4. **Chat**: Send messages with `/chats/{chatId}/message`

## Example Workflow

```bash
# 1. Register user
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. Create chat
curl -X POST http://localhost:3001/chats \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My First Chat"}'

# 3. Upload document
curl -X POST http://localhost:3001/chats/CHAT_ID/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf"

# 4. Send message
curl -X POST http://localhost:3001/chats/CHAT_ID/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is this document about?"}'
```
