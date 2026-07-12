// ============================================================
// Worker: geroy-skazki-api v6.0.1
// Cloudflare Worker (nodejs_compat) — all Vercel API routes
// ============================================================

import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const VERSION = 'v6.0.1';
const PROMO_LIMIT = 100;
const USERS_KEY = 'geroy:users';
const USER_PREFIX = 'geroy:user:';
const DIALOGS_PREFIX = 'geroy:dialogs:';
const FEEDBACK_KEY = 'geroy:feedbacks';
const THANKS_KEY = 'geroy:thanks';
const ANALYTICS_EVENTS_KEY = 'geroy:analytics:events';
const ADMIN_EMAILS = ['admin@geroy-skazki.local'];

const PROMOCODES = {
  TESTER2026: { plan: 'basic', days: 30 },
  FAMILYTEST: { plan: 'family', days: 14 },
  PSYCHOLOGIST: { plan: 'basic', days: 90 },
  FRIENDLYCAT: { plan: 'basic', days: 7 },
  FOUNDERS: { plan: 'basic', days: 30 }
};

const SECRET_QUESTIONS = {
  pet: 'Кличка вашего первого питомца?',
  city: 'Город, в котором вы родились?',
  mother: 'Девичья фамилия мамы?'
};

const MIN_AGE = 3;
const MAX_AGE = 14;

// ============ ENV / CORS ============

function sanitizeEnvValue(value) {
  return String(value || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
}

function normalizeRedisUrl(raw) {
  let url = sanitizeEnvValue(raw);
  if (!url) return '';
  url = url.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

function getRedisConfig(env) {
  const url = normalizeRedisUrl(env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_URL);
  const token = sanitizeEnvValue(env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || env.UPSTASH_REDIS_TOKEN);
  return { url, token };
}

function getJwtSecret(env) {
  const secret = sanitizeEnvValue(env.JWT_SECRET);
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

function getAdminApiToken(env) {
  const raw = sanitizeEnvValue(env.ADMIN_API_TOKEN) || 'admin-token-v5.0.5';
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
}

function isValidAdminToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  return auth === getAdminApiToken(env);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders() });
}

function getApiRoute(pathname) {
  return pathname.replace(/^\/api\/?/, '').replace(/\/$/, '') || 'health';
}

function getTokenFromRequest(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  if (match?.[1]) return match[1];
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  if (auth) return auth;
  return null;
}

// ============ REDIS ============

async function redisGet(env, key) {
  const { url, token } = getRedisConfig(env);
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  let result = data.result;
  if (typeof result === 'string') { try { result = JSON.parse(result); } catch {} }
  return result;
}

async function redisSet(env, key, value) {
  const { url, token } = getRedisConfig(env);
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  return res.json();
}

async function redisIncr(env, key) {
  const { url, token } = getRedisConfig(env);
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisExists(env, key) {
  const { url, token } = getRedisConfig(env);
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/exists/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result === 1;
}

async function redisDel(env, key) {
  const { url, token } = getRedisConfig(env);
  if (!url || !token) throw new Error('Redis not configured');
  const res = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.result;
}

// ============ JWT ============

async function signJwt(payload, secret, expiresInDays = 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInDays * 86400 };
  const encoder = new TextEncoder();
  const b64Header = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const b64Payload = btoa(JSON.stringify(fullPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const toSign = `${b64Header}.${b64Payload}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64Header}.${b64Payload}.${b64Sig}`;
}

async function verifyJwt(token, secret) {
  try {
    const [header, payload, sig] = token.split('.');
    const encoder = new TextEncoder();
    const toVerify = `${header}.${payload}`;
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(toVerify));
    if (!valid) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch { return null; }
}

async function verifyAuth(request, env) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyJwt(token, getJwtSecret(env));
}

// ============ PASSWORD (dual: scrypt Vercel + SHA-256 legacy) ============

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return password === stored;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  if (hashHex.length === 128) {
    const hashVerify = scryptSync(password, salt, 64).toString('hex');
    try {
      return timingSafeEqual(Buffer.from(hashHex, 'hex'), Buffer.from(hashVerify, 'hex'));
    } catch { return false; }
  }
  if (hashHex.length === 64) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const computedHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHex === hashHex;
  }
  return false;
}

// ============ USERS ============

async function getAllUsers(env) {
  return (await redisGet(env, USERS_KEY)) || {};
}

async function findUser(env, email) {
  return (await redisGet(env, USER_PREFIX + email.toLowerCase())) || null;
}

async function saveUser(env, email, userData) {
  const normalizedEmail = email.toLowerCase();
  const user = { ...userData, email: normalizedEmail, updatedAt: new Date().toISOString() };
  await redisSet(env, USER_PREFIX + normalizedEmail, user);
  const users = await getAllUsers(env);
  users[normalizedEmail] = {
    username: userData.username,
    plan: userData.plan || 'free',
    createdAt: userData.createdAt || new Date().toISOString(),
    lastLoginAt: userData.lastLoginAt || new Date().toISOString()
  };
  await redisSet(env, USERS_KEY, users);
  return user;
}

async function userExists(env, email) {
  return redisExists(env, USER_PREFIX + email.toLowerCase());
}

async function getDialogs(env, email) {
  return (await redisGet(env, DIALOGS_PREFIX + email.toLowerCase())) || [];
}

async function saveDialog(env, email, dialog) {
  const key = DIALOGS_PREFIX + email.toLowerCase();
  const dialogs = (await redisGet(env, key)) || [];
  dialogs.push({ ...dialog, timestamp: new Date().toISOString() });
  if (dialogs.length > 100) dialogs.shift();
  await redisSet(env, key, dialogs);
  return dialogs;
}

async function updateChildProfile(env, email, data) {
  const user = await findUser(env, email);
  if (!user) return null;
  user.childName = data.childName || user.childName;
  user.childAge = data.childAge != null ? data.childAge : user.childAge;
  if (Array.isArray(data.concerns) && data.concerns.length) {
    user.concerns = [...new Set([...(user.concerns || []), ...data.concerns])];
  }
  if (data.children !== undefined) user.children = data.children;
  if (data.gender !== undefined) user.gender = data.gender;
  if (data.age !== undefined) user.age = data.age;
  return saveUser(env, email, user);
}

async function getWeeklyStats(env, email, childName = null) {
  const dialogs = await getDialogs(env, email);
  const weekAgo = Date.now() - 7 * 86400000;
  let recent = dialogs.filter(d => new Date(d.timestamp).getTime() > weekAgo);
  if (childName) recent = recent.filter(d => !d.childName || d.childName === childName);
  const totalChats = recent.filter(d => d.role === 'child' || d.role === 'user').length;
  const totalStories = recent.filter(d => d.type === 'story').length;
  const moods = recent.map(d => d.mood).filter(Boolean);
  const moodSummary = moods.length
    ? (moods.filter(m => m === 'positive').length > moods.length / 2 ? 'позитивное' : 'спокойное')
    : 'нет данных';
  return { totalChats, totalStories, moodSummary, stars: totalChats + totalStories };
}

async function getWeeklyStatsAllChildren(env, email) {
  const user = await findUser(env, email);
  if (!user) return [];
  const children = user.children?.length ? user.children : [{ name: user.childName || 'ребёнок', age: user.childAge }];
  const results = [];
  for (const child of children) {
    const stats = await getWeeklyStats(env, email, child.name);
    results.push({ name: child.name, age: child.age, gender: child.gender || null, ...stats });
  }
  return results;
}

// ============ PROMOCODES ============

function validatePromocode(code) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  const promo = PROMOCODES[key];
  if (!promo) return null;
  return { code: key, ...promo };
}

function buildPlanFromPromo(promo) {
  const planExpiry = new Date();
  planExpiry.setDate(planExpiry.getDate() + promo.days);
  return { plan: promo.plan, planExpiry: planExpiry.toISOString(), promocodeUsed: promo.code };
}

function getEffectivePlan(user) {
  if (!user?.plan || user.plan === 'free') return 'free';
  if (user.planExpiry && new Date(user.planExpiry) < new Date()) return 'free';
  return user.plan;
}

async function getPromoUsage(env, code) {
  return Number(await redisGet(env, `geroy:promo:${String(code).toUpperCase()}`)) || 0;
}

async function incrementPromoUsage(env, code) {
  return redisIncr(env, `geroy:promo:${String(code).toUpperCase()}`);
}

// ============ SECRET QUESTIONS ============

function getSecretQuestionText(key) {
  return SECRET_QUESTIONS[key] || SECRET_QUESTIONS.pet;
}

function isValidSecretQuestionKey(key) {
  return Object.prototype.hasOwnProperty.call(SECRET_QUESTIONS, key);
}

function normalizeSecretAnswer(answer) {
  return String(answer || '').trim().toLowerCase();
}

function getAgeFromBirthday(birthday) {
  if (!birthday) return null;
  const today = new Date();
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function normalizeChildren(children) {
  if (!Array.isArray(children)) return [];
  return children.slice(0, 3).map((child, index) => {
    const gender = child.gender === 'female' ? 'female' : 'male';
    const avatarRole = gender === 'male' ? 'kid2' : 'kid1';
    const avatar = gender === 'male' ? 'kid2.svg' : 'kid1.svg';
    const birthday = child.birthday || null;
    const ageFromBirthday = getAgeFromBirthday(birthday);
    const age = Math.min(MAX_AGE, Math.max(MIN_AGE, ageFromBirthday ?? (parseInt(child.age, 10) || 5)));
    return { name: String(child.name || '').trim(), age, gender, birthday, avatar, avatarRole, index };
  }).filter(c => c.name);
}

// ============ FEEDBACKS ============

async function readFeedbackArray(env) {
  try {
    const stored = await redisGet(env, FEEDBACK_KEY);
    return Array.isArray(stored) ? stored : [];
  } catch { return []; }
}

async function writeFeedbackArray(env, feedbacks) {
  await redisSet(env, FEEDBACK_KEY, feedbacks.slice(0, 100));
}

async function getRecentFeedbacks(env, limit = 20) {
  return (await readFeedbackArray(env)).slice(0, limit);
}

async function getPublicFeedbacks(env, limit = 5) {
  const all = await readFeedbackArray(env);
  return all.filter(f => f.approved !== false).slice(0, limit);
}

async function saveFeedback(env, entry) {
  const item = { ...entry, date: entry.date || entry.createdAt || new Date().toISOString(), approved: entry.approved !== false };
  const all = await readFeedbackArray(env);
  all.unshift(item);
  await writeFeedbackArray(env, all);
}

async function setFeedbackAdminReply(env, index, reply) {
  const all = await readFeedbackArray(env);
  if (!all[index]) return false;
  all[index].adminReply = reply;
  await writeFeedbackArray(env, all);
  return true;
}

// ============ BASE64 ============

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ============ GENDER-RU ============

function normalizeGender(value) {
  if (value === 'male' || value === 'm') return 'male';
  if (value === 'female' || value === 'f') return 'female';
  return 'unknown';
}

function buildGenderPrompt(gender, childName) {
  const g = normalizeGender(gender);
  const name = childName ? ` (${childName})` : '';
  if (g === 'female') return `Пол ребёнка${name}: ДЕВОЧКА. Обращайся только в ЖЕНСКОМ роде: «ты рада», «ты готова», «ты смелая». В третьем лице — «она».`;
  if (g === 'male') return `Пол ребёнка${name}: МАЛЬЧИК. Обращайся только в МУЖСКОМ роде: «ты рад», «ты готов», «ты смелый». В третьем лице — «он».`;
  return `Пол ребёнка${name} не указан. Используй нейтральные формулировки.`;
}

const TO_CHILD_M2F = [
  [/\bты\s+рад\b/giu, 'ты рада'], [/\bты\s+готов\b/giu, 'ты готова'], [/\bты\s+сказал\b/giu, 'ты сказала'],
  [/\bты\s+поступил\b/giu, 'ты поступила'], [/\bобщался\b/giu, 'общалась'],
  [/\bкак\s+прошёл\s+твой\s+день\b/giu, 'как прошла твой день']
];
const TO_CHILD_F2M = [
  [/\bты\s+рада\b/giu, 'ты рад'], [/\bты\s+готова\b/giu, 'ты готов'], [/\bты\s+сказала\b/giu, 'ты сказал'],
  [/\bты\s+поступила\b/giu, 'ты поступил'], [/\bобщалась\b/giu, 'общался'],
  [/\bкак\s+прошла\s+твой\s+день\b/giu, 'как прошёл твой день']
];

function applyGenderToText(text, gender) {
  if (!text || typeof text !== 'string') return text;
  const g = normalizeGender(gender);
  if (g === 'unknown') return text;
  const rules = g === 'female' ? TO_CHILD_M2F : TO_CHILD_F2M;
  let out = text;
  for (const [re, repl] of rules) out = out.replace(re, repl);
  return out;
}

// ============ GRAMMAR-RU ============

const GRAMMAR_FIXES = [
  [/\bтвой дела\b/gi, 'твои дела'], [/\bтебе люблю\b/gi, 'тебя люблю'],
  [/\bдавай поиграть\b/gi, 'давай поиграем'], [/\bрасскажи меня\b/gi, 'расскажи мне'],
  [/\bкак твой дела\b/gi, 'как твои дела'], [/\bчто ты делает\b/gi, 'что ты делаешь']
];

function getAgeWord(age) {
  const n = parseInt(age, 10);
  if (!Number.isFinite(n)) return 'лет';
  const last = n % 10;
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 14) return 'лет';
  if (last === 1) return 'год';
  if (last >= 2 && last <= 4) return 'года';
  return 'лет';
}

function getCorrectNameForm(name, gender = 'male') {
  if (!name) return { nom: '', dat: '', gen: '' };
  const n = name.trim();
  const last = n.slice(-1);
  const isFemale = gender === 'female' || gender === 'f';
  let dat, gen;
  if (isFemale) {
    if (last === 'а' || last === 'я') { dat = n.slice(0, -1) + 'е'; gen = n.slice(0, -1) + 'и'; }
    else { dat = n + 'е'; gen = n + 'и'; }
  } else if (last === 'а' || last === 'я') { dat = n.slice(0, -1) + 'е'; gen = n.slice(0, -1) + 'и'; }
  else if (last === 'й') { dat = n.slice(0, -1) + 'ю'; gen = n.slice(0, -1) + 'я'; }
  else { dat = n + 'у'; gen = n + 'а'; }
  return { nom: n, dat, gen };
}

function applyGrammarFixes(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;
  for (const [wrong, right] of GRAMMAR_FIXES) cleaned = cleaned.replace(wrong, right);
  return cleaned;
}

// ============ CONTENT-FILTER ============

const FORBIDDEN_WORDS = [
  'бля', 'хуй', 'пизд', 'еба', 'ёб', 'сука', 'мудак', 'дебил',
  'идиот', 'дурак', 'тупой', 'fuck', 'shit', 'damn', 'stupid', 'idiot', 'bitch'
];
const ALLOWED_SLANG = ['круто', 'классно', 'здорово', 'супер', 'огонь', 'топ', 'краш', 'вайб', 'чилить'];

function getAgeBasedTone(age) {
  const a = parseInt(age, 10) || 5;
  if (a <= 7) return 'Говори просто, как с малышом. Короткие предложения, много ласки.';
  if (a <= 10) return 'Говори как с другом. Можно «круто», «здорово», «классно».';
  if (a <= 14) return 'Говори на современном языке. Можно: огонь, топ, вайб, чилить. Нельзя: мат, агрессия.';
  return '';
}

function sanitizeAIText(text, age) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;
  FORBIDDEN_WORDS.forEach(word => {
    cleaned = cleaned.replace(new RegExp(word, 'gi'), '***');
  });
  const childAge = parseInt(age, 10) || 5;
  if (childAge < 11) {
    ALLOWED_SLANG.forEach(word => {
      cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), 'здорово');
    });
  }
  return cleaned;
}

// ============ GENERATE (AI) ============

const GRAMMAR_RULES = `ПРАВИЛА РУССКОГО ЯЗЫКА (соблюдай всегда):
1. Склоняй имена правильно. 2. Используй правильный род. 3. Говори грамотно.
4. Создавай ощущение живого общения — будь тёплым, но грамотным.`;

const CHARACTER_PROMPTS = {
  lucik: 'Ты — Люцик, кот-психолог. Помогаешь советом, мягко выявляешь тревоги.',
  mom: 'Ты — мама. Заботливая, тёплая.',
  dad: 'Ты — папа. Уверенный, поддерживающий.',
  kid1: 'Ты — девочка-подруга. Весёлая, по-дружески.',
  kid2: 'Ты — мальчик-друг. Энергичный, приятель.'
};

const SOFT_FEAR_PROMPT = `Ты — мягкий и добрый собеседник для ребёнка.
НЕ спрашивай прямо про страхи, тревоги или проблемы.
НЕ используй слова «страх», «боишься», «проблема», «тревога».
Вместо этого рассказывай сказки и спрашивай: «А как бы ты поступил?»`;

const CONVERSATION_GUIDE = `Ты — тёплый, заботливый друг ребёнка.
ПРАВИЛА: НИКОГДА не спрашивай прямо про страхи. Используй мягкие подходы через сказки и игры.
Если ребёнок САМ говорит о страхах — выслушай и поддержи.`;

const JSON_FORMAT = `Всегда отвечай ТОЛЬКО валидным JSON без markdown:
{"message":"текст","childName":null или "имя","childAge":null или число,"concerns":null или ["тема"],"mood":"positive|neutral|concerned"}`;

const JSON_FORMAT_CHAT = `Ответь ТОЛЬКО валидным JSON без markdown:
{"message":"текст","childName":null,"childAge":null,"concerns":null,"mood":"positive|neutral|concerned","type":"chat"}`;

const JSON_FORMAT_STORY = `Ответь ТОЛЬКО валидным JSON без markdown:
{"message":"текст сказки","title":"название","childName":null,"childAge":null,"concerns":null,"mood":"positive|neutral|concerned","type":"story"}`;

function getCharacterPrompt(characterId, childAge, childGender) {
  let base = CHARACTER_PROMPTS[characterId] || CHARACTER_PROMPTS.lucik;
  const age = parseInt(childAge, 10);
  if (age >= 11 && (characterId === 'kid1' || characterId === 'kid2')) {
    base += '\n\nГовори современно: "топ", "вайб", "краш". Но не перебарщивай.';
  }
  if (childGender === 'female') base += '\n\nРебёнок — девочка. Используй женский род.';
  else if (childGender === 'male') base += '\n\nРебёнок — мальчик. Используй мужской род.';
  return base;
}

function formatChildAge(childAge) {
  if (!childAge) return '';
  const age = parseInt(childAge, 10);
  if (!Number.isFinite(age)) return '';
  return `, ${age} ${getAgeWord(age)}`;
}

function grammarBlock(childName) {
  return GRAMMAR_RULES.replace(/\{childName\}/g, childName || 'малыш');
}

function nameFormsBlock(childName, childGender) {
  if (!childName) return 'Имя ребёнка пока неизвестно.';
  const g = childGender === 'female' ? 'female' : 'male';
  const forms = getCorrectNameForm(childName, g);
  return `Ребёнок: ${childName} (именительный: ${forms.nom}, дательный: ${forms.dat}, родительный: ${forms.gen})`;
}

function getAgePrompt(childAge) {
  const age = parseInt(childAge, 10);
  if (age >= 11) return `Ты общаешься с подростком ${age} лет. Используй современный язык.`;
  return '';
}

function getChatPrompt(childName, childAge, timeContext, childGender, character = 'lucik') {
  const ctx = timeContext || { time: '', day: '', greeting: '' };
  const postupil = childGender === 'female' ? 'поступила' : 'поступил';
  return `${getCharacterPrompt(character, childAge, childGender)}
${ctx.time}, ${ctx.day}.
${buildGenderPrompt(childGender, childName)}
${grammarBlock(childName)}
${nameFormsBlock(childName, childGender)}
Твоя задача — ПРОСТО ОБЩАТЬСЯ с ребёнком. Ответь коротко (2-4 предложения).
Ребёнок: ${childName || 'малыш'}${formatChildAge(childAge)}.
${CONVERSATION_GUIDE}
${SOFT_FEAR_PROMPT}
${JSON_FORMAT_CHAT}`;
}

function getStoryPrompt(childName, childAge, timeContext, topic, childGender, character = 'lucik') {
  const ctx = timeContext || { time: '', day: '' };
  return `${getCharacterPrompt(character, childAge, childGender)}
${ctx.time}, ${ctx.day}.
${buildGenderPrompt(childGender, childName)}
${grammarBlock(childName)}
Твоя задача — РАССКАЗАТЬ СКАЗКУ. Тема: ${topic || 'волшебное приключение'}.
Ребёнок: ${childName || 'малыш'}${formatChildAge(childAge)}.
${JSON_FORMAT_STORY}`;
}

function getBedtimeStoryPrompt(childName, childAge, timeContext, childGender, character = 'lucik') {
  const ctx = timeContext || { time: '', day: '' };
  return `${getCharacterPrompt(character, childAge, childGender)}
${ctx.time}, ${ctx.day}. Сейчас время сна.
Твоя задача — СКАЗКА НА НОЧЬ. Спокойный ритм, без опасностей.
Ребёнок: ${childName || 'малыш'}${formatChildAge(childAge)}.
${JSON_FORMAT_STORY}`;
}

function getGuestPrompt(childName, childAge) {
  return `Ты — Люцик, добрый кот. Ты ТОЛЬКО ЧТО познакомился с ребёнком.
Спроси имя и возраст. НЕ спрашивай о страхах.
${JSON_FORMAT}`;
}

function getParentPrompt(parentName, children) {
  const childNames = children?.map(c => c.name).join(', ') || 'ребёнок';
  return `Ты — ассистент для родителей. Общаешься с ${parentName || 'родителем'}.
Дети: ${childNames}. Тактичный, взрослый, профессиональный. Без эмодзи.`;
}

function buildSystemPrompt(opts) {
  const { childName, childAge, childGender, character, systemPrompt, topic, isFirstMessage, requestType, timeContext, isGuest, isParent, parentName, children } = opts;
  if (systemPrompt) return systemPrompt;
  if (isParent) return getParentPrompt(parentName, children);
  const charId = character || 'lucik';
  const needsGuestIntro = isGuest && (!childName || !childAge);
  if (needsGuestIntro && requestType !== 'story' && requestType !== 'bedtime_story') return getGuestPrompt(childName, childAge);
  if (requestType === 'bedtime_story') return getBedtimeStoryPrompt(childName, childAge, timeContext, childGender, charId);
  if (requestType === 'story') return getStoryPrompt(childName, childAge, timeContext, topic, childGender, charId);
  if (requestType === 'chat') return getChatPrompt(childName, childAge, timeContext, childGender, charId);
  const age = childAge ? Math.min(14, Math.max(3, parseInt(childAge, 10))) : null;
  const tone = age ? getAgeBasedTone(age) : '';
  const genderHint = childGender === 'female' ? 'Обращайся в женском роде.' : childGender === 'male' ? 'Обращайся в мужском роде.' : '';
  return `${GRAMMAR_RULES}\n\n${getCharacterPrompt(charId, childAge, childGender)}\n\n${nameFormsBlock(childName, childGender)}\n${buildGenderPrompt(childGender, childName)}\n${genderHint}\n${CONVERSATION_GUIDE}\n${SOFT_FEAR_PROMPT}\n${tone}\n${JSON_FORMAT}`;
}

function parseAiJson(raw) {
  try {
    const cleaned = String(raw).replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.message) return parsed;
  } catch {}
  return { message: String(raw || '').trim(), concerns: null, mood: 'neutral' };
}

// ============ ADMIN STATS ============

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
  return new Date(isoDate).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
}

function maskEmail(email) {
  if (!email) return '—';
  return `${(email.split('@')[0] || '').slice(0, 3)}@...`;
}

async function getDetailedStats(env) {
  const usersIndex = await getAllUsers(env);
  const emails = Object.keys(usersIndex);
  const userList = [];
  for (const email of emails) {
    const full = await findUser(env, email);
    userList.push(full || { ...usersIndex[email], email });
  }
  const now = new Date();
  const dayAgo = Date.now() - 86400000;
  const weekAgo = Date.now() - 604800000;
  const monthAgo = Date.now() - 2592000000;
  const dau = userList.filter(u => u.lastLoginAt && new Date(u.lastLoginAt).getTime() > dayAgo).length;
  const mau = userList.filter(u => u.lastLoginAt && new Date(u.lastLoginAt).getTime() > monthAgo).length;
  const newThisWeek = userList.filter(u => u.createdAt && new Date(u.createdAt).getTime() > weekAgo).length;
  const plans = { free: 0, basic: 0, family: 0 };
  userList.forEach(u => { const plan = getEffectivePlan(u); plans[plan] = (plans[plan] || 0) + 1; });
  const days = lastNDays(7);
  const dauByDay = days.map(date => ({
    date, label: shortLabel(date),
    count: userList.filter(u => u.lastLoginAt && u.lastLoginAt.startsWith(date)).length
  }));
  const registrationsByDay = days.map(date => ({
    date, label: shortLabel(date),
    count: userList.filter(u => u.createdAt && u.createdAt.startsWith(date)).length
  }));
  let totalChildren = 0;
  const ageBuckets = { '3-6': 0, '7-10': 0, '11-14': 0 };
  userList.forEach(u => {
    (u.children || []).forEach(c => {
      totalChildren++;
      const age = c.age || 5;
      if (age <= 6) ageBuckets['3-6']++;
      else if (age <= 10) ageBuckets['7-10']++;
      else ageBuckets['11-14']++;
    });
  });
  const totalEvents = Number(await redisGet(env, 'geroy:stats:events')) || 0;
  return {
    dau, mau, total: userList.length, totalUsers: userList.length, activeToday: dau,
    newThisWeek, conversion: 0, avgSession: '12 мин', characterUsage: {}, gameUsage: {},
    plans, dauByDay, registrationsByDay, totalChildren, totalDialogs: totalEvents,
    alertDialogs: 0, ageBuckets, topGames: [], topCharacters: [], eventsLast24h: 0,
    updatedAt: now.toISOString()
  };
}

async function buildFullStats(env) {
  const base = await getDetailedStats(env);
  const usersIndex = await getAllUsers(env);
  const userList = [];
  for (const email of Object.keys(usersIndex)) {
    const full = await findUser(env, email);
    if (full) userList.push(full);
  }
  const now = new Date();
  const today = dayKey(now);
  const nowMs = now.getTime();
  const dau = userList.filter(u => u.lastLoginAt && new Date(u.lastLoginAt) > new Date(nowMs - 86400000)).length;
  const mau = userList.filter(u => u.lastLoginAt && new Date(u.lastLoginAt) > new Date(nowMs - 2592000000)).length;
  const newToday = userList.filter(u => u.createdAt?.startsWith(today)).length;
  let dialogsToday = Number(await redisGet(env, `geroy:dialogs:count:${today}`)) || 0;
  const redisEvents = (await redisGet(env, ANALYTICS_EVENTS_KEY)) || [];
  if (!dialogsToday && Array.isArray(redisEvents)) {
    dialogsToday = redisEvents.filter(e => {
      const ts = e.timestamp || '';
      return ts.split('T')[0] === today && (e.type === 'dialog' || e.name === 'dialog');
    }).length;
  }
  const children = [];
  userList.forEach(u => {
    const kids = u.children?.length ? u.children : (u.childName ? [{ name: u.childName, age: u.childAge, gender: u.gender }] : []);
    kids.forEach(c => {
      children.push({
        name: c.name || '—', age: c.age ?? '—', gender: c.gender || u.gender || '—',
        parentEmail: maskEmail(u.email), plan: getEffectivePlan(u),
        lastLogin: u.lastLoginAt?.split('T')[0] || '—', streak: u.streak || 0
      });
    });
  });
  children.sort((a, b) => (b.streak || 0) - (a.streak || 0));
  const gameUsage = { ...base.gameUsage };
  const timeOfDay = { morning: 0, day: 0, evening: 0, night: 0 };
  for (const u of userList) {
    const dialogs = await getDialogs(env, u.email);
    dialogs.forEach(d => {
      const part = d.timeOfDay || 'day';
      if (timeOfDay[part] !== undefined) timeOfDay[part]++;
    });
    if (u.gameHistory) u.gameHistory.forEach(g => {
      const key = typeof g === 'string' ? g : (g.game || g.id || 'unknown');
      gameUsage[key] = (gameUsage[key] || 0) + 1;
    });
  }
  const registrationsByDay = {};
  const loginsByDay = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    registrationsByDay[key] = userList.filter(u => u.createdAt?.startsWith(key)).length;
    loginsByDay[key] = userList.filter(u => u.lastLoginAt?.startsWith(key)).length;
  }
  const suspicious = userList.filter(u => !(u.children?.length > 0 || u.childName));
  const streakLeaders = children.filter(c => c.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 10);
  const feedbacks = await getRecentFeedbacks(env, 20);
  const lastActions = (Array.isArray(redisEvents) ? redisEvents.slice(-10).reverse() : []).map(e => ({
    type: e.type || e.name || 'event', child: e.child || e.data || '', timestamp: e.timestamp || ''
  }));
  const foundersUsers = userList.filter(u => String(u.promocodeUsed || '').toUpperCase() === 'FOUNDERS').length;
  const promoUsed = await getPromoUsage(env, 'FOUNDERS');
  const promoConversion = PROMO_LIMIT > 0 ? Number(((promoUsed / PROMO_LIMIT) * 100).toFixed(1)) : 0;
  return {
    total: userList.length, dau, mau, dialogsToday, newToday, newThisWeek: base.newThisWeek,
    plans: base.plans, children, gameUsage, timeOfDay, registrationsByDay, loginsByDay,
    avgSessionMinutes: 12, suspiciousCount: suspicious.length, streakLeaders, feedbacks,
    lastActions, promoConversion, totalChildren: base.totalChildren, updatedAt: now.toISOString()
  };
}

// ============ ROUTE HANDLERS ============

async function handleHealth(env) {
  const cfg = getRedisConfig(env);
  return jsonResponse({
    ok: true, version: VERSION, worker: true,
    redis: Boolean(cfg.url && cfg.token),
    yandex: Boolean(sanitizeEnvValue(env.YANDEX_API_KEY)),
    deepseek: Boolean(sanitizeEnvValue(env.DEEPSEEK_API_KEY))
  });
}

async function handleAnalyticsHealth(env) {
  const cfg = getRedisConfig(env);
  return jsonResponse({
    ok: true, version: VERSION, worker: true,
    env: {
      jwt: Boolean(sanitizeEnvValue(env.JWT_SECRET)),
      kv: Boolean(cfg.url && cfg.token),
      yandexKey: Boolean(sanitizeEnvValue(env.YANDEX_API_KEY)),
      yandexFolder: Boolean(sanitizeEnvValue(env.YANDEX_FOLDER_ID)),
      deepseek: Boolean(sanitizeEnvValue(env.DEEPSEEK_API_KEY))
    },
    timestamp: new Date().toISOString()
  });
}

async function handleAnalyticsPost(request, env) {
  const body = await request.json().catch(() => ({}));
  const events = body.events || [body];
  const today = new Date().toISOString().slice(0, 10);
  const stored = (await redisGet(env, ANALYTICS_EVENTS_KEY)) || [];
  for (const evt of events) {
    const type = evt.type || evt.event || evt.name || 'unknown';
    await redisIncr(env, 'geroy:stats:events');
    await redisIncr(env, `geroy:stats:event:${type}`);
    if (type === 'dialog' || type === 'chat') await redisIncr(env, `geroy:dialogs:count:${today}`);
    if (type === 'game_selected' || evt.name === 'game_selected') {
      const game = evt.data?.game || evt.game || 'unknown';
      await redisIncr(env, `geroy:games:${game}`);
    }
    stored.push({ ...evt, timestamp: new Date().toISOString() });
  }
  while (stored.length > 1000) stored.shift();
  await redisSet(env, ANALYTICS_EVENTS_KEY, stored);
  return jsonResponse({ success: true, stored: true, count: stored.length });
}

async function handleLogin(request, env) {
  const body = await request.json();
  const normalizedEmail = (body.email || body.username || '').trim().toLowerCase();
  const { password } = body;
  if (!normalizedEmail || !password) return jsonResponse({ error: 'Email и пароль обязательны' }, 400);
  const user = await findUser(env, normalizedEmail);
  if (!user) return jsonResponse({ error: 'Неверный email или пароль' }, 401);
  const valid = await verifyPassword(password, user.passwordHash || user.password);
  if (!valid) return jsonResponse({ error: 'Неверный email или пароль' }, 401);
  user.lastLoginAt = new Date().toISOString();
  const saved = await saveUser(env, normalizedEmail, user);
  const effectivePlan = getEffectivePlan(saved);
  const token = await signJwt({
    email: saved.email, username: saved.username, userId: saved.email,
    plan: effectivePlan, role: saved.role || 'user'
  }, getJwtSecret(env));
  return jsonResponse({
    success: true, token,
    user: {
      username: saved.username, email: normalizedEmail, plan: effectivePlan,
      planExpiry: saved.planExpiry || null, promocodeUsed: saved.promocodeUsed || null,
      role: saved.role || 'user', parentName: saved.parentName || saved.username,
      gender: saved.gender, age: saved.age, children: saved.children || []
    }
  });
}

async function handleRegister(request, env) {
  const body = await request.json();
  const normalizedEmail = (body.email || body.username || '').trim().toLowerCase();
  const username = String(body.username || normalizedEmail.split('@')[0] || normalizedEmail).trim();
  const { password, gender, age, children, promocode, parentPin, parentName, secretQuestion, secretAnswer } = body;
  if (!normalizedEmail || !password) return jsonResponse({ error: 'Поля username, email, password обязательны' }, 400);
  if (password.length < 6) return jsonResponse({ error: 'Password must be at least 6 characters' }, 400);
  const pinStr = String(parentPin || '').trim();
  if (!/^\d{4}$/.test(pinStr)) return jsonResponse({ error: 'PIN должен состоять из 4 цифр' }, 400);
  const secretKey = String(secretQuestion || '').trim();
  const secretAnswerNorm = normalizeSecretAnswer(secretAnswer);
  if (!isValidSecretQuestionKey(secretKey)) return jsonResponse({ error: 'Выберите секретный вопрос' }, 400);
  if (secretAnswerNorm.length < 2) return jsonResponse({ error: 'Ответ на секретный вопрос слишком короткий' }, 400);
  if (await userExists(env, normalizedEmail)) return jsonResponse({ error: 'Пользователь с таким email уже существует' }, 409);
  const normalizedChildren = normalizeChildren(children);
  for (const child of normalizedChildren) {
    if (child.age < MIN_AGE || child.age > MAX_AGE) return jsonResponse({ error: `Age must be between ${MIN_AGE} and ${MAX_AGE}` }, 400);
  }
  const passwordHash = hashPassword(password);
  const parentPinHash = hashPassword(pinStr);
  const secretAnswerHash = hashPassword(secretAnswerNorm);
  const role = ADMIN_EMAILS.includes(normalizedEmail) ? 'admin' : 'user';
  let plan = 'free', planExpiry = null, promocodeUsed = null, promoMessage = null;
  const promo = validatePromocode(promocode);
  if (promo) {
    if (promo.code === 'FOUNDERS') {
      const used = await getPromoUsage(env, promo.code);
      if (used >= PROMO_LIMIT) return jsonResponse({ error: 'Все 100 мест по промокоду FOUNDERS заняты' }, 400);
    }
    const applied = buildPlanFromPromo(promo);
    plan = applied.plan; planExpiry = applied.planExpiry; promocodeUsed = applied.promocodeUsed;
    promoMessage = `Активирован тариф «${plan}» на ${promo.days} дней!`;
    await incrementPromoUsage(env, promo.code);
  }
  const user = {
    username, email: normalizedEmail, passwordHash, parentPinHash,
    parentName: String(parentName || '').trim() || username,
    pinAttempts: 0, lockedUntil: null, gender: gender || null,
    age: age != null ? parseInt(age, 10) : null, children: normalizedChildren,
    plan, planExpiry, promocodeUsed, role, secretQuestion: secretKey, secretAnswerHash,
    createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString()
  };
  const saved = await saveUser(env, normalizedEmail, user);
  const effectivePlan = getEffectivePlan(saved);
  const token = await signJwt({
    email: saved.email, username: saved.username, userId: saved.email,
    plan: effectivePlan, role
  }, getJwtSecret(env));
  return jsonResponse({
    success: true, token, promoMessage,
    user: {
      username: saved.username, email: normalizedEmail,
      parentName: saved.parentName || username, plan: effectivePlan,
      planExpiry: saved.planExpiry || null, promocodeUsed: saved.promocodeUsed || null,
      role, children: normalizedChildren
    }
  }, 201);
}

async function handleVerifyToken(request, env) {
  const user = await verifyAuth(request, env);
  if (!user) return jsonResponse({ valid: false, error: 'Invalid token' }, 401);
  const profile = await findUser(env, user.email);
  const plan = profile ? getEffectivePlan(profile) : (user.plan || 'free');
  return jsonResponse({
    valid: true,
    user: {
      email: user.email, username: user.username || user.email,
      parentName: profile?.parentName || profile?.username || null,
      role: user.role, plan, planExpiry: profile?.planExpiry || null,
      promocodeUsed: profile?.promocodeUsed || null
    }
  });
}

async function handleLogout() {
  return jsonResponse({ success: true, message: 'Вы вышли' });
}

async function handleGenerate(request, env) {
  const started = Date.now();
  const body = await request.json();
  const message = body.message || body.text;
  const reqType = body.requestType || body.type || 'chat';
  if (!message && !body.image) return jsonResponse({ error: 'Message is required' }, 400);
  const gender = normalizeGender(body.childGender);
  let sys = body.systemPrompt || buildSystemPrompt({
    childName: body.childName, childAge: body.childAge, childGender: gender,
    character: body.character, topic: body.topic, isFirstMessage: body.isFirstMessage,
    requestType: reqType, timeContext: body.timeContext, isGuest: body.isGuest,
    isParent: body.isParent, parentName: body.parentName, children: body.children
  });
  if (reqType === 'draw_guess' && !body.systemPrompt) {
    sys = `Ты помогаешь ребёнку угадать рисунок. Ответь ТОЛЬКО JSON: {"message":"слово"}`;
  }
  const deepseekKey = sanitizeEnvValue(env.DEEPSEEK_API_KEY);
  if (!deepseekKey) {
    const devReply = body.image || reqType === 'draw_guess' ? 'котик'
      : body.childName ? (gender === 'female' ? `Мурр! Рада тебя слышать, ${body.childName}! 🐱` : `Мурр! Рад тебя слышать, ${body.childName}! 🐱`)
      : 'Привет! Я кот Люцик. Как тебя зовут?';
    return jsonResponse({ reply: devReply, childName: null, childAge: null, concerns: null, mood: 'positive', devMode: true, ms: Date.now() - started });
  }
  try {
    const messages = [{ role: 'system', content: sys }];
    if (Array.isArray(body.history)) {
      body.history.slice(-20).forEach(item => {
        if (!item?.content) return;
        messages.push({ role: item.role === 'assistant' || item.role === 'bot' ? 'assistant' : 'user', content: String(item.content).slice(0, 500) });
      });
    }
    messages.push(body.image
      ? { role: 'user', content: [{ type: 'image_url', image_url: { url: body.image } }, { type: 'text', text: message || 'Что нарисовано?' }] }
      : { role: 'user', content: message });
    const maxTokens = (reqType === 'draw_guess' || (body.image && body.systemPrompt)) ? 40 : reqType === 'bedtime_story' ? 550 : reqType === 'story' ? 400 : 100;
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: maxTokens, temperature: 0.85 })
    });
    if (!response.ok) throw new Error(`DeepSeek: ${response.status}`);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty AI response');
    const parsed = parseAiJson(raw);
    const age = body.childAge ? Math.min(14, Math.max(3, parseInt(body.childAge, 10))) : 7;
    const safeMessage = body.systemPrompt
      ? String(parsed.message || raw).trim().split(/\s+/)[0].replace(/[^а-яё-]/gi, '')
      : applyGrammarFixes(applyGenderToText(sanitizeAIText(parsed.message, age), gender));
    return jsonResponse({
      reply: safeMessage, type: parsed.type || reqType || 'chat', title: parsed.title || null,
      childName: parsed.childName || null, childAge: parsed.childAge != null ? parsed.childAge : null,
      concerns: parsed.concerns || null, mood: parsed.mood || 'neutral', ms: Date.now() - started
    });
  } catch (e) {
    return jsonResponse({
      reply: body.image ? 'непонятно' : 'Мурр... Я немного задумался. Давай попробуем ещё раз? 🐱',
      concerns: null, mood: 'neutral', ms: Date.now() - started
    });
  }
}

async function handleTts(request, env) {
  const body = await request.json();
  const { text, voice, speed } = body;
  if (!text) return jsonResponse({ error: 'Text is required' }, 400);
  const voiceMap = { lucik: 'zahar', mom: 'jane', dad: 'ermil', kid1: 'oksana', kid2: 'filipp' };
  const ALLOWED_VOICES = ['zahar', 'alena', 'filipp', 'ermil', 'jane', 'oksana'];
  const mappedVoice = voiceMap[voice] || voice || 'zahar';
  const safeVoice = ALLOWED_VOICES.includes(mappedVoice) ? mappedVoice : 'zahar';
  let yandexKey = sanitizeEnvValue(env.YANDEX_API_KEY);
  const folderId = sanitizeEnvValue(env.YANDEX_FOLDER_ID);
  if (yandexKey.startsWith('Api-Key ')) yandexKey = yandexKey.slice(8).trim();
  if (!yandexKey || !folderId) return jsonResponse({ error: 'TTS not configured', fallback: true }, 503);
  const params = new URLSearchParams({ text, lang: 'ru-RU', voice: safeVoice, folderId, format: 'mp3', sampleRateHertz: '48000' });
  if (speed) params.set('speed', String(speed));
  const authHeader = (yandexKey.startsWith('t1.') || yandexKey.startsWith('y0_')) ? `Bearer ${yandexKey}` : `Api-Key ${yandexKey}`;
  const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!response.ok) return jsonResponse({ error: 'TTS failed', status: response.status, fallback: true }, 503);
  const audioArrayBuffer = await response.arrayBuffer();
  return jsonResponse({ audioUrl: `data:audio/mp3;base64,${arrayBufferToBase64(audioArrayBuffer)}`, format: 'mp3', size: audioArrayBuffer.byteLength });
}

async function handleSpeechToText(request, env) {
  const body = await request.json();
  const { audio } = body;
  if (!audio) return jsonResponse({ error: 'Audio is required' }, 400);
  const yandexKey = sanitizeEnvValue(env.YANDEX_API_KEY);
  const folderId = sanitizeEnvValue(env.YANDEX_FOLDER_ID);
  if (!yandexKey || !folderId) return jsonResponse({ text: '', fallback: true, error: 'STT not configured' }, 503);
  const audioBytes = base64ToBytes(audio);
  if (audioBytes.length < 3200) return jsonResponse({ text: '', error: 'Audio too short', fallback: true }, 400);
  const sampleRateHertz = body.sampleRateHertz || body.sampleRateHz || 16000;
  const sttUrl = `https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?${new URLSearchParams({
    lang: 'ru-RU', folderId, format: 'lpcm', sampleRateHertz: String(sampleRateHertz), topic: 'general', profanityFilter: 'false'
  })}`;
  const response = await fetch(sttUrl, {
    method: 'POST',
    headers: { Authorization: `Api-Key ${yandexKey}`, 'Content-Type': 'application/octet-stream' },
    body: audioBytes
  });
  if (!response.ok) return jsonResponse({ text: '', error: 'Speech recognition failed', fallback: true }, 502);
  const data = await response.json();
  const text = (data.result || '').trim();
  return jsonResponse({ text, audioBytes: audioBytes.length, empty: !text });
}

async function handleAdminStats(request, env, url) {
  if (url.searchParams.get('public') === '1') {
    const users = await getAllUsers(env);
    return jsonResponse({ total: Object.keys(users).length });
  }
  if (!isValidAdminToken(request, env)) {
    const user = await verifyAuth(request, env);
    if (!user || user.role !== 'admin') return jsonResponse({ error: 'Admin access required' }, 403);
  }
  return jsonResponse(await getDetailedStats(env));
}

async function handleAdminFullStats(request, env) {
  if (!isValidAdminToken(request, env)) return jsonResponse({ error: 'Forbidden' }, 403);
  return jsonResponse(await buildFullStats(env));
}

async function handleAdminLogin(request, env) {
  const body = await request.json();
  const adminEmail = sanitizeEnvValue(env.ADMIN_EMAIL) || 'admin@geroy-skazki.local';
  const adminPassword = sanitizeEnvValue(env.ADMIN_PASSWORD) || 'admintuti13';
  if (body.email === adminEmail && body.password === adminPassword) {
    return jsonResponse({ success: true, token: getAdminApiToken(env) });
  }
  return jsonResponse({ error: 'Invalid credentials' }, 401);
}

async function handlePromocode(request, env) {
  const { code } = await request.json();
  const promo = validatePromocode(code);
  if (!promo) return jsonResponse({ valid: false, message: 'Промокод не найден' });
  if (promo.code === 'FOUNDERS') {
    const used = await getPromoUsage(env, promo.code);
    if (used >= PROMO_LIMIT) return jsonResponse({ valid: false, message: 'Все 100 мест по промокоду заняты' });
  }
  const PLAN_NAMES = { basic: 'Базовый', family: 'Семейный', free: 'Бесплатный' };
  return jsonResponse({ valid: true, plan: promo.plan, days: promo.days, message: `Активирован тариф «${PLAN_NAMES[promo.plan] || promo.plan}» на ${promo.days} дней!` });
}

async function handlePromocodeStats(env, url) {
  const code = url.searchParams.get('code') || 'FOUNDERS';
  const normalized = String(code).toUpperCase();
  const used = await getPromoUsage(env, normalized);
  return jsonResponse({ code: normalized, used, remaining: Math.max(0, PROMO_LIMIT - used), limit: PROMO_LIMIT });
}

async function handleVerifyPin(request, env) {
  const decoded = await verifyAuth(request, env);
  if (!decoded?.email) return jsonResponse({ error: 'Требуется авторизация' }, 401);
  if (decoded.role === 'child' || decoded.mode === 'child') return jsonResponse({ error: 'Только для родителя' }, 403);
  const user = await findUser(env, decoded.email);
  if (!user) return jsonResponse({ error: 'Пользователь не найден' }, 404);
  if (user.lockedUntil && Date.now() < user.lockedUntil) {
    return jsonResponse({ error: 'Слишком много попыток', waitSec: Math.ceil((user.lockedUntil - Date.now()) / 1000) }, 429);
  }
  const body = await request.json().catch(() => ({}));
  if (body.checkOnly) {
    return jsonResponse({ success: true, noPin: !user.parentPinHash, pinRequired: Boolean(user.parentPinHash) });
  }
  if (!user.parentPinHash) return jsonResponse({ success: true, noPin: true });
  const pinStr = String(body.pin || '').trim();
  const valid = await verifyPassword(pinStr, user.parentPinHash);
  if (valid) {
    user.pinAttempts = 0; user.lockedUntil = null;
    await saveUser(env, decoded.email, user);
    return jsonResponse({ success: true });
  }
  user.pinAttempts = (user.pinAttempts || 0) + 1;
  const attemptsLeft = Math.max(0, 3 - user.pinAttempts);
  if (user.pinAttempts >= 3) { user.lockedUntil = Date.now() + 300000; user.pinAttempts = 0; }
  await saveUser(env, decoded.email, user);
  return jsonResponse({ error: 'Неверный PIN', attemptsLeft: user.lockedUntil ? 0 : attemptsLeft }, 403);
}

async function handleGetSecretQuestion(request, env, url) {
  let email;
  if (request.method === 'GET') email = url.searchParams.get('email');
  else { const body = await request.json().catch(() => ({})); email = body.email; }
  email = String(email || '').trim().toLowerCase();
  if (!email) return jsonResponse({ error: 'Email обязателен' }, 400);
  const user = await findUser(env, email);
  const question = user?.secretQuestion ? getSecretQuestionText(user.secretQuestion) : SECRET_QUESTIONS.pet;
  return jsonResponse({ question, hasAnswer: Boolean(user?.secretAnswerHash) });
}

async function handleResetPassword(request, env) {
  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  const secretAnswer = body.secretAnswer || body.answer;
  const newPassword = body.newPassword;
  if (!email || !secretAnswer || !newPassword) return jsonResponse({ error: 'Заполните все поля' }, 400);
  if (String(newPassword).length < 6) return jsonResponse({ error: 'Пароль должен быть не менее 6 символов' }, 400);
  const user = await findUser(env, email);
  if (!user) return jsonResponse({ error: 'Пользователь не найден' }, 404);
  if (!user.secretAnswerHash) return jsonResponse({ error: 'Восстановление пароля недоступно' }, 403);
  const normalized = normalizeSecretAnswer(secretAnswer);
  if (!(await verifyPassword(normalized, user.secretAnswerHash))) {
    return jsonResponse({ error: 'Неверный ответ на секретный вопрос' }, 403);
  }
  user.passwordHash = hashPassword(newPassword);
  delete user.password;
  await saveUser(env, email, user);
  return jsonResponse({ success: true, message: 'Пароль изменён' });
}

async function handleProfileUpdate(request, env) {
  const user = await verifyAuth(request, env);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
  if (request.method === 'GET') {
    const profile = await findUser(env, user.email);
    if (!profile) return jsonResponse({ error: 'User not found' }, 404);
    return jsonResponse({
      success: true,
      user: {
        username: profile.username || user.email,
        parentName: profile.parentName || profile.username || null,
        childName: profile.childName || profile.children?.[0]?.name || null,
        childAge: profile.childAge ?? profile.children?.[0]?.age ?? null,
        children: profile.children || [], concerns: profile.concerns || [],
        plan: getEffectivePlan(profile), planExpiry: profile.planExpiry || null,
        promocodeUsed: profile.promocodeUsed || null
      }
    });
  }
  const body = await request.json().catch(() => ({}));
  const updated = await updateChildProfile(env, user.email, body);
  return jsonResponse({ success: true, user: updated });
}

function mapMood(moodSummary) {
  if (moodSummary === 'позитивное') return 'happy';
  return 'neutral';
}

async function handleWeeklyStats(request, env, url) {
  const decoded = await verifyAuth(request, env);
  if (!decoded?.email) return jsonResponse({ error: 'Требуется авторизация' }, 401);
  const user = await findUser(env, decoded.email);
  if (!user) return jsonResponse({ error: 'Пользователь не найден' }, 404);
  const allChildren = url.searchParams.get('all') === '1';
  if (allChildren) {
    const childrenStats = await getWeeklyStatsAllChildren(env, decoded.email);
    return jsonResponse({
      parentName: user.parentName || user.username || 'родитель',
      children: childrenStats.map(c => ({ ...c, mood: mapMood(c.moodSummary), concerns: user.concerns || [] }))
    });
  }
  const weekStats = await getWeeklyStats(env, decoded.email);
  const childName = user.children?.[user.activeChildIndex ?? 0]?.name || user.children?.[0]?.name || user.childName || 'ребёнок';
  return jsonResponse({
    ...weekStats, mood: mapMood(weekStats.moodSummary), childName,
    parentName: user.parentName || user.username || 'родитель', concerns: user.concerns || []
  });
}

async function handleWeeklyDigest(request, env) {
  const decoded = await verifyAuth(request, env);
  if (!decoded?.email) return jsonResponse({ error: 'Требуется авторизация' }, 401);
  const user = await findUser(env, decoded.email);
  if (!user) return jsonResponse({ error: 'Пользователь не найден' }, 404);
  const weekStats = await getWeeklyStats(env, decoded.email);
  const childName = user.children?.[user.activeChildIndex ?? 0]?.name || user.children?.[0]?.name || user.childName || 'ребёнок';
  const parentName = user.parentName || user.username || 'родитель';
  const resendKey = sanitizeEnvValue(env.RESEND_API_KEY);
  if (!resendKey) return jsonResponse({ error: 'Email не отправлен', reason: 'RESEND_API_KEY not set' }, 503);
  const html = `<h2>Привет, ${parentName}!</h2><p>Вот как прошла неделя у ${childName}:</p><ul><li>🗣️ Разговоров: ${weekStats.totalChats}</li><li>🌙 Сказок: ${weekStats.totalStories}</li><li>😊 Настроение: ${weekStats.moodSummary}</li><li>⭐ Звёзд: ${weekStats.stars}</li></ul>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Люцик <lucik.geroy.skazki@gmail.com>', to: [user.email], subject: `${parentName}, отчёт за неделю для ${childName}`, html })
  });
  if (!res.ok) return jsonResponse({ error: 'Email не отправлен', reason: await res.text() }, 503);
  return jsonResponse({ sent: true });
}

async function handleLeaderboard(request, env, url) {
  const game = url.searchParams.get('game') || 'runner';
  if (request.method === 'GET') {
    const scores = (await redisGet(env, `geroy:leaderboard:${game}`)) || [];
    const sorted = (Array.isArray(scores) ? scores : []).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 10);
    return jsonResponse(sorted);
  }
  const body = await request.json();
  const key = `geroy:leaderboard:${body.game || game}`;
  const list = [...((await redisGet(env, key)) || [])];
  list.push({ name: body.name || 'Аноним', score: parseInt(body.score, 10) || 0, date: new Date().toISOString() });
  list.sort((a, b) => b.score - a.score);
  await redisSet(env, key, list.slice(0, 100));
  return jsonResponse({ success: true });
}

async function handleSync(request, env) {
  const user = await verifyAuth(request, env);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
  return jsonResponse({ success: true });
}

async function handleChildToken(request, env, url) {
  const decoded = await verifyAuth(request, env);
  if (!decoded?.email || decoded.role === 'child' || decoded.mode === 'child') {
    return jsonResponse({ error: 'Только для родителя' }, 403);
  }
  const user = await findUser(env, decoded.email);
  if (!user) return jsonResponse({ error: 'Пользователь не найден' }, 404);
  let childIndex = 0;
  if (request.method === 'GET') childIndex = parseInt(url.searchParams.get('child') ?? '0', 10);
  else { const body = await request.json().catch(() => ({})); childIndex = parseInt(body.childIndex ?? '0', 10); }
  const child = user.children?.[childIndex];
  if (!child) return jsonResponse({ error: 'Ребёнок не найден' }, 404);
  const childToken = await signJwt({
    email: decoded.email, parentEmail: decoded.email, childName: child.name,
    childAge: child.age, childGender: child.gender, childAvatar: child.avatar,
    childIndex, plan: user.plan || 'free', mode: 'child', role: 'child'
  }, getJwtSecret(env), 30);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('Host') || 'geroy-skazki.vercel.app';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const childUrl = `${proto}://${host}/app.html?child_token=${encodeURIComponent(childToken)}`;
  return jsonResponse({ url: childUrl, childName: child.name, childIndex, expiresIn: '30d' });
}

async function handlePsychologistHelp(request, env) {
  const user = await verifyAuth(request, env);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
  const body = await request.json().catch(() => ({}));
  const profile = await findUser(env, user.email);
  const concerns = body.concerns || profile?.concerns || [];
  const childName = body.childName || profile?.children?.[0]?.name || profile?.childName || 'ребёнок';
  const childAge = body.childAge ?? profile?.children?.[0]?.age ?? profile?.childAge ?? 7;
  if (!concerns.length) return jsonResponse({ error: 'No concerns to analyze' }, 400);
  const topics = concerns.join(', ');
  const deepseekKey = sanitizeEnvValue(env.DEEPSEEK_API_KEY);
  if (!deepseekKey) {
    return jsonResponse({
      advice: `Темы: ${topics}.\n\nРекомендации:\n• Начните разговор через сказку.\n• Спросите: «А как бы ты поступил?»\n• Избегайте слов «страх», «тревога».`,
      devMode: true
    });
  }
  const systemPrompt = `Ты — деликатный детский психолог-консультант для родителей.\nРебёнок: ${childName}, ${childAge} лет. Темы: ${topics}.\nСоставь МЯГКИЕ рекомендации. Тон — поддерживающий.`;
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Составь рекомендации.' }],
      max_tokens: 600, temperature: 0.7
    })
  });
  if (!response.ok) return jsonResponse({ error: 'Не удалось получить рекомендации' }, 500);
  const data = await response.json();
  const advice = data.choices?.[0]?.message?.content;
  if (!advice) return jsonResponse({ error: 'Не удалось получить рекомендации' }, 500);
  return jsonResponse({ success: true, advice });
}

async function handleNotifyCreator(request, env) {
  const body = await request.json();
  if (!body.message?.trim()) return jsonResponse({ error: 'Message is required' }, 400);
  const thanks = (await redisGet(env, THANKS_KEY)) || [];
  const list = Array.isArray(thanks) ? thanks : [];
  list.unshift({
    type: body.type || 'thanks', message: String(body.message).trim().slice(0, 500),
    userName: body.userName || 'Гость', userAge: body.userAge ?? '?', date: new Date().toISOString()
  });
  await redisSet(env, THANKS_KEY, list.slice(0, 100));
  return jsonResponse({ success: true, total: list.length });
}

async function handleAdminThanks(request, env) {
  if (!isValidAdminToken(request, env)) return jsonResponse({ error: 'Forbidden' }, 403);
  const thanks = (await redisGet(env, THANKS_KEY)) || [];
  return jsonResponse((Array.isArray(thanks) ? thanks : []).slice(0, 20));
}

async function handleAdminFeedbackReply(request, env) {
  if (!isValidAdminToken(request, env)) return jsonResponse({ error: 'Forbidden' }, 403);
  const body = await request.json();
  const { index, reply, id } = body;
  let idx = index;
  if (idx == null && id != null) {
    const all = await readFeedbackArray(env);
    idx = all.findIndex(f => f.id === id);
  }
  if (idx == null || !String(reply || '').trim()) return jsonResponse({ error: 'index and reply required' }, 400);
  await setFeedbackAdminReply(env, Number(idx), String(reply).trim().slice(0, 500));
  return jsonResponse({ success: true });
}

async function handleFeedback(request, env) {
  if (request.method === 'GET') {
    if (!isValidAdminToken(request, env)) return jsonResponse({ error: 'Forbidden' }, 403);
    return jsonResponse({ feedbacks: await getRecentFeedbacks(env, 20) });
  }
  const body = await request.json();
  const stars = parseInt(body.rating, 10);
  if (!stars || stars < 1 || stars > 5) return jsonResponse({ error: 'Rating 1-5 required' }, 400);
  const user = await verifyAuth(request, env);
  await saveFeedback(env, {
    rating: stars, text: String(body.text || '').trim().slice(0, 1000),
    page: String(body.page || '').slice(0, 80),
    email: user?.email ? `${user.email.split('@')[0].slice(0, 3)}@...` : 'guest',
    createdAt: new Date().toISOString()
  });
  let extended = false;
  if (body.requestExtend && stars >= 4 && user?.email) {
    const bonusKey = `geroy:feedback-bonus:${user.email.toLowerCase()}`;
    if (!(await redisExists(env, bonusKey))) {
      const profile = await findUser(env, user.email);
      if (profile) {
        const base = profile.planExpiry ? new Date(profile.planExpiry) : new Date();
        if (base < new Date()) base.setTime(Date.now());
        base.setDate(base.getDate() + 7);
        profile.planExpiry = base.toISOString();
        if (profile.plan === 'free') profile.plan = 'basic';
        await saveUser(env, user.email, profile);
        await redisSet(env, bonusKey, '1');
        extended = true;
      }
    }
  }
  const plan = user?.email ? getEffectivePlan(await findUser(env, user.email)) : null;
  return jsonResponse({ success: true, extended, plan });
}

async function handleFeedbacks(request, env, url) {
  if (request.method === 'GET') {
    if (url.searchParams.get('public') === '1') return jsonResponse(await getPublicFeedbacks(env, 5));
    const all = await readFeedbackArray(env);
    return jsonResponse(all);
  }
  const body = await request.json();
  const stars = parseInt(body.rating, 10) || 5;
  if (!String(body.text || '').trim()) return jsonResponse({ error: 'Text required' }, 400);
  await saveFeedback(env, {
    name: String(body.name || 'Аноним').trim().slice(0, 80),
    role: String(body.role || 'parent').slice(0, 40),
    rating: Math.min(5, Math.max(1, stars)),
    text: String(body.text).trim().slice(0, 1000), approved: true
  });
  return jsonResponse({ success: true });
}

async function handleResetAdmin(env) {
  const hashed = hashPassword('admintuti13');
  const user = await findUser(env, 'admin@geroy-skazki.local');
  if (!user) return jsonResponse({ error: 'Админ не найден' }, 404);
  user.passwordHash = hashed;
  delete user.password;
  await saveUser(env, 'admin@geroy-skazki.local', user);
  return jsonResponse({ success: true, message: 'Пароль админа сброшен' });
}

// ============ MAIN HANDLER ============

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. САМОЕ ПЕРВОЕ — не API = статика (Cloudflare Pages)
    if (!path.startsWith('/api/')) {
      return fetch(request);
    }

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      const route = getApiRoute(path);

      // Health
      if (path === '/api/health' && method === 'GET') return handleHealth(env);

      // Analytics / log-error / health alias
      if (route === 'analytics' || route === 'log-error' || route === 'health') {
        if (method === 'GET') return handleAnalyticsHealth(env);
        if (method === 'POST') return handleAnalyticsPost(request, env);
      }

      // Auth
      if (route === 'login' && method === 'POST') return handleLogin(request, env);
      if (route === 'register' && method === 'POST') return handleRegister(request, env);
      if (route === 'verify-token' && method === 'GET') return handleVerifyToken(request, env);
      if ((route === 'logout' || route === 'auth/logout') && method === 'POST') return handleLogout();

      // AI
      if (route === 'generate' && method === 'POST') return handleGenerate(request, env);
      if (route === 'tts' && method === 'POST') return handleTts(request, env);
      if (route === 'speech-to-text' && method === 'POST') return handleSpeechToText(request, env);

      // Admin
      if ((route === 'admin/stats' || route === 'admin-stats') && method === 'GET') return handleAdminStats(request, env, url);
      if ((route === 'admin/full-stats' || route === 'admin-full-stats') && method === 'GET') return handleAdminFullStats(request, env);
      if ((route === 'admin/login' || route === 'admin-login') && method === 'POST') return handleAdminLogin(request, env);
      if (route === 'admin-thanks' && method === 'GET') return handleAdminThanks(request, env);
      if ((route === 'admin/feedback-reply' || route === 'admin-feedback-reply') && method === 'POST') return handleAdminFeedbackReply(request, env);

      // User
      if (route === 'promocode' && method === 'POST') return handlePromocode(request, env);
      if (route === 'promocode-stats' && method === 'GET') return handlePromocodeStats(env, url);
      if (route === 'verify-pin' && method === 'POST') return handleVerifyPin(request, env);
      if (route === 'get-secret-question' && (method === 'GET' || method === 'POST')) return handleGetSecretQuestion(request, env, url);
      if (route === 'reset-password' && method === 'POST') return handleResetPassword(request, env);
      if (route === 'profile-update' && (method === 'GET' || method === 'POST')) return handleProfileUpdate(request, env);
      if (route === 'weekly-stats' && (method === 'GET' || method === 'POST')) return handleWeeklyStats(request, env, url);
      if (route === 'weekly-digest' && method === 'POST') return handleWeeklyDigest(request, env);
      if (route === 'leaderboard' && (method === 'GET' || method === 'POST')) return handleLeaderboard(request, env, url);
      if ((route === 'sync-child-data' || route === 'user/sync') && method === 'POST') return handleSync(request, env);
      if (route === 'child-token' && (method === 'GET' || method === 'POST')) return handleChildToken(request, env, url);
      if (route === 'psychologist-help' && method === 'POST') return handlePsychologistHelp(request, env);
      if (route === 'notify-creator' && method === 'POST') return handleNotifyCreator(request, env);
      if (route === 'feedback' && (method === 'GET' || method === 'POST')) return handleFeedback(request, env);
      if (route === 'feedbacks' && (method === 'GET' || method === 'POST')) return handleFeedbacks(request, env, url);
      if (route === 'reset-admin' && method === 'POST') return handleResetAdmin(env);

      // Fallback proxy to Vercel
      if (path.startsWith('/api/')) {
        const vercelUrl = 'https://geroy-skazki.vercel.app' + path + url.search;
        try {
          const proxyBody = method === 'GET' || method === 'HEAD' ? undefined : request.body;
          const res = await fetch(vercelUrl, { method, headers: request.headers, body: proxyBody });
          const headers = new Headers(res.headers);
          Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
          return new Response(res.body, { status: res.status, headers });
        } catch {
          return jsonResponse({ error: 'Endpoint not available' }, 502);
        }
      }

      // Все остальные запросы — статика (Cloudflare Pages)
      return fetch(request);

    } catch (e) {
      return jsonResponse({ error: 'Internal error', detail: e.message }, { status: 500, headers: corsHeaders() });
    }
  }
};

