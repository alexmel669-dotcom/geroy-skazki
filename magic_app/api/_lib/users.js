import { hashPassword, verifyPassword } from './crypto.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const USERS_DIR = process.env.VERCEL ? '/tmp' : join(process.cwd(), '.data');
const USERS_FILE = join(USERS_DIR, 'geroy-users.json');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@geroy-skazki.local')
  .split(',')
  .map(e => e.trim().toLowerCase())
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

function loadStore() {
  if (!globalThis.__geroyUsers) {
    globalThis.__geroyUsers = new Map();
    const data = readUsersFile();
    for (const [email, user] of Object.entries(data)) {
      globalThis.__geroyUsers.set(email, user);
    }
  }
  return globalThis.__geroyUsers;
}

export function reloadUsersFromDisk() {
  globalThis.__geroyUsers = null;
  return loadStore();
}

function persistStore(store) {
  try {
    mkdirSync(USERS_DIR, { recursive: true });
    writeFileSync(USERS_FILE, JSON.stringify(Object.fromEntries(store), null, 2));
  } catch (err) {
    console.warn('Could not persist users file:', err.message);
  }
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function resolveRole(email) {
  return ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
}

export async function createUser(email, password, extra = {}) {
  const store = loadStore();
  const normalizedEmail = normalizeEmail(email);
  if (store.has(normalizedEmail)) return null;

  const children = Array.isArray(extra.children) ? extra.children : [];
  const user = {
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role: extra.role || resolveRole(normalizedEmail),
    children,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
  store.set(normalizedEmail, user);
  persistStore(store);
  return user;
}

export async function findUser(email) {
  const normalized = normalizeEmail(email);
  let store = loadStore();
  let user = store.get(normalized);
  if (!user) {
    store = reloadUsersFromDisk();
    user = store.get(normalized);
  }
  return user || null;
}

export function updateUser(email, updates) {
  const store = loadStore();
  const normalized = normalizeEmail(email);
  const user = store.get(normalized);
  if (!user) return null;
  Object.assign(user, updates);
  store.set(normalized, user);
  persistStore(store);
  return user;
}

export async function validateCredentials(email, password) {
  const normalized = normalizeEmail(email);
  let user = await findUser(normalized);
  if (!user?.passwordHash) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export function getAllUsers() {
  return Array.from(loadStore().values());
}

export function getUsersMap() {
  return loadStore();
}
