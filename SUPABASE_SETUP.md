# 🚀 Supabase Setup Guide

Complete guide to set up Supabase database for the Knowledge-Based ChatGPT Clone project.

## 📋 Prerequisites

- A free Supabase account
- Basic understanding of SQL
- Your project cloned locally

## 🔧 Step-by-Step Setup

### 1. Create Supabase Account

1. **Visit**: https://supabase.com
2. **Click "Start your project"**
3. **Sign up** with GitHub, Google, or email
4. **Verify your email** if required

### 2. Create New Project

1. **Click "New Project"**
2. **Fill in project details:**
   - **Organization**: Select or create one
   - **Project Name**: `knowledgebase-chatbot` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your location
3. **Click "Create new project"**
4. **Wait 2-3 minutes** for project initialization

### 3. Get API Credentials

1. **Go to Settings** → **API** (in left sidebar)
2. **Copy the following values:**
   - **Project URL**: `https://[your-project-id].supabase.co`
   - **anon public key**: `eyJ...` (long string)
   - **service_role key**: `eyJ...` (keep this secret!)

### 4. Update Environment Variables

1. **Open your project's `.env` file** in the backend folder
2. **Update these values:**

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 5. Create Database Tables

1. **Go to SQL Editor** in your Supabase dashboard
2. **Click "New Query"**
3. **Copy and paste this SQL:**

```sql
-- Create profiles table (links to Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats (id) ON DELETE CASCADE,
  role VARCHAR NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES chats (id) ON DELETE CASCADE,
  filename VARCHAR NOT NULL,
  original_name VARCHAR NOT NULL,
  file_size INTEGER,
  pages INTEGER,
  text_content TEXT,
  summary TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_documents_chat_id ON documents (chat_id);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for chats
CREATE POLICY "Users can view own chats" ON chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats" ON chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats" ON chats
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for messages
CREATE POLICY "Users can view messages from own chats" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own chats" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = messages.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

-- Create RLS policies for documents
CREATE POLICY "Users can view documents from own chats" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = documents.chat_id 
      AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create documents in own chats" ON documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = documents.chat_id 
      AND chats.user_id = auth.uid()
    )
  );
```

4. **Click "Run"** to execute the SQL
5. **Verify success**: You should see "Success. No rows returned" message

### 6. Configure Authentication

1. **Go to Authentication** → **Settings**
2. **Site URL**: Set to `http://localhost:3001` (for development)
3. **Redirect URLs**: Add `http://localhost:3001/auth/callback`
4. **Email Templates**: Configure if needed (optional for development)

### 7. Verify Setup

1. **Go to Table Editor**
2. **Check that these tables exist:**
   - ✅ profiles
   - ✅ chats
   - ✅ messages
   - ✅ documents

## 🧪 Test Connection

Run this command in your project terminal to test the connection:

```bash
cd backend
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
supabase.from('profiles').select('count').then(r => {
  if(r.error) console.log('❌ Error:', r.error.message);
  else console.log('✅ Supabase connected successfully!');
}).catch(e => console.log('❌ Connection failed:', e.message));
"
```

## 🚨 Troubleshooting

### Connection Issues

**Problem**: `fetch failed` or connection timeout
**Solutions**:
- Check if your Supabase project is paused (free tier pauses after 1 week)
- Verify your Project URL and API keys
- Check internet connection
- Try refreshing your Supabase project

### Table Creation Issues

**Problem**: SQL execution fails
**Solutions**:
- Make sure you're in the correct database (should show your project name)
- Run SQL commands one section at a time
- Check for typos in table names
- Verify you have proper permissions

### Authentication Issues

**Problem**: Users can't register/login
**Solutions**:
- Verify authentication is enabled in Supabase dashboard
- Check email confirmation settings
- Ensure RLS policies are correctly set up
- Test with valid email formats

### RLS (Row Level Security) Issues

**Problem**: "new row violates row-level security policy"
**Solutions**:
- Make sure auth.uid() is properly set
- Check if user is authenticated
- Verify RLS policies match your use case
- Temporarily disable RLS for testing (not recommended for production)

## 🔐 Security Best Practices

### Environment Variables
- **Never commit** `.env` files to version control
- **Use different projects** for development/production
- **Rotate API keys** regularly
- **Keep service_role key** absolutely secret

### Database Security
- **Enable RLS** on all tables
- **Test policies** thoroughly
- **Use least privilege** principle
- **Regular backups** (Supabase free tier includes automatic backups)

### Production Checklist
- [ ] Different Supabase project for production
- [ ] Environment-specific API keys
- [ ] Proper domain configuration
- [ ] Email templates configured
- [ ] RLS policies tested
- [ ] Database backups verified

## 📚 Additional Resources

- **Supabase Documentation**: https://supabase.com/docs
- **SQL Tutorial**: https://www.w3schools.com/sql/
- **Row Level Security**: https://supabase.com/docs/guides/auth/row-level-security
- **Supabase Auth**: https://supabase.com/docs/guides/auth

## 🆘 Need Help?

If you encounter issues:

1. **Check Supabase Status**: https://status.supabase.com/
2. **Browse Documentation**: https://supabase.com/docs
3. **Community Support**: https://github.com/supabase/supabase/discussions
4. **Discord Community**: https://discord.supabase.com/

---

**Next Steps**: After completing this setup, proceed to the main README.md for running the application!
