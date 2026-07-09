import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

export const PROMO_LIMIT = 100;

function promoKey(code) {
  return `geroy:promo:${String(code || 'FOUNDERS').toUpperCase()}`;
}

export async function getPromoUsage(code) {
  return Number(await redis.get(promoKey(code)) || 0);
}

export async function incrementPromoUsage(code) {
  return redis.incr(promoKey(code));
}

export async function getPromoStats(code = 'FOUNDERS') {
  const normalized = String(code).toUpperCase();
  const used = await getPromoUsage(normalized);
  return {
    code: normalized,
    used,
    remaining: Math.max(0, PROMO_LIMIT - used),
    limit: PROMO_LIMIT
  };
}

export default { getPromoStats, getPromoUsage, incrementPromoUsage, PROMO_LIMIT };
