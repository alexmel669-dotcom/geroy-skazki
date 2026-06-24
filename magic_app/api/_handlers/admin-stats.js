import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { verifyAdmin } from '../_middleware/auth.js';
import { getAllUsers, findUser } from '../_lib/users.js';
import { getEffectivePlan } from '../_lib/promocodes.js';
import { getAnalyticsStats } from '../_lib/analytics-store.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

function dayKey(date) {
  return date.toISOString().split('T')[0];
}

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

function shortLabel(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

export async function getDetailedStats() {
  const usersIndex = await getAllUsers();
  const emails = Object.keys(usersIndex);
  const userList = [];

  for (const email of emails) {
    const full = await findUser(email);
    if (full) userList.push(full);
    else userList.push({ ...usersIndex[email], email });
  }

  const now = new Date();
  const dayAgo = Date.now() - 86400000;
  const weekAgo = Date.now() - 604800000;
  const monthAgo = Date.now() - 2592000000;

  const dau = userList.filter((u) => u.lastLoginAt && new Date(u.lastLoginAt).getTime() > dayAgo).length;
  const mau = userList.filter((u) => u.lastLoginAt && new Date(u.lastLoginAt).getTime() > monthAgo).length;
  const newThisWeek = userList.filter((u) => u.createdAt && new Date(u.createdAt).getTime() > weekAgo).length;

  let totalVisitors = 0;
  try {
    totalVisitors = Number(await redis.get('geroy:analytics:visitors')) || 0;
  } catch {
    totalVisitors = 0;
  }

  const conversion = totalVisitors > 0
    ? Number(((userList.length / totalVisitors) * 100).toFixed(1))
    : 0;

  const analytics = getAnalyticsStats();
  const characterUsage = Object.fromEntries(analytics.topCharacters || []);
  const gameUsage = Object.fromEntries(analytics.topGames || []);

  const plans = { free: 0, basic: 0, family: 0 };
  userList.forEach((u) => {
    const plan = getEffectivePlan(u);
    plans[plan] = (plans[plan] || 0) + 1;
  });

  const days = lastNDays(7);
  const dauByDay = days.map((date) => ({
    date,
    label: shortLabel(date),
    count: userList.filter((u) => u.lastLoginAt && u.lastLoginAt.startsWith(date)).length
  }));

  const registrationsByDay = days.map((date) => ({
    date,
    label: shortLabel(date),
    count: userList.filter((u) => u.createdAt && u.createdAt.startsWith(date)).length
  }));

  let totalChildren = 0;
  const ageBuckets = { '3-6': 0, '7-10': 0, '11-14': 0 };
  userList.forEach((u) => {
    (u.children || []).forEach((c) => {
      totalChildren++;
      const age = c.age || 5;
      if (age <= 6) ageBuckets['3-6']++;
      else if (age <= 10) ageBuckets['7-10']++;
      else ageBuckets['11-14']++;
    });
  });

  return {
    dau,
    mau,
    total: userList.length,
    totalUsers: userList.length,
    activeToday: dau,
    newThisWeek,
    conversion,
    avgSession: '12 мин',
    characterUsage,
    gameUsage,
    plans,
    dauByDay,
    registrationsByDay,
    totalChildren,
    totalDialogs: analytics.totalEvents,
    alertDialogs: analytics.alertEvents,
    ageBuckets,
    topGames: analytics.topGames,
    topCharacters: analytics.topCharacters,
    eventsLast24h: analytics.eventsLast24h,
    updatedAt: now.toISOString()
  };
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не разрешён' });
  }

  const admin = verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const stats = await getDetailedStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ error: 'Ошибка получения статистики' });
  }
}
