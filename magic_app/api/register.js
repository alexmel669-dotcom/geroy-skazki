import { setCors } from './_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from './_middleware/rate-limit.js';
import { createUser } from './_lib/users.js';
import { setAuthCookie } from './_lib/cookies.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './_middleware/auth.js';

const MIN_AGE = 3;
const MAX_AGE = 14;

function normalizeChildren(children) {
  if (!Array.isArray(children)) return [];
  return children.slice(0, 3).map((child, index) => {
    const gender = child.gender === 'female' ? 'female' : 'male';
    const avatar = gender === 'female' ? 'kid2' : 'kid1';
    const age = Math.min(MAX_AGE, Math.max(MIN_AGE, parseInt(child.age, 10) || 5));
    return {
      name: String(child.name || '').trim(),
      age,
      gender,
      avatar,
      avatarRole: avatar,
      index
    };
  }).filter(c => c.name);
}

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
    const { email, password, children } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedChildren = normalizeChildren(children);
    for (const child of normalizedChildren) {
      if (child.age < MIN_AGE || child.age > MAX_AGE) {
        return res.status(400).json({ error: `Age must be between ${MIN_AGE} and ${MAX_AGE}` });
      }
    }

    const user = await createUser(email.trim().toLowerCase(), password, {
      children: normalizedChildren
    });
    if (!user) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const token = jwt.sign(
      { email: user.email, userId: user.email, role: user.role || 'user' },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      token,
      user: {
        email: user.email,
        role: user.role || 'user',
        children: user.children || []
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
