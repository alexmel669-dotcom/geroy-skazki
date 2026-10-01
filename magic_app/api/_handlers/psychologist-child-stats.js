import { setCors } from '../_middleware/cors.js';
import {
  getQuery,
  requirePsychologist,
  redis
} from '../_lib/psychologist-access.js';

// Данные ребёнка, которые психолог видит ТОЛЬКО при явном согласии родителя.
// Источник — geroy:consent:{parentEmail}:{psychologistEmail}, запись создаётся
// эндпоинтом parent-consent.js. Без согласия — 403, ничего не отдаём.
const CONSENT_PREFIX = 'geroy:consent:';

function consentKey(parentEmail, psychologistEmail) {
  return `${CONSENT_PREFIX}${parentEmail}:${psychologistEmail}`;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const query = getQuery(req);
    const psychologistEmail = normalizeEmail(query.psychologistEmail);
    const parentEmail = normalizeEmail(query.parentEmail);

    if (!psychologistEmail || !parentEmail) {
      return res.status(400).json({
        error: 'psychologistEmail и parentEmail обязательны'
      });
    }

    // Доступ — только сам психолог (по своему email) или админ.
    const access = await requirePsychologist(req, psychologistEmail);
    if (!access || (access.email !== psychologistEmail && !access.admin)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const record = await redis.get(consentKey(parentEmail, psychologistEmail));
    if (!record?.consent) {
      return res.status(403).json({ error: 'Родитель не дал согласие на передачу данных' });
    }

    return res.status(200).json({
      consent: true,
      parentEmail,
      childName: record.childName || null,
      fearStats: record.fearStats || {},
      mood: record.mood || null,
      updatedAt: record.updatedAt || null
    });
  } catch (err) {
    console.error('psychologist-child-stats error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
