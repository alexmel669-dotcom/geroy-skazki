import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';
import { findUser, updateUser } from '../_lib/users.js';
import { verify } from '../_lib/crypto.js';
import { setAuthCookie } from '../_lib/cookies.js';
import { logAuthError } from '../_lib/auth-log.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../_middleware/auth.js';

function signToken(user) {
  return jwt.sign(
    {
      username: user.username || user.email,
      email: user.email,
      userId: user.email,
      role: user.role || 'user',
      plan: user.plan || 'free'
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 10)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const username = (req.body?.username || req.body?.email || '').trim().toLowerCase();

  try {
    const { password } = req.body;

    if (!username || !password) {
      logAuthError('login', 'Missing credentials');
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await findUser(username);
    if (!user) {
      logAuthError('login', 'User not found', { details: username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!verify(password, user.passwordHash)) {
      logAuthError('login', 'Invalid password', { details: username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    updateUser(username, { lastLoginAt: new Date().toISOString() });

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      token,
      user: {
        email: user.email,
        username: user.username || user.email,
        role: user.role || 'user',
        plan: user.plan || 'free',
        children: user.children || []
      }
    });
  } catch (error) {
    logAuthError('login', error.message, { details: username });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
