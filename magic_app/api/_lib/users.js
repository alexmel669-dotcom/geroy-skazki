import { createHash, randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const USERS_KEY = 'geroy:users';
const USER_PREFIX = 'geroy:user:';
const DIALOGS_PREFIX = 'geroy:dialogs:';
const snapshots = new WeakMap();
const accountKey = (email) => USER_PREFIX + email.toLowerCase();
const generationKey = (email) => 'geroy:session-generation:' + email.toLowerCase();
const revokedKey = (token) => 'geroy:revoked-session:' + createHash('sha256').update(token.slice(0, token.lastIndexOf('.'))).digest('hex');

export function getSessionGeneration(email) {
  return redis.get(generationKey(email));
}

export function sessionGenerationOf(user) {
  return snapshots.get(user).generation;
}

export function isSessionRevoked(token) {
  return redis.get(revokedKey(token));
}

export async function revokeSession(token, expiry) {
  const seconds = expiry - Math.floor(Date.now() / 1000);
  if (seconds > 0) await redis.set(revokedKey(token), 'revoked', { ex: seconds });
}

export function reservePinAttempt(email) {
  return redis.eval(`
    local count = tonumber(redis.call('GET', KEYS[1]) or '0')
    if count >= 3 then return {0, redis.call('TTL', KEYS[1])} end
    count = redis.call('INCR', KEYS[1])
    if count == 1 then redis.call('EXPIRE', KEYS[1], 300) end
    return {count, 0}
  `, ['geroy:pin-attempts:' + email.toLowerCase()], []);
}

export async function resetUserPassword(email, user, passwordHash) {
  return redis.eval(`
    local raw = redis.call('GET', KEYS[1])
    if not raw then return 0 end
    local user = cjson.decode(raw)
    if user.passwordHash ~= ARGV[1] or user.secretAnswerHash ~= ARGV[2]
      or (redis.call('GET', KEYS[2]) or '') ~= ARGV[5] then return 0 end
    -- Preserve arrays in the stored JSON by replacing just the password string.
    local updated, count = string.gsub(raw, '"passwordHash"%s*:%s*"[^"]*"', function()
      return '"passwordHash":' .. cjson.encode(ARGV[3])
    end, 1)
    if count ~= 1 or cjson.decode(updated).passwordHash ~= ARGV[3] then return 0 end
    redis.call('SET', KEYS[1], updated)
    redis.call('SET', KEYS[2], ARGV[4])
    return 1
  `, [accountKey(email), generationKey(email)],
  [user.passwordHash, user.secretAnswerHash, passwordHash, randomUUID(), snapshots.get(user).generation ?? '']);
}

// Получить всех пользователей (индекс)
export async function getAllUsers() {
  const users = await redis.get(USERS_KEY);
  return users || {};
}

// Найти пользователя по email
export async function findUser(email) {
  const [user, generation] = await redis.mget(accountKey(email), generationKey(email));
  if (user) snapshots.set(user, { generation });
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

  const snapshot = snapshots.get(userData);
  if (snapshot) {
    const saved = await redis.eval(`
      if redis.call('EXISTS', KEYS[1]) == 0
        or (redis.call('GET', KEYS[2]) or '') ~= ARGV[1] then return 0 end
      redis.call('SET', KEYS[1], ARGV[2])
      return 1
    `, [key, generationKey(email)], [snapshot.generation ?? '', JSON.stringify(user)]);
    if (!saved) throw new Error('Account changed during update');
  } else {
    await redis.set(key, user);
  }

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
export async function deleteUser(email, expectedGeneration) {
  const deleted = await redis.eval(`
    if ARGV[2] == '1' and (redis.call('GET', KEYS[2]) or '') ~= ARGV[3] then return 0 end
    redis.call('SET', KEYS[2], ARGV[1])
    redis.call('DEL', KEYS[3])
    return redis.call('DEL', KEYS[1])
  `, [accountKey(email), generationKey(email), DIALOGS_PREFIX + email.toLowerCase()], [randomUUID(), expectedGeneration === undefined ? '0' : '1', expectedGeneration ?? '']);
  if (!deleted) return false;

  const users = await getAllUsers();
  delete users[email.toLowerCase()];
  await redis.set(USERS_KEY, users);
  return true;
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
