import { setCors } from '../_middleware/cors.js';
import { Redis } from '@upstash/redis';
import { sanitizeText } from '../_lib/sanitize.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      const raw = req.url || '';
      const game = new URL(raw, 'http://localhost').searchParams.get('game') || 'runner';
      const scores = (await redis.get(`geroy:leaderboard:${game}`)) || [];
      return res.status(200).json(Array.isArray(scores) ? scores.slice(0, 10) : []);
    }

    if (req.method === 'POST') {
      const { game, score, name } = req.body || {};
      const key = `geroy:leaderboard:${game || 'runner'}`;
      const scores = (await redis.get(key)) || [];
      const list = Array.isArray(scores) ? [...scores] : [];
      // P0-2 fix: имя игрока раньше сохранялось как есть и вставлялось во фронтенде
      // в innerHTML без экранирования — хранимый XSS в таблице лидеров.
      const safeName = sanitizeText(name, 30) || 'Аноним';
      list.push({ name: safeName, score: parseInt(score, 10) || 0, date: new Date().toISOString() });
      list.sort((a, b) => b.score - a.score);
      await redis.set(key, list.slice(0, 100));
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.warn('Leaderboard error:', err.message);
    if (req.method === 'GET') return res.status(200).json([]);
    return res.status(200).json({ success: false });
  }
}
