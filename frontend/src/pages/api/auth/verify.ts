import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const authHeaderString = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    console.log('Frontend verify - Auth header:', authHeaderString ? 'Present' : 'Missing');
    console.log('Frontend verify - All headers:', Object.keys(req.headers));
    
    if (!authHeaderString || !authHeaderString.startsWith('Bearer ')) {
      console.log('Frontend verify - No token provided');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeaderString.substring(7); // Remove 'Bearer ' prefix
    console.log('Frontend verify - Token length:', token.length);
    console.log('Frontend verify - Token starts with:', token.substring(0, 50) + '...');
    console.log('Frontend verify - Token ends with:', token.substring(token.length - 50) + '...');

    const response = await fetch(`${BACKEND_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    console.log('Frontend verify - Backend response status:', response.status);
    const data = await response.json();
    console.log('Frontend verify - Backend response:', data);

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Verification API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
