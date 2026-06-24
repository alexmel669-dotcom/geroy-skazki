import { hashPassword, verify } from './crypto.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const USERS_DIR = process.env.VERCEL ? '/tmp' : join(process.cwd(), '.data');
const USERS_FILE = join(USERS_DIR, 'geroy-users.json');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@geroy-skazki.local')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function readUsersFile() {
  try {
    if (existsSync(USERS_FILE)) {
      return JSON.parse(readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('Could not load users file:', err.message);
  }
  return {};
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function loadStore() {
  if (!globalThis.users) {
    globalThis.users = new Map();
    const data = readUsersFile();
    for (const [key, user] of Object.entries(data)) {
      const id = normalizeUsername(user.username || user.email || key);
      globalThis.users.set(id, { ...user, username: id, email: user.email || id });
    }
  }
  return globalThis.users;
}

export function reloadUsersFromDisk() {
  globalThis.users = null;
  return loadStore();
}

function persistStore(store) {
  try {
    mkdirSync(USERS_DIR, { recursive: true });
    const obj = {};
    for (const [key, user] of store.entries()) {
      obj[key] = user;
    }
    writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.warn('Could not persist users file:', err.message);
  }
}

function resolveRole(username) {
  return ADMIN_EMAILS.includes(username) ? 'admin' : 'user';
}

export function userExists(username) {
  const id = normalizeUsername(username);
  if (loadStore().has(id)) return true;
  const data = readUsersFile();
  return Boolean(data[id]);
}

export function saveUser(user) {
  const store = loadStore();
  const id = normalizeUsername(user.username || user.email);
  const record = { ...user, username: id, email: user.email || id };
  store.set(id, record);
  persistStore(store);
  return record;
}

export async function findUser(username) {
  const id = normalizeUsername(username);
  let user = loadStore().get(id);
  if (!user) {
    reloadUsersFromDisk();
    user = loadStore().get(id);
  }
  if (!user) {
    const data = readUsersFile();
    if (data[id]) {
      user = { ...data[id], username: id, email: data[id].email || id };
      saveUser(user);
    }
  }
  return user || null;
}

export async function createUser(username, password, extra = {}) {
  const id = normalizeUsername(username);
  if (userExists(id)) return null;

  const user = {
    username: id,
    email: id,
    passwordHash: hashPassword(password),
    role: extra.role || resolveRole(id),
    plan: extra.plan || 'free',
    gender: extra.gender || null,
    age: extra.age ?? null,
    children: Array.isArray(extra.children) ? extra.children : [],
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
  return saveUser(user);
}

export function updateUser(username, updates) {
  const id = normalizeUsername(username);
  const store = loadStore();
  const user = store.get(id);
  if (!user) return null;
  Object.assign(user, updates);
  store.set(id, user);
  persistStore(store);
  return user;
}

export async function validateCredentials(username, password) {
  const user = await findUser(username);
  if (!user?.passwordHash) return null;
  if (!verify(password, user.passwordHash)) return null;
  return user;
}

export function getAllUsers() {
  return Array.from(loadStore().values());
}

export function getUsersMap() {
  return loadStore();
}
