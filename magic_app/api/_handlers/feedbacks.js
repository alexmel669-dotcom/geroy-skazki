import { setCors } from '../_middleware/cors.js';
import {
  getPublicFeedbacks,
  savePublicFeedback
} from '../_lib/feedbacks.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method === 'GET') {
    const query = new URL(req.url || '', 'http://localhost').searchParams;
    if (query.get('public') === '1') {
      const feedbacks = await getPublicFeedbacks(5);
      return res.status(200).json(feedbacks);
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'POST') {
    try {
      const { name, role, rating, text } = req.body || {};
      const stars = parseInt(rating, 10) || 5;
      if (!String(text || '').trim()) {
        return res.status(400).json({ error: 'Text required' });
      }
      await savePublicFeedback({
        name: String(name || 'Аноним').trim().slice(0, 80),
        role: String(role || 'parent').slice(0, 40),
        rating: Math.min(5, Math.max(1, stars)),
        text: String(text).trim().slice(0, 1000),
        approved: true
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Feedbacks POST error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
