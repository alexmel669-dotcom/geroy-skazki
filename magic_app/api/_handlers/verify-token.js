import { setCors } from '../_middleware/cors.js';
import { isChildIdentity, verifyAuth } from '../_middleware/auth.js';
import { findUser } from '../_lib/users.js';
import { getEffectivePlan } from '../_lib/promocodes.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');
  let user;
  try {
    user = await verifyAuth(req);
  } catch {
    return res.status(503).json({ valid: false, error: 'Session verification unavailable' });
  }

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
      parentName: profile?.parentName || profile?.username || null,
      role: isChildIdentity(user) ? 'child' : profile?.role || user.role || 'user',
      plan,
      planExpiry: profile?.planExpiry || null,
      promocodeUsed: profile?.promocodeUsed || null,
      promoCode: profile?.promoCode || null,
      maxChildren: profile?.maxChildren || null
    }
  });
}
