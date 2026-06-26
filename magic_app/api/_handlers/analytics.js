import { setCors } from '../_middleware/cors.js';
import { appendEvents } from '../_lib/analytics-store.js';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

async function handleHealth(req, res) {
  const yandexKey = process.env.YANDEX_API_KEY?.trim();
  const yandexFolder = process.env.YANDEX_FOLDER_ID?.trim();
  return res.status(200).json({
    ok: true,
    version: '5.0.3',
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
