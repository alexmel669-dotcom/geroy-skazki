import { setCors } from '../_middleware/cors.js';
import { verifyAdmin } from '../_middleware/auth.js';
import { getAllUsers } from '../_lib/users.js';
import { getAnalyticsStats } from '../_lib/analytics-store.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const users = getAllUsers();
  const analytics = getAnalyticsStats();
  const dayAgo = Date.now() - 86400000;

  const activeToday = users.filter(u => u.lastLoginAt && new Date(u.lastLoginAt).getTime() >= dayAgo).length;

  const ageBuckets = { '3-6': 0, '7-10': 0, '11-14': 0 };
  let totalChildren = 0;
  users.forEach(u => {
    (u.children || []).forEach(c => {
      totalChildren++;
      const age = c.age || 5;
      if (age <= 6) ageBuckets['3-6']++;
      else if (age <= 10) ageBuckets['7-10']++;
      else ageBuckets['11-14']++;
    });
  });

  return res.status(200).json({
    totalUsers: users.length,
    activeToday,
    totalChildren,
    totalDialogs: analytics.totalEvents,
    alertDialogs: analytics.alertEvents,
    ageBuckets,
    topGames: analytics.topGames,
    topCharacters: analytics.topCharacters,
    eventsLast24h: analytics.eventsLast24h
  });
}
