import { setCors } from '../_middleware/cors.js';
import { isValidAdminToken } from '../_lib/admin-token.js';
import { deleteUser, findUser } from '../_lib/users.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isValidAdminToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await findUser(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  await deleteUser(email);
  return res.status(200).json({ success: true, message: 'User deleted' });
}
