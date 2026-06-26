import { setCors } from '../_middleware/cors.js';
import { getAdminApiToken } from '../_lib/admin-token.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';

function getAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim() || 'admin@geroy-skazki.local';
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || 'admintuti13';
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = `admin-login:${getRateLimitKey(req)}`;
  if (!checkRateLimit(key, 5, 300000)) {
    return res.status(429).json({ error: 'Too many attempts' });
  }

  const { email, password } = req.body || {};
  if (email === getAdminEmail() && password === getAdminPassword()) {
    return res.status(200).json({ token: getAdminApiToken() });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}
