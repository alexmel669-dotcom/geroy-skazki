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
