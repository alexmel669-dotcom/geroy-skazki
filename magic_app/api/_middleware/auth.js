import jwt from 'jsonwebtoken';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('JWT_SECRET is not set in production');
  }
  return secret || 'dev-secret-key';
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
  const user = verifyAuth(req);
  if (!user || user.role !== 'admin') return null;
  return user;
}
