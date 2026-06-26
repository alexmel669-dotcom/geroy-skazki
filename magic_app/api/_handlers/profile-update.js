import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { findUser, updateChildProfile } from '../_lib/users.js';
import { getEffectivePlan } from '../_lib/promocodes.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const profile = await findUser(user.email);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({
      success: true,
      user: {
        username: profile.username || user.email,
        parentName: profile.parentName || profile.username || null,
        childName: profile.childName || profile.children?.[0]?.name || null,
        childAge: profile.childAge ?? profile.children?.[0]?.age ?? null,
        children: profile.children || [],
        concerns: profile.concerns || [],
        plan: getEffectivePlan(profile),
        planExpiry: profile.planExpiry || null,
        promocodeUsed: profile.promocodeUsed || null
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const updated = await updateChildProfile(user.email, req.body || {});
    return res.status(200).json({ success: true, user: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Update failed' });
  }
}
