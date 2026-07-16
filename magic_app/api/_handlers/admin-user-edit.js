import { setCors } from '../_middleware/cors.js';
import { isValidAdminToken } from '../_lib/admin-token.js';
import { findUser, saveUser } from '../_lib/users.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isValidAdminToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email, parentName, username, plan } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await findUser(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (parentName !== undefined) user.parentName = parentName;
  if (username !== undefined) user.username = username;
  if (plan !== undefined) user.plan = plan;

  await saveUser(email, user);
  return res.status(200).json({
    success: true,
    user: { email: user.email, username: user.username, parentName: user.parentName, plan: user.plan }
  });
}
