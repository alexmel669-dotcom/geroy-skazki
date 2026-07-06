import { setCors } from '../_middleware/cors.js';
import { isValidAdminToken } from '../_lib/admin-token.js';
import { setFeedbackAdminReply } from '../_lib/feedbacks.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isValidAdminToken(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { index, reply } = req.body || {};
    if (index == null || !String(reply || '').trim()) {
      return res.status(400).json({ error: 'index and reply required' });
    }
    await setFeedbackAdminReply(Number(index), String(reply).trim().slice(0, 500));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Admin feedback reply error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
