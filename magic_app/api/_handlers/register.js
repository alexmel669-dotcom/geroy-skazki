import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';
import { createUser, userExists } from '../_lib/users.js';
import { setAuthCookie } from '../_lib/cookies.js';
import { logAuthError } from '../_lib/auth-log.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../_middleware/auth.js';

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
  }).filter((c) => c.name);
}

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
  if (!checkRateLimit(key, 5)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const username = (req.body.username || req.body.email || '').trim().toLowerCase();
    const { password, gender, age, children } = req.body;

    if (!username || !password) {
      logAuthError('register', 'Missing username or password');
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      logAuthError('register', 'Password too short', { details: username });
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (userExists(username)) {
      logAuthError('register', 'User already exists', { details: username });
      return res.status(409).json({ error: 'User already exists' });
    }

    const normalizedChildren = normalizeChildren(children);
    for (const child of normalizedChildren) {
      if (child.age < MIN_AGE || child.age > MAX_AGE) {
        return res.status(400).json({ error: `Age must be between ${MIN_AGE} and ${MAX_AGE}` });
      }
    }

    const user = await createUser(username, password, {
      gender: gender || null,
      age: age != null ? parseInt(age, 10) : null,
      children: normalizedChildren
    });

    if (!user) {
      logAuthError('register', 'createUser returned null', { details: username });
      return res.status(409).json({ error: 'User already exists' });
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      token,
      user: {
        email: user.email,
        username: user.username,
        role: user.role || 'user',
        plan: user.plan || 'free',
        children: user.children || []
      }
    });
  } catch (error) {
    logAuthError('register', error.message, { details: error.stack });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
