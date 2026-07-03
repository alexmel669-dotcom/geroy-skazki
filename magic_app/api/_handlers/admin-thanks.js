import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { isValidAdminToken } from '../_lib/admin-token.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const THANKS_KEY = 'geroy:thanks';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isValidAdminToken(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const thanks = await redis.get(THANKS_KEY);
    const list = Array.isArray(thanks) ? thanks : [];
    return res.status(200).json(list.slice(0, 20));
  } catch (error) {
    console.error('Admin thanks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
