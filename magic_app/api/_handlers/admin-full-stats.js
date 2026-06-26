import { setCors } from '../_middleware/cors.js';
import { buildFullStats } from './admin-stats.js';
import { isValidAdminToken } from '../_lib/admin-token.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  if (!isValidAdminToken(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const stats = await buildFullStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Admin full-stats error:', error);
    return res.status(500).json({ error: 'Ошибка получения статистики' });
  }
}
