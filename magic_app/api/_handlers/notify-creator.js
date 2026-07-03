import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { checkRateLimit } from '../_middleware/ai-rate-limit.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const THANKS_KEY = 'geroy:thanks';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateCheck = checkRateLimit(req, 'notify-creator');
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Слишком много запросов', retryAfter: rateCheck.retryAfter });
  }

  try {
    const { type, message, userName, userAge } = req.body || {};
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const existing = await redis.get(THANKS_KEY);
    const thanks = Array.isArray(existing) ? existing : [];

    thanks.unshift({
      type: type || 'thanks',
      message: String(message).trim().slice(0, 500),
      userName: userName || 'Гость',
      userAge: userAge ?? '?',
      date: new Date().toISOString()
    });

    await redis.set(THANKS_KEY, thanks.slice(0, 100));

    return res.status(200).json({ success: true, total: thanks.length });
  } catch (error) {
    console.error('Notify creator error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
