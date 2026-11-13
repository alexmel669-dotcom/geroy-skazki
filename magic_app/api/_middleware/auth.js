import { isValidAdminToken } from '../_lib/admin-token.js';
import jwt from 'jsonwebtoken';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error('JWT_SECRET is not set');
    }
    return 'dev-secret-key';
  }
  return secret;
}

export function getTokenFromRequest(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  if (match?.[1]) return match[1];
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.replace('Bearer ', '');
  return null;
}

export function verifyAuth(req) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

export function verifyAdmin(req) {
  // Legacy family JWTs may contain an admin role assigned by public signup.
  // Only the dedicated administrator login credential grants admin access.
  return isValidAdminToken(req) ? { role: 'admin' } : null;
}

// Shared parent-only guard; legacy parent role 'user' remains supported.
export function isChildIdentity(identity) {
  return identity?.role === 'child' || identity?.mode === 'child';
}
export function requireParent(req, res) {
  const identity = verifyAuth(req);
  if (!identity?.email) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return null;
  }
  if (isChildIdentity(identity)) {
    res.status(403).json({ error: 'Только для родителя' });
    return null;
  }
  return identity;
}
