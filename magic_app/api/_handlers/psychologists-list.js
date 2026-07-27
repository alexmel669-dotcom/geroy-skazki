import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { isValidAdminToken } from '../_lib/admin-token.js';
import { generatePsychologistCode } from '../_lib/promocodes.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const LIST_KEY = 'geroy:psychologists';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      const list = (await redis.get(LIST_KEY)) || [];
      const active = (Array.isArray(list) ? list : [])
        .filter((p) => p.active)
        .map(({ promoCode, ...rest }) => rest);
      return res.status(200).json(active);
    }

    if (req.method === 'POST') {
      if (!isValidAdminToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, specialization, experience, phone, telegram, city } = req.body || {};
      if (!name) {
        return res.status(400).json({ error: 'Имя обязательно' });
      }

      const list = (await redis.get(LIST_KEY)) || [];
      const items = Array.isArray(list) ? [...list] : [];
      const code = generatePsychologistCode(name);

      items.push({
        id: items.length + 1,
        name: String(name).trim(),
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
    console.error('psychologists-list error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
