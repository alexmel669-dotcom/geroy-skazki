import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const user = verifyAuth(req);

  if (!user) {
    return res.status(401).json({ valid: false, error: 'Invalid token' });
  }

  return res.status(200).json({
    valid: true,
    user: {
      email: user.email,
      username: user.username || user.email,
      role: user.role,
      plan: user.plan || 'free'
    }
  });
}
