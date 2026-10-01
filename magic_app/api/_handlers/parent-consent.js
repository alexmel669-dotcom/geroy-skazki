import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { getQuery, redis, findPsychologistProfile } from '../_lib/psychologist-access.js';

// Согласие родителя на передачу данных ребёнка (страхи/настроение) психологу.
// Ключ: geroy:consent:{parentEmail}:{psychologistEmail}
// По умолчанию согласия нет — запись создаётся только явным действием родителя
// и физически удаляется при отзыве.
const CONSENT_PREFIX = 'geroy:consent:';

const ALLOWED_FEARS = [
  'darkness',
  'monsters',
  'loud_noises',
  'strangers',
  'separation',
  'school',
  'peers'
];

const ALLOWED_MOODS = ['happy', 'neutral', 'sad', 'anxious', 'excited', 'tired'];

function consentKey(parentEmail, psychologistEmail) {
  return `${CONSENT_PREFIX}${parentEmail}:${psychologistEmail}`;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// fearStats приходят из localStorage родителя как произвольный объект —
// оставляем только известные ключи и неотрицательные целые счётчики.
function sanitizeFearStats(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const result = {};
  let total = 0;
  for (const key of ALLOWED_FEARS) {
    const value = Math.max(0, Math.floor(Number(source[key]) || 0));
    result[key] = value;
    total += value;
  }
  return { fearStats: result, total };
}

function sanitizeMood(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return ALLOWED_MOODS.includes(value) ? value : null;
}

function sanitizeChildName(raw) {
  return String(raw || '').trim().slice(0, 60);
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const auth = verifyAuth(req);
  if (!auth?.email) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  if (auth.role === 'child' || auth.mode === 'child') {
    return res.status(403).json({ error: 'Только для родителя' });
  }

  const parentEmail = normalizeEmail(auth.email);

  try {
    if (req.method === 'GET') {
      const query = getQuery(req);
      const queryPsy = normalizeEmail(query.psychologistEmail);

      if (queryPsy) {
        const record = await redis.get(consentKey(parentEmail, queryPsy));
        return res.status(200).json({
          consent: Boolean(record?.consent),
          childName: record?.childName || null,
          updatedAt: record?.updatedAt || null
        });
      }

      // Список всех согласий родителя: сканируем по префиксу.
      const keys = await redis.keys(`${CONSENT_PREFIX}${parentEmail}:*`);
      const prefix = `${CONSENT_PREFIX}${parentEmail}:`;
      const psychologists = [];
      for (const key of keys || []) {
        const record = await redis.get(key);
        if (!record?.consent) continue;
        const psyEmail = String(key).slice(prefix.length);
        const profile = await findPsychologistProfile(psyEmail).catch(() => null);
        psychologists.push({
          psychologistEmail: psyEmail,
          name: profile?.name || record.psychologistName || psyEmail,
          childName: record.childName || null,
          updatedAt: record.updatedAt || null
        });
      }

      return res.status(200).json({ success: true, psychologists });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { psychologistEmail, childName, consent, fearStats, mood } = req.body || {};
    const psyEmail = normalizeEmail(psychologistEmail);

    if (!psyEmail) {
      return res.status(400).json({ error: 'psychologistEmail обязателен' });
    }

    const key = consentKey(parentEmail, psyEmail);

    // Отзыв согласия — удаляем запись вместе с данными.
    if (consent === false) {
      await redis.del(key);
      return res.status(200).json({ success: true, consent: false });
    }

    if (consent !== true) {
      return res.status(400).json({ error: 'Поле consent должно быть true или false' });
    }

    // Дать согласие можно только реальному активному психологу-партнёру.
    const profile = await findPsychologistProfile(psyEmail);
    if (!profile || profile.active === false) {
      return res.status(404).json({ error: 'Психолог не найден или неактивен' });
    }

    const { fearStats: safeFears } = sanitizeFearStats(fearStats);
    const safeMood = sanitizeMood(mood);
    const safeChildName = sanitizeChildName(childName) || null;

    const record = {
      consent: true,
      parentEmail,
      psychologistEmail: psyEmail,
      psychologistName: profile.name || psyEmail,
      childName: safeChildName,
      fearStats: safeFears,
      mood: safeMood,
      updatedAt: new Date().toISOString()
    };

    await redis.set(key, record);

    return res.status(200).json({
      success: true,
      consent: true,
      childName: record.childName,
      updatedAt: record.updatedAt
    });
  } catch (err) {
    console.error('parent-consent error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
