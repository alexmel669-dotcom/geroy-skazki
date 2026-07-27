import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { isValidAdminToken } from '../_lib/admin-token.js';
import { generateSpecialistCode } from '../_lib/promocodes.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const LIST_KEY = 'geroy:specialists';
const SPECIALIST_TYPES = ['defectologist', 'neuropsychologist', 'speech_therapist', 'hearing_specialist'];

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      const list = (await redis.get(LIST_KEY)) || [];
      const active = (Array.isArray(list) ? list : [])
        .filter((s) => s.active)
        .map(({ promoCode, ...rest }) => rest);
      return res.status(200).json(active);
    }

    if (req.method === 'POST') {
      if (!isValidAdminToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, type, specialization, experience, phone, telegram, city } = req.body || {};
      if (!name || !type) {
        return res.status(400).json({ error: 'Имя и тип обязательны' });
      }
      if (!SPECIALIST_TYPES.includes(type)) {
        return res.status(400).json({ error: 'Неверный тип специалиста' });
      }

      const list = (await redis.get(LIST_KEY)) || [];
      const items = Array.isArray(list) ? [...list] : [];
      const code = generateSpecialistCode(name, type.toUpperCase().slice(0, 4));

      items.push({
        id: items.length + 1,
        name: String(name).trim(),
        type,
        specialization: String(specialization || '').trim(),
        experience: String(experience || '').trim(),
        phone: String(phone || '').trim(),
        telegram: String(telegram || '').trim(),
        city: String(city || '').trim(),
        promoCode: code,
        clientsCount: 0,
        active: true,
        addedAt: new Date().toISOString()
      });

      await redis.set(LIST_KEY, items);
      return res.status(201).json({ success: true, code, id: items.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('specialists-list error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
