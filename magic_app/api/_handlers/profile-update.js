import { setCors } from '../_middleware/cors.js';
import { requireParentPin } from '../_middleware/parent-pin.js';
import { findUser, updateChildProfile } from '../_lib/users.js';
import { getEffectivePlan } from '../_lib/promocodes.js';


function publicProfile(profile) {
  if (!profile) return null;
  return {
    username: profile.username || profile.email,
    parentName: profile.parentName || profile.username || null,
    childName: profile.childName || profile.children?.[0]?.name || null,
    childAge: profile.childAge ?? profile.children?.[0]?.age ?? null,
    children: (profile.children || []).map(({ id, name, age, gender, birthday, avatar, avatarRole, index }) =>
      ({ id, name, age, gender, birthday, avatar, avatarRole, index })),
    concerns: profile.concerns || [],
    plan: getEffectivePlan(profile),
    planExpiry: profile.planExpiry || null,
    promocodeUsed: profile.promocodeUsed || null
  };
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const user = await requireParentPin(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const profile = await findUser(user.email);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ success: true, user: publicProfile(profile) });

  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const updated = await updateChildProfile(user.email, req.body || {});
    return res.status(200).json({ success: true, user: publicProfile(updated) });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Update failed' });
  }
}
