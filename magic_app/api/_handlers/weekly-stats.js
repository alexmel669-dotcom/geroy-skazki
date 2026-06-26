import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { findUser, getWeeklyStats } from '../_lib/users.js';

function mapMood(moodSummary) {
  if (moodSummary === 'позитивное') return 'happy';
  if (moodSummary === 'спокойное') return 'neutral';
  return 'neutral';
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  const decoded = verifyAuth(req);
  if (!decoded?.email) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const user = await findUser(decoded.email);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const weekStats = await getWeeklyStats(decoded.email);
    const childName = user.children?.[user.activeChildIndex ?? 0]?.name
      || user.children?.[0]?.name
      || user.childName
      || 'ребёнок';

    return res.status(200).json({
      ...weekStats,
      mood: mapMood(weekStats.moodSummary),
      childName,
      parentName: user.parentName || user.username || 'родитель',
      concerns: user.concerns || []
    });
  } catch (error) {
    console.error('weekly-stats error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
