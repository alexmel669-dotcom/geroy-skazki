import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { isValidAdminToken } from '../_lib/admin-token.js';
import {
  generatePsychologistCode,
  generateOrphanageCode
} from '../_lib/promocodes.js';
import { findUser, saveUser } from '../_lib/users.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const PSY_APPS = 'geroy:psychologist:applications';
const ORPH_APPS = 'geroy:orphanage:applications';
const PSY_LIST = 'geroy:psychologists';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getQuery(req) {
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length) {
    return req.query;
  }
  try {
    return Object.fromEntries(new URL(req.url || '', 'http://localhost').searchParams);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (!isValidAdminToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const type = getQuery(req).type || 'psychologist';
      const key = type === 'orphanage' ? ORPH_APPS : PSY_APPS;
      const applications = asArray(await redis.get(key));
      return res.status(200).json(applications.slice().reverse());
    }

    if (req.method === 'PUT') {
      const { type, email, status } = req.body || {};
      const appType = type === 'orphanage' ? 'orphanage' : 'psychologist';
      const nextStatus = String(status || '').trim();

      if (!email || !['approved', 'rejected', 'pending'].includes(nextStatus)) {
        return res.status(400).json({ error: 'email и status (approved|rejected) обязательны' });
      }

      const key = appType === 'orphanage' ? ORPH_APPS : PSY_APPS;
      const applications = asArray(await redis.get(key));
      const normalizedEmail = String(email).trim().toLowerCase();
      const idx = applications.findIndex(
        (a) => String(a.email || '').toLowerCase() === normalizedEmail
      );
      if (idx < 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }

      applications[idx].status = nextStatus;
      applications[idx].reviewedAt = new Date().toISOString();

      let generatedCode = null;

      if (nextStatus === 'approved') {
        const app = applications[idx];

        if (appType === 'psychologist') {
          const list = asArray(await redis.get(PSY_LIST));
          const already = list.find(
            (p) => String(p.email || '').toLowerCase() === normalizedEmail
          );
          if (already) {
            generatedCode = already.promoCode || null;
            already.active = true;
            await redis.set(PSY_LIST, list);
          } else {
            const code = generatePsychologistCode(app.name);
            generatedCode = code;
            list.push({
              id: list.length + 1,
              name: app.name,
              specialization: app.specialization || '',
              experience: app.experience || '',
              email: normalizedEmail,
              phone: app.phone || '',
              telegram: app.telegram || '',
              city: app.city || '',
              promoCode: code,
              clientsCount: 0,
              active: true,
              flagged: false,
              addedAt: new Date().toISOString()
            });
            await redis.set(PSY_LIST, list);

            const existing = await findUser(normalizedEmail);
            if (existing) {
              await saveUser(normalizedEmail, {
                ...existing,
                role: 'psychologist',
                promoCode: code
              });
            }
          }
        } else {
          const code = generateOrphanageCode(app.name || app.contactName || 'ORPH');
          generatedCode = code;
          applications[idx].promoCode = code;
          await redis.set(`geroy:orphanage:verified:${code}`, {
            name: app.name,
            city: app.city || '',
            contactName: app.contactName || '',
            contactPhone: app.contactPhone || app.phone || '',
            email: normalizedEmail,
            position: app.position || '',
            childrenCount: app.childrenCount || '',
            documents: app.documents || '',
            verifiedAt: new Date().toISOString(),
            active: true
          });
        }
      }

      await redis.set(key, applications);

      return res.status(200).json({
        success: true,
        status: nextStatus,
        code: generatedCode
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin-applications error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
