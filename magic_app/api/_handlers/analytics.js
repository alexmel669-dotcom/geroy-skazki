// ========================================
// analytics.js — Логирование и health-check
// ========================================

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

export async function handler(req, res) {
  // Health check
  if (req.method === 'GET') {
    return res.json({
      ok: true,
      version: '5.8.7',
      node: process.version,
      env: {
        jwt: !!process.env.JWT_SECRET,
        kv: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
        yandexKey: !!process.env.YANDEX_API_KEY,
        yandexFolder: !!process.env.YANDEX_FOLDER_ID,
        deepseek: !!process.env.DEEPSEEK_API_KEY
      },
      yandexKeyLength: (process.env.YANDEX_API_KEY || '').length,
      timestamp: new Date().toISOString()
    });
  }

  // Сохранение событий
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const key = 'geroy:analytics:events';
      const events = await redis.get(key) || [];
      events.push({
        ...body,
        timestamp: new Date().toISOString()
      });
      if (events.length > 1000) events.shift();
      await redis.set(key, events);
      return res.json({ stored: true, count: events.length });
    } catch (e) {
      console.error('Analytics error:', e.message);
      return res.status(500).json({ error: 'Storage error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default handler;