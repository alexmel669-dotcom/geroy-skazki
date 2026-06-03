import { setCors } from './_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from './_middleware/rate-limit.js';
import jwt from 'jsonwebtoken';

const users = new Map();

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 3)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (users.has(email)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    users.set(email, { email, password, createdAt: new Date().toISOString() });

    const token = jwt.sign(
      { email, userId: email },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '7d' }
    );

    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`);
    
    return res.status(201).json({ 
      success: true,
      token,
      user: { email }
    });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
