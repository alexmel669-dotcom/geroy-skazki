import { setCors } from './_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from './_middleware/rate-limit.js';
import { createUser } from './_lib/users.js';
import { setAuthCookie } from './_lib/cookies.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './_middleware/auth.js';

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

    const user = await createUser(email.trim().toLowerCase(), password);
    if (!user) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const token = jwt.sign(
      { email: user.email, userId: user.email },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      token,
      user: { email: user.email }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
