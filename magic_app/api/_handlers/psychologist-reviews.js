import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { getQuery, redis } from '../_lib/psychologist-access.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      const query = getQuery(req);
      const psychologistEmail = String(query.psychologistEmail || '').trim().toLowerCase();
      if (!psychologistEmail) {
        return res.status(400).json({ error: 'psychologistEmail required' });
      }

      const reviews = asArray(await redis.get(`geroy:psychologist:${psychologistEmail}:reviews`));
      return res.status(200).json(reviews);
    }

    if (req.method === 'POST') {
      const auth = verifyAuth(req);
      if (!auth?.email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { psychologistEmail, parentEmail, parentName, rating, text } = req.body || {};
      const psyEmail = String(psychologistEmail || '').trim().toLowerCase();
      const parent = String(parentEmail || auth.email).trim().toLowerCase();
      const stars = Number(rating);

      if (!psyEmail) {
        return res.status(400).json({ error: 'psychologistEmail required' });
      }
      if (!stars || stars < 1 || stars > 5) {
        return res.status(400).json({ error: 'Rating 1-5 required' });
      }
      if (parent !== String(auth.email).toLowerCase()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const review = {
        id: Date.now().toString(36),
        psychologistEmail: psyEmail,
        parentEmail: parent,
        parentName: String(parentName || '').trim() || parent.split('@')[0],
        rating: stars,
        text: String(text || '').trim().slice(0, 1000),
        createdAt: new Date().toISOString()
      };

      const key = `geroy:psychologist:${psyEmail}:reviews`;
      const reviews = asArray(await redis.get(key));
      reviews.push(review);
      await redis.set(key, reviews);

      return res.status(201).json({ success: true, review });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('psychologist-reviews error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
