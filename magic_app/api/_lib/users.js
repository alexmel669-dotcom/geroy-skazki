import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const USERS_KEY = 'geroy:users';
const USER_PREFIX = 'geroy:user:';
const DIALOGS_PREFIX = 'geroy:dialogs:';

// Получить всех пользователей (индекс)
export async function getAllUsers() {
  const users = await redis.get(USERS_KEY);
  return users || {};
}

// Найти пользователя по email
export async function findUser(email) {
  const key = USER_PREFIX + email.toLowerCase();
  const user = await redis.get(key);
  return user || null;
}

// Сохранить пользователя
export async function saveUser(email, userData) {
  const key = USER_PREFIX + email.toLowerCase();
  const normalizedEmail = email.toLowerCase();

  const user = {
    ...userData,
    email: normalizedEmail,
    updatedAt: new Date().toISOString()
  };

  await redis.set(key, user);

  const users = await getAllUsers();
  users[normalizedEmail] = {
    username: userData.username,
    plan: userData.plan || 'free',
    createdAt: userData.createdAt || new Date().toISOString(),
    lastLoginAt: userData.lastLoginAt || new Date().toISOString()
  };
  await redis.set(USERS_KEY, users);

  return user;
}

// Проверить существование
export async function userExists(email) {
  const key = USER_PREFIX + email.toLowerCase();
  return Boolean(await redis.exists(key));
}

// Удалить пользователя
export async function deleteUser(email) {
  const key = USER_PREFIX + email.toLowerCase();
  await redis.del(key);

  const users = await getAllUsers();
  delete users[email.toLowerCase()];
  await redis.set(USERS_KEY, users);
}

// Сохранить диалог
export async function saveDialog(email, dialog) {
  const key = DIALOGS_PREFIX + email.toLowerCase();
  const dialogs = (await redis.get(key)) || [];

  dialogs.push({
    ...dialog,
    timestamp: new Date().toISOString()
  });

  if (dialogs.length > 100) {
    dialogs.shift();
  }

  await redis.set(key, dialogs);
  return dialogs;
}

// Получить диалоги
export async function getDialogs(email) {
  const key = DIALOGS_PREFIX + email.toLowerCase();
  return (await redis.get(key)) || [];
}

// Статистика для админки
export async function getAdminStats() {
  const users = await getAllUsers();
  const userList = Object.values(users);

  const totalUsers = userList.length;
  const activeToday = userList.filter(u => {
    return u.lastLoginAt && new Date(u.lastLoginAt) > new Date(Date.now() - 86400000);
  }).length;

  const plans = {};
  userList.forEach(u => {
    plans[u.plan || 'free'] = (plans[u.plan || 'free'] || 0) + 1;
  });

  return {
    totalUsers,
    activeToday,
    plans,
    updatedAt: new Date().toISOString()
  };
}

export async function updateChildProfile(email, data) {
  const user = await findUser(email);
  if (!user) return null;

  user.childName = data.childName || user.childName;
  user.childAge = data.childAge != null ? data.childAge : user.childAge;

  if (Array.isArray(data.concerns) && data.concerns.length) {
    user.concerns = [...new Set([...(user.concerns || []), ...data.concerns])];
  }

  return saveUser(email, user);
}

export function getPartOfDayFromDate(d = new Date()) {
  const h = d.getHours();
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export async function saveDialogWithTime(email, dialog) {
  const now = new Date();
  const enriched = {
    ...dialog,
    timestamp: dialog.timestamp || now.toISOString(),
    timeOfDay: dialog.timeOfDay || getPartOfDayFromDate(now),
    dayOfWeek: dialog.dayOfWeek || now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
    date: dialog.date || now.toLocaleDateString('ru-RU'),
    hour: dialog.hour != null ? dialog.hour : now.getHours()
  };
  return saveDialog(email, enriched);
}

export async function getWeeklyStats(email, childName = null) {
  const dialogs = await getDialogs(email);
  const weekAgo = Date.now() - 7 * 86400000;
  let recent = dialogs.filter((d) => new Date(d.timestamp).getTime() > weekAgo);

  if (childName) {
    recent = recent.filter((d) => {
      if (!d.childName) return true;
      return d.childName === childName;
    });
  }

  const totalChats = recent.filter((d) => d.role === 'child' || d.role === 'user').length;
  const totalStories = recent.filter((d) => d.type === 'story').length;
  const moods = recent.map((d) => d.mood).filter(Boolean);
  const moodSummary = moods.length
    ? (moods.filter((m) => m === 'positive').length > moods.length / 2 ? 'позитивное' : 'спокойное')
    : 'нет данных';

  return {
    totalChats,
    totalStories,
    moodSummary,
    stars: totalChats + totalStories
  };
}

export async function getWeeklyStatsAllChildren(email) {
  const user = await findUser(email);
  if (!user) return [];

  const children = user.children?.length
    ? user.children
    : [{ name: user.childName || 'ребёнок', age: user.childAge }];

  const results = [];
  for (const child of children) {
    const stats = await getWeeklyStats(email, child.name);
    results.push({
      name: child.name,
      age: child.age,
      gender: child.gender || null,
      ...stats
    });
  }
  return results;
}
