import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { generateOrphanageCode } from '../_lib/promocodes.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const APPLICATIONS_KEY = 'geroy:orphanage:applications';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, city, contactName, contactPhone, email } = req.body || {};
    if (!name || !contactName || !contactPhone) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    const applications = (await redis.get(APPLICATIONS_KEY)) || [];
    const list = Array.isArray(applications) ? [...applications] : [];
    list.push({
      name: String(name).trim(),
      city: String(city || '').trim(),
      contactName: String(contactName).trim(),
      contactPhone: String(contactPhone).trim(),
      email: String(email || '').trim().toLowerCase(),
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    await redis.set(APPLICATIONS_KEY, list);

    const code = generateOrphanageCode(name);
    await redis.set(`geroy:orphanage:verified:${code}`, {
      name: String(name).trim(),
      city: String(city || '').trim(),
      contactName: String(contactName).trim(),
      contactPhone: String(contactPhone).trim(),
      email: String(email || '').trim().toLowerCase(),
      verifiedAt: new Date().toISOString(),
      active: true
    });

    return res.status(200).json({
      success: true,
      message: 'Заявка принята. Ваш код активирован.',
      code
    });
  } catch (err) {
    console.error('verify-orphanage error:', err);
    return res.status(500).json({ error: 'Не удалось сохранить заявку' });
  }
}
