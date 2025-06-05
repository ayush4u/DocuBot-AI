const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify Supabase JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('Supabase JWT verification error:', error?.message || 'No user found');
      return res.status(401).json({ error: `invalid JWT: ${error?.message || 'unable to verify token'}` });
    }
    
    // Add user info to request object
    req.user = {
      userId: user.id,
      email: user.email,
      id: user.id
    };
    next();
  } catch (err) {
    console.error('JWT verification error:', err);
    return res.status(401).json({ error: `invalid JWT: ${err.message}` });
  }
};

// Optional middleware (allows both authenticated and anonymous users)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        req.user = {
          userId: user.id,
          email: user.email,
          id: user.id
        };
      }
    } catch (err) {
      // Silently ignore errors for optional auth
      console.log('Optional auth failed:', err.message);
    }
  }
  
  // Continue regardless of token validity
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth
};
