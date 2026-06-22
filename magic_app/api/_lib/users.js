import { hashPassword, verifyPassword } from './crypto.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const USERS_DIR = process.env.VERCEL ? '/tmp' : join(process.cwd(), '.data');
const USERS_FILE = join(USERS_DIR, 'geroy-users.json');

function loadStore() {
  if (!globalThis.__geroyUsers) {
    globalThis.__geroyUsers = new Map();
    try {
      if (existsSync(USERS_FILE)) {
        const data = JSON.parse(readFileSync(USERS_FILE, 'utf8'));
        for (const [email, user] of Object.entries(data)) {
          globalThis.__geroyUsers.set(email, user);
        }
      }
    } catch (err) {
      console.warn('Could not load users file:', err.message);
    }
  }
  return globalThis.__geroyUsers;
}

function persistStore(store) {
  try {
    mkdirSync(USERS_DIR, { recursive: true });
    writeFileSync(USERS_FILE, JSON.stringify(Object.fromEntries(store)));
  } catch (err) {
    console.warn('Could not persist users file:', err.message);
  }
}

export async function createUser(email, password) {
  const store = loadStore();
  const normalizedEmail = email.trim().toLowerCase();
  if (store.has(normalizedEmail)) return null;
  const user = {
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };
  store.set(normalizedEmail, user);
  persistStore(store);
  return user;
}

export async function findUser(email) {
  return loadStore().get(email.trim().toLowerCase()) || null;
}

export async function validateCredentials(email, password) {
  const user = loadStore().get(email.trim().toLowerCase());
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}
