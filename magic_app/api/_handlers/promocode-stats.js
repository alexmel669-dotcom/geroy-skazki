import { setCors } from '../_middleware/cors.js';
import { getPromoStats } from '../_lib/promo-counter.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.query?.code || 'FOUNDERS';
  const stats = await getPromoStats(code);
  return res.json(stats);
}
