const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Regular client for auth operations
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client for confirming users
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register with email and password (auto-verified for development)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: User's password (minimum 8 characters)
 *             required:
 *               - email
 *               - password
 *     responses:
 *       201:
 *         description: Registration successful with JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     verified:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid input or user already exists
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Use Supabase Auth for registration
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: undefined, // Disable email confirmation
        data: {
          email_confirmed: true // Mark as confirmed immediately
        }
      }
    });

    console.log('Supabase signup response:', { data, error }); // Debug log

    if (error) {
      console.error('Supabase registration error:', error);
      
      // Handle specific duplicate email errors
      if (error.message && (
        error.message.toLowerCase().includes('already') || 
        error.message.toLowerCase().includes('duplicate') ||
        error.message.toLowerCase().includes('exists') ||
        error.status === 422
      )) {
        return res.status(400).json({ error: 'Email already exists. Please use a different email or try logging in.' });
      }
      
      return res.status(400).json({ error: error.message });
    }

    // Check if this is actually a new user or existing user
    if (data.user) {
      // Check if profile already exists for this user ID
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (existingProfile) {
        return res.status(400).json({ error: 'Email already exists. Please use a different email or try logging in.' });
      }
    }

    // Create profile entry
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: data.user.id,
            verified: true, // Auto-verify for development
            created_at: new Date().toISOString()
          }
        ]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }
    }

    // Use Supabase's session token instead of generating our own
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (sessionError || !sessionData.session) {
      console.error('Session creation error after registration:', sessionError);
      return res.status(500).json({ error: 'Failed to create session after registration' });
    }

    console.log(`✅ User registered successfully: ${email}`);

    res.status(201).json({
      message: 'Registration successful',
      token: sessionData.session.access_token, // Use Supabase's JWT token
      user: {
        id: data.user.id,
        email: data.user.email,
        verified: true
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Use Supabase Auth for login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error('Supabase login error:', error);
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    if (!data.user || !data.session) {
      return res.status(400).json({ error: 'Login failed' });
    }

    console.log(`✅ User logged in successfully: ${email}`);

    res.json({
      message: 'Login successful',
      token: data.session.access_token, // Use Supabase's JWT token
      user: {
        id: data.user.id,
        email: data.user.email,
        verified: true
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /auth/verify:
 *   post:
 *     summary: Verify JWT token and return user info
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     verified:
 *                       type: boolean
 *       401:
 *         description: Invalid or expired token
 */
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Also check if token was sent in body (from frontend API)
    if (req.body && req.body.token) {
      // Use body token if available (from frontend API proxy)
      const bodyToken = req.body.token;
      
      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(bodyToken);

      if (error || !user) {
        console.error('Supabase JWT verification error:', error?.message || 'No user found');
        return res.status(401).json({ error: 'Invalid token' });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          verified: true
        }
      });
      return;
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Supabase JWT verification error:', error?.message || 'No user found');
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        verified: true
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Token verification failed' });
  }
});

module.exports = router;
