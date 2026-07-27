import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { isValidAdminToken } from '../_lib/admin-token.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const REPORTS_KEY = 'geroy:psychologist:reports';
const LIST_KEY = 'geroy:psychologists';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      if (!isValidAdminToken(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const reports = asArray(await redis.get(REPORTS_KEY));
      return res.status(200).json(reports.slice().reverse());
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const auth = verifyAuth(req);
    const { psychologistEmail, reason, reportedBy } = req.body || {};
    const psyEmail = String(psychologistEmail || '').trim().toLowerCase();
    const reasonText = String(reason || '').trim();

    if (!psyEmail || !reasonText) {
      return res.status(400).json({ error: 'Email и причина обязательны' });
    }

    const reporter =
      String(reportedBy || auth?.email || '').trim().toLowerCase() || 'anonymous';

    const reports = asArray(await redis.get(REPORTS_KEY));
    reports.push({
      psychologistEmail: psyEmail,
      reason: reasonText.slice(0, 1000),
      reportedBy: reporter,
      timestamp: new Date().toISOString(),
      status: 'pending'
    });
    await redis.set(REPORTS_KEY, reports.slice(-500));

    const psyReports = reports.filter(
      (r) => String(r.psychologistEmail || '').toLowerCase() === psyEmail
    );
    if (psyReports.length >= 3) {
      const list = asArray(await redis.get(LIST_KEY));
      const idx = list.findIndex(
        (p) => String(p.email || '').toLowerCase() === psyEmail
      );
      if (idx >= 0) {
        list[idx].flagged = true;
        list[idx].flagReason = '3+ жалобы';
        await redis.set(LIST_KEY, list);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('psychologist-report error:', err);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
}
