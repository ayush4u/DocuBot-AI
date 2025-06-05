# Setup Guide

## Prerequisites
- Node.js (v16+)
- Python (for ChromaDB)
- Supabase account
- Hugging Face account

## Step-by-Step Setup

### 1. Clone and Install
```bash
git clone <your-repo>
cd Knowledge_based
npm install
```

### 2. Environment Configuration

Create `.env` file with these variables:
```env
JWT_SECRET=your-super-secret-jwt-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
HUGGINGFACE_API_TOKEN=hf_your_token_here
PORT=3000
NODE_ENV=development
AUTO_VERIFY_USERS=true
```

### 3. Get API Keys

**Supabase Setup:**
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings > API
4. Copy Project URL and anon public key

**Hugging Face Setup:**
1. Go to [huggingface.co](https://huggingface.co)
2. Create account and go to Settings > Access Tokens
3. Create new token with read access

### 3. Database Setup

**Follow the detailed Supabase setup guide:**
👉 **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** 📖

**Quick steps:**
1. Create Supabase account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → API and copy:
   - Project URL
   - anon public key
4. Update your `.env` file
5. Run SQL script in Supabase SQL Editor

**Required Tables:**
- profiles (user data)
- chats (conversations)  
- messages (chat history)
- documents (uploaded files)

### 5. Start Services

**Terminal 1 - ChromaDB:**
```bash
pip install chromadb
python -m chromadb.cli.cli run --host localhost --port 8000
```

**Terminal 2 - Backend:**
```bash
npm start
```

### 6. Test the API

**Register user:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Create chat:**
```bash
curl -X POST http://localhost:3000/api/chats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Chat"}'
```

## Troubleshooting

**ChromaDB not starting:**
- Install: `pip install chromadb`
- Check port 8000 is free
- Try: `python -c "import chromadb; print('ChromaDB installed')"`

**Supabase connection issues:**
- Verify URL and keys in .env
- Check project is not paused
- Test connection in Supabase dashboard

**Hugging Face API errors:**
- Verify token has read access
- Check daily usage limits
- Ensure token is properly formatted

**JWT errors:**
- Ensure JWT_SECRET is set
- Token should be sent as: `Authorization: Bearer <token>`
- Check token hasn't expired

## Development Tips

- Use Postman or curl for API testing
- Check browser console for frontend errors
- Monitor ChromaDB logs for vector search issues
- Use Supabase table editor to verify data
