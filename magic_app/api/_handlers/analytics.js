import { setCors } from '../_middleware/cors.js';
import { appendEvents, getAnalyticsStats } from '../_lib/analytics-store.js';
import { verifyAdmin } from '../_middleware/auth.js';
import { getAllUsers, getAdminStats, findUser } from '../_lib/users.js';

async function handleHealth(req, res) {
  const yandexKey = process.env.YANDEX_API_KEY?.trim();
  const yandexFolder = process.env.YANDEX_FOLDER_ID?.trim();
  return res.status(200).json({
    ok: true,
    version: '4.5.0',
    node: process.version,
    env: {
      jwt: Boolean(process.env.JWT_SECRET?.trim()),
      kv: Boolean(process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim()),
      yandexKey: Boolean(yandexKey),
      yandexFolder: Boolean(yandexFolder),
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY?.trim())
    },
    yandexKeyLength: yandexKey ? yandexKey.length : 0,
    timestamp: new Date().toISOString()
  });
}

async function handleLogError(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { context, message, timestamp, appVersion } = req.body || {};
    console.error(`📋 [ERROR LOG] ${timestamp} | ${context} | v${appVersion}`);
    console.error(`   ${message}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Log error handler failed:', error);
    return res.status(500).json({ error: 'Logging failed' });
  }
}

async function handleAdminStats(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }
  const admin = verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const stats = await getAdminStats();
    const analytics = getAnalyticsStats();
    const usersIndex = await getAllUsers();

    const ageBuckets = { '3-6': 0, '7-10': 0, '11-14': 0 };
    let totalChildren = 0;
    for (const email of Object.keys(usersIndex)) {
      const user = await findUser(email);
      (user?.children || []).forEach((c) => {
        totalChildren++;
        const age = c.age || 5;
        if (age <= 6) ageBuckets['3-6']++;
        else if (age <= 10) ageBuckets['7-10']++;
        else ageBuckets['11-14']++;
      });
    }

    return res.status(200).json({
      totalUsers: stats.totalUsers,
      activeToday: stats.activeToday,
      plans: stats.plans,
      totalChildren,
      totalDialogs: analytics.totalEvents,
      alertDialogs: analytics.alertEvents,
      ageBuckets,
      topGames: analytics.topGames,
      topCharacters: analytics.topCharacters,
      eventsLast24h: analytics.eventsLast24h,
      updatedAt: stats.updatedAt
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ error: 'Ошибка получения статистики' });
  }
}

async function handleAnalyticsPost(req, res) {
  const { events } = req.body || {};
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Events array required' });
  }
  appendEvents(events);
  console.log(`📊 Analytics: ${events.length} events stored`);
  return res.status(200).json({ success: true, processed: events.length });
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const route = req.apiRoute || 'analytics';

  try {
    if (route === 'health') return handleHealth(req, res);
    if (route === 'log-error') return handleLogError(req, res);
    if (route === 'admin/stats') return handleAdminStats(req, res);

    if (req.method === 'POST') return handleAnalyticsPost(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
