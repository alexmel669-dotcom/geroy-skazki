import { verifyAuth } from './auth.js';
import { checkRateLimit, getRateLimitKey } from './rate-limit.js';

export function applyAiRateLimit(req, res, { authMax, anonMax, windowMs = 60000 }) {
  const user = verifyAuth(req);
  const key = user?.email ? `user:${user.email}` : getRateLimitKey(req);
  const max = user ? authMax : anonMax;

  if (!checkRateLimit(key, max, windowMs)) {
    res.status(429).json({ error: 'Too many requests' });
    return { allowed: false, user };
  }

  return { allowed: true, user };
}
