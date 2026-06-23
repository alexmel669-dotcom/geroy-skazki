import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const kind = req.apiRoute === 'user/sync' ? 'profile' : 'child';
  console.log(`💾 Sync (${kind}) from:`, user.email);

  return res.status(200).json({ success: true });
}
