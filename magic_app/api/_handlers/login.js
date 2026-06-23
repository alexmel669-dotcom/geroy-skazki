import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';
import { validateCredentials, updateUser } from '../_lib/users.js';
import { setAuthCookie } from '../_lib/cookies.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../_middleware/auth.js';

async function logLoginError(email, reason) {
  console.error(`[LOGIN FAIL] ${email}: ${reason}`);
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 5)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const email = req.body?.email?.trim().toLowerCase();

  try {
    const { password } = req.body;

    if (!email || !password) {
      await logLoginError(email || 'unknown', 'missing credentials');
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await validateCredentials(email, password);
    if (!user) {
      await logLoginError(email, 'invalid credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    updateUser(email, { lastLoginAt: new Date().toISOString() });

    const token = jwt.sign(
      { email: user.email, userId: user.email, role: user.role || 'user' },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      token,
      user: {
        email: user.email,
        role: user.role || 'user',
        children: user.children || []
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    await logLoginError(email || 'unknown', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
