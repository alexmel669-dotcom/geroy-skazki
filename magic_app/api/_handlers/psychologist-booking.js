import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import {
  getQuery,
  requirePsychologist,
  redis
} from '../_lib/psychologist-access.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      const query = getQuery(req);
      const psychologistEmail = String(query.psychologistEmail || '').trim().toLowerCase();
      if (!psychologistEmail) {
        return res.status(400).json({ error: 'psychologistEmail required' });
      }

      const slots = asArray(await redis.get(`geroy:psychologist:${psychologistEmail}:slots`));
      const bookings = asArray(await redis.get(`geroy:psychologist:${psychologistEmail}:bookings`));
      return res.status(200).json({ slots, bookings });
    }

    if (req.method === 'POST') {
      const auth = verifyAuth(req);
      if (!auth?.email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        psychologistEmail,
        parentEmail,
        parentName,
        childName,
        date,
        time,
        concern
      } = req.body || {};

      const psyEmail = String(psychologistEmail || '').trim().toLowerCase();
      const parent = String(parentEmail || auth.email).trim().toLowerCase();

      if (!psyEmail || !date || !time) {
        return res.status(400).json({ error: 'psychologistEmail, date и time обязательны' });
      }

      if (parent !== String(auth.email).toLowerCase()) {
        const psy = await requirePsychologist(req, psyEmail);
        if (!psy) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const booking = {
        id: Date.now().toString(36),
        psychologistEmail: psyEmail,
        parentEmail: parent,
        parentName: String(parentName || '').trim() || parent,
        childName: String(childName || '').trim(),
        date: String(date).trim(),
        time: String(time).trim(),
        concern: String(concern || '').trim().slice(0, 500),
        status: 'confirmed',
        price: 0,
        createdAt: new Date().toISOString()
      };

      const key = `geroy:psychologist:${psyEmail}:bookings`;
      const bookings = asArray(await redis.get(key));
      bookings.push(booking);
      await redis.set(key, bookings);

      return res.status(201).json({ success: true, booking });
    }

    if (req.method === 'PUT') {
      const { psychologistEmail, slots } = req.body || {};
      const psyEmail = String(psychologistEmail || '').trim().toLowerCase();
      if (!psyEmail) {
        return res.status(400).json({ error: 'psychologistEmail required' });
      }

      const access = await requirePsychologist(req, psyEmail);
      if (!access || (access.email !== psyEmail && !access.admin)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const normalizedSlots = asArray(slots).map((s) => ({
        day: String(s.day || s.date || '').trim(),
        start: String(s.start || s.time || '').trim(),
        end: String(s.end || '').trim(),
        available: s.available !== false
      })).filter((s) => s.day && s.start);

      await redis.set(`geroy:psychologist:${psyEmail}:slots`, normalizedSlots);
      return res.status(200).json({ success: true, slots: normalizedSlots });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('psychologist-booking error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
