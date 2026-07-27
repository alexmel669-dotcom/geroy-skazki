import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const APPLICATIONS_KEY = 'geroy:psychologist:applications';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      name,
      specialization,
      experience,
      email,
      phone,
      telegram,
      city,
      documents,
      confirmed
    } = req.body || {};

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const cleanSpec = String(specialization || '').trim();
    const cleanPhone = String(phone || '').trim();

    if (!cleanName || !cleanSpec || !normalizedEmail || !cleanPhone) {
      return res.status(400).json({
        error: 'Заполните обязательные поля: ФИО, специализация, email, телефон'
      });
    }

    if (confirmed === false) {
      return res.status(400).json({ error: 'Подтвердите согласие с условиями' });
    }

    const applications = asArray(await redis.get(APPLICATIONS_KEY));
    if (applications.some((a) => String(a.email || '').toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ error: 'Заявка с этим email уже отправлена' });
    }

    applications.push({
      name: cleanName,
      specialization: cleanSpec,
      experience: String(experience || '').trim(),
      email: normalizedEmail,
      phone: cleanPhone,
      telegram: String(telegram || '').trim(),
      city: String(city || '').trim(),
      documents: String(documents || '').trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    await redis.set(APPLICATIONS_KEY, applications.slice(-500));

    return res.status(201).json({
      success: true,
      message: 'Заявка принята. Мы проверим документы в течение 3 рабочих дней.'
    });
  } catch (err) {
    console.error('psychologist-apply error:', err);
    return res.status(500).json({ error: 'Не удалось сохранить заявку' });
  }
}
