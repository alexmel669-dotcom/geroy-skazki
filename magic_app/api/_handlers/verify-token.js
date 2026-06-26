import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { findUser } from '../_lib/users.js';
import { getEffectivePlan } from '../_lib/promocodes.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const user = verifyAuth(req);

  if (!user) {
    return res.status(401).json({ valid: false, error: 'Invalid token' });
  }

  const profile = await findUser(user.email);
  const plan = profile ? getEffectivePlan(profile) : (user.plan || 'free');

  return res.status(200).json({
    valid: true,
    user: {
      email: user.email,
      username: user.username || user.email,
      role: user.role,
      plan,
      planExpiry: profile?.planExpiry || null,
      promocodeUsed: profile?.promocodeUsed || null
    }
  });
}
