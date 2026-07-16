import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { verifyAdmin } from '../_middleware/auth.js';
import { getAllUsers, findUser, getDialogs } from '../_lib/users.js';
import { getEffectivePlan } from '../_lib/promocodes.js';
import { getPromoStats, PROMO_LIMIT } from '../_lib/promo-counter.js';
import { getAnalyticsStats } from '../_lib/analytics-store.js';
import { getRecentFeedbacks } from '../_lib/feedbacks.js';

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

async function getRedisEvents() {
  try {
    const events = await redis.get('geroy:analytics:events');
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

export async function buildFullStats() {
  const base = await getDetailedStats();
  const usersIndex = await getAllUsers();
  const userList = [];

  for (const email of Object.keys(usersIndex)) {
    const full = await findUser(email);
    if (full) userList.push(full);
  }

  const now = new Date();
  const today = dayKey(now);
  const nowMs = now.getTime();
  const dau = userList.filter((u) => u.lastLoginAt && new Date(u.lastLoginAt) > new Date(nowMs - 86400000)).length;
  const mau = userList.filter((u) => u.lastLoginAt && new Date(u.lastLoginAt) > new Date(nowMs - 2592000000)).length;
  const newToday = userList.filter((u) => u.createdAt?.startsWith(today)).length;

  let dialogsToday = 0;
  try {
    const redisEvents = await getRedisEvents();
    dialogsToday = redisEvents.filter((e) => {
      const ts = e.timestamp || '';
      const day = ts.split('T')[0];
      return day === today && (e.type === 'dialog' || e.name === 'dialog');
    }).length;
    if (!dialogsToday) {
      dialogsToday = Number(await redis.get('geroy:dialogs:count:' + today)) || 0;
    }
  } catch {
    dialogsToday = 0;
  }

  const children = [];
  userList.forEach((u) => {
    const kids = u.children?.length
      ? u.children
      : (u.childName ? [{ name: u.childName, age: u.childAge, gender: u.gender }] : []);

    kids.forEach((c) => {
      children.push({
        name: c.name || '—',
        age: c.age ?? '—',
        gender: c.gender || u.gender || '—',
        parentEmail: u.email || '—',
        parentName: u.parentName || u.username || '—',
        plan: getEffectivePlan(u),
        lastLogin: u.lastLoginAt?.split('T')[0] || '—',
        streak: u.streak || u.retention?.count || 0
      });
    });
  });
  children.sort((a, b) => (b.streak || 0) - (a.streak || 0));

  const gameUsage = { ...base.gameUsage };
  userList.forEach((u) => {
    if (u.gameHistory) u.gameHistory.forEach((g) => {
      const key = typeof g === 'string' ? g : (g.game || g.id || g.name || 'unknown');
      gameUsage[key] = (gameUsage[key] || 0) + 1;
    });
  });
  (base.topGames || []).forEach(([name, count]) => {
    gameUsage[name] = (gameUsage[name] || 0) + count;
  });

  const timeOfDay = { morning: 0, day: 0, evening: 0, night: 0 };
  for (const u of userList) {
    const dialogs = await getDialogs(u.email);
    dialogs.forEach((d) => {
      const part = d.timeOfDay || 'day';
      if (timeOfDay[part] !== undefined) timeOfDay[part]++;
    });
  }

  const registrationsByDay = {};
  const loginsByDay = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    registrationsByDay[key] = userList.filter((u) => u.createdAt?.startsWith(key)).length;
    loginsByDay[key] = userList.filter((u) => u.lastLoginAt?.startsWith(key)).length;
  }

  const suspicious = userList.filter((u) => {
    const hasChildren = (u.children?.length > 0) || u.childName;
    return !hasChildren;
  });

  const streakLeaders = children
    .filter((c) => c.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 10);

  const feedbacks = await getRecentFeedbacks(20);

  const redisEvents = await getRedisEvents();
  const lastActions = redisEvents.slice(-10).reverse().map((e) => ({
    type: e.type || e.name || 'event',
    child: e.child || e.data || '',
    timestamp: e.timestamp || ''
  }));

  const foundersUsers = userList.filter((u) => String(u.promocodeUsed || '').toUpperCase() === 'FOUNDERS').length;
  let promoConversion = 0;
  try {
    const promo = await getPromoStats('FOUNDERS');
    promoConversion = PROMO_LIMIT > 0
      ? Number(((promo.used / PROMO_LIMIT) * 100).toFixed(1))
      : 0;
  } catch {
    promoConversion = userList.length > 0
      ? Number(((foundersUsers / userList.length) * 100).toFixed(1))
      : 0;
  }

  return {
    total: userList.length,
    dau,
    mau,
    dialogsToday,
    newToday,
    newThisWeek: base.newThisWeek,
    plans: base.plans,
    children,
    gameUsage,
    timeOfDay,
    registrationsByDay,
    loginsByDay,
    avgSessionMinutes: 12,
    suspiciousCount: suspicious.length,
    streakLeaders,
    feedbacks,
    lastActions,
    promoConversion,
    totalChildren: base.totalChildren,
    updatedAt: now.toISOString()
  };
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

  const query = new URL(req.url || '', 'http://localhost').searchParams;
  if (query.get('public') === '1') {
    try {
      const users = await getAllUsers();
      return res.status(200).json({ total: Object.keys(users).length });
    } catch (error) {
      console.error('Public stats error:', error);
      return res.status(200).json({ total: 0 });
    }
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
