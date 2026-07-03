import { setCors } from '../_middleware/cors.js';
import { appendEvents } from '../_lib/analytics-store.js';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

async function sendAdminAlert(errors) {
  const key = process.env.RESEND_API_KEY?.trim();
  const adminEmail = (process.env.ADMIN_EMAILS || 'admin@geroy-skazki.local').split(',')[0]?.trim();
  if (!key || !adminEmail) return;

  const summary = errors.slice(0, 5).map((e) =>
    `<li><b>${e.type}</b>: ${String(e.message || '').slice(0, 120)}</li>`
  ).join('');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Люцик <lucik@geroy-skazki.ru>',
        to: [adminEmail],
        subject: `[Герой Сказок] Критическая ошибка клиента`,
        html: `<p>Зафиксировано ${errors.length} критических ошибок:</p><ul>${summary}</ul>`
      })
    });
  } catch (err) {
    console.error('Admin alert email failed:', err.message);
  }
}

async function storeClientErrors(errors) {
  const dateKey = new Date().toISOString().slice(0, 10);
  const redisKey = `errors:${dateKey}`;
  try {
    const existing = (await redis.get(redisKey)) || [];
    const merged = [...existing, ...errors].slice(-500);
    await redis.set(redisKey, merged);
  } catch (err) {
    console.warn('Client errors Redis store failed:', err.message);
  }

  const critical = errors.filter((e) => e.critical);
  if (critical.length) await sendAdminAlert(critical);
}

async function handleHealth(req, res) {
  const yandexKey = process.env.YANDEX_API_KEY?.trim();
  const yandexFolder = process.env.YANDEX_FOLDER_ID?.trim();
  return res.status(200).json({
    ok: true,
    version: '5.3.17',
    node: process.version,
    env: {
      jwt: Boolean(process.env.JWT_SECRET?.trim()),
      kv: Boolean(process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim()),
      yandexKey: Boolean(yandexKey),
      yandexFolder: Boolean(yandexFolder),
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY?.trim())
    },
    yandexKeyLength: yandexKey ? yandexKey.length : 0,
    timestamp: new Date().toISOString()
  });
}

async function handleLogError(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { context, message, timestamp, appVersion } = req.body || {};
    console.error(`📋 [ERROR LOG] ${timestamp} | ${context} | v${appVersion}`);
    console.error(`   ${message}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Log error handler failed:', error);
    return res.status(500).json({ error: 'Logging failed' });
  }
}

async function handleAnalyticsPost(req, res) {
  const { events } = req.body || {};
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Events array required' });
  }

  const clientErrorEvents = events.filter((e) => e.name === 'client_errors');
  for (const evt of clientErrorEvents) {
    const batch = evt.data?.errors;
    if (Array.isArray(batch) && batch.length) {
      await storeClientErrors(batch);
    }
  }

  const hasLandingView = events.some((e) => e.name === 'page_view' || e.name === 'landing_view');
  if (hasLandingView) {
    try {
      await redis.incr('geroy:analytics:visitors');
    } catch (err) {
      console.warn('Visitor counter failed:', err.message);
    }
  }

  appendEvents(events);
  console.log(`📊 Analytics: ${events.length} events stored`);
  return res.status(200).json({ success: true, processed: events.length });
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const route = req.apiRoute || 'analytics';

  try {
    if (route === 'health') return handleHealth(req, res);
    if (route === 'log-error') return handleLogError(req, res);
    if (req.method === 'POST') return handleAnalyticsPost(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
