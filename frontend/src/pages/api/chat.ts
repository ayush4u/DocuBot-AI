import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage } from 'http';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Forward the request to the backend as-is
    const backendUrl = `${BACKEND_URL}/api/chat`;

    // Create headers object, filtering out problematic ones
    const headers: Record<string, string> = {};
    Object.keys(req.headers).forEach(key => {
      const value = req.headers[key];
      if (key !== 'host' && typeof value === 'string') {
        headers[key] = value;
      }
    });

    // Read the request body
    const chunks: Buffer[] = [];
    const incomingReq = req as IncomingMessage;

    for await (const chunk of incomingReq) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks);

    // Create a new request to forward to backend
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: body.length > 0 ? body : undefined,
    });

    // Get the response as text first to handle both JSON and other formats
    const responseText = await backendResponse.text();

    // Try to parse as JSON, but handle cases where it's not JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      // If it's not JSON, return the text as an error message
      responseData = { error: responseText || 'Backend returned non-JSON response' };
    }

    res.status(backendResponse.status).json(responseData);
  } catch (error) {
    console.error('API proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Backend connection failed', details: errorMessage });
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable Next.js body parsing to handle FormData
  },
};
