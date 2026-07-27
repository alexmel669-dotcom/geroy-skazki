import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { isValidAdminToken } from '../_lib/admin-token.js';
import { generatePsychologistCode } from '../_lib/promocodes.js';
import { findUser, saveUser } from '../_lib/users.js';

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
      const items = Array.isArray(list) ? list : [];

      if (isValidAdminToken(req)) {
        return res.status(200).json(items);
      }

      const active = items
        .filter((p) => p.active !== false)
        .map(({ promoCode, flagged, flagReason, ...rest }) => rest);
      return res.status(200).json(active);
    }

    if (req.method === 'POST') {
      if (!isValidAdminToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, email, specialization, experience, phone, telegram, city } = req.body || {};
      if (!name) {
        return res.status(400).json({ error: 'Имя обязательно' });
      }

      const list = (await redis.get(LIST_KEY)) || [];
      const items = Array.isArray(list) ? [...list] : [];
      const code = generatePsychologistCode(name);
      const normalizedEmail = email ? String(email).trim().toLowerCase() : '';

      items.push({
        id: items.length + 1,
        name: String(name).trim(),
        email: normalizedEmail || null,
        specialization: String(specialization || '').trim(),
        experience: String(experience || '').trim(),
        phone: String(phone || '').trim(),
        telegram: String(telegram || '').trim(),
        city: String(city || '').trim(),
        promoCode: code,
        clientsCount: 0,
        active: true,
        flagged: false,
        addedAt: new Date().toISOString()
      });

      await redis.set(LIST_KEY, items);

      if (normalizedEmail) {
        const existing = await findUser(normalizedEmail);
        if (existing) {
          await saveUser(normalizedEmail, {
            ...existing,
            role: 'psychologist',
            promoCode: code
          });
        }
      }

      return res.status(201).json({ success: true, code, id: items.length, email: normalizedEmail || null });
    }

    if (req.method === 'PUT') {
      if (!isValidAdminToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { email, id, active, flagged } = req.body || {};
      const list = (await redis.get(LIST_KEY)) || [];
      const items = Array.isArray(list) ? [...list] : [];

      let idx = -1;
      if (email) {
        idx = items.findIndex((p) => String(p.email || '').toLowerCase() === String(email).toLowerCase());
      }
      if (idx < 0 && id != null) {
        idx = items.findIndex((p) => String(p.id) === String(id));
      }
      if (idx < 0) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (active !== undefined) items[idx].active = Boolean(active);
      if (flagged !== undefined) {
        items[idx].flagged = Boolean(flagged);
        if (!flagged) items[idx].flagReason = null;
      }

      await redis.set(LIST_KEY, items);
      return res.status(200).json({ success: true, psychologist: items[idx] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('psychologists-list error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
