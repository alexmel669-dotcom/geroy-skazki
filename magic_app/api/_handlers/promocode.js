import { Redis } from '@upstash/redis';
import { setCors } from '../_middleware/cors.js';
import { validatePromocode, PROMO_TYPES } from '../_lib/promocodes.js';
import { getPromoUsage, incrementPromoUsage, PROMO_LIMIT } from '../_lib/promo-counter.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const PLAN_NAMES = {
  basic: 'Базовый',
  family: 'Семейный',
  premium: 'Премиум',
  free: 'Бесплатный'
};

export { incrementPromoUsage, PROMO_TYPES };
export {
  generatePsychologistCode,
  generateSpecialistCode,
  generateOrphanageCode
} from '../_lib/promocodes.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, email } = req.body || {};
  const promo = validatePromocode(code);

  if (!promo) {
    return res.status(200).json({ valid: false, message: 'Промокод не найден' });
  }

  const normalized = String(code).trim().toUpperCase();

  if (promo.code === 'FOUNDERS' || promo.type === 'public') {
    const used = await getPromoUsage(promo.code);
    const limit = promo.limit || PROMO_LIMIT;
    if (used >= limit) {
      return res.status(200).json({
        valid: false,
        message: `Все ${limit} мест по промокоду заняты`
      });
    }
  }

  if (normalized.startsWith('PSY-') || normalized.startsWith('SPEC-')) {
    const usage = await getPromoUsage(normalized);
    if (usage >= 1) {
      return res.status(200).json({ valid: false, message: 'Промокод уже использован', error: 'Промокод уже использован' });
    }
    if (email) {
      await redis.set(`geroy:referral:${normalized}`, {
        userEmail: String(email).trim().toLowerCase(),
        code: normalized,
        activatedAt: new Date().toISOString()
      });
    }
  }

  if (normalized.startsWith('ORPH-')) {
    const verified = await redis.get(`geroy:orphanage:verified:${normalized}`);
    if (!verified) {
      return res.status(200).json({
        valid: false,
        message: 'Промокод требует верификации',
        error: 'Промокод требует верификации'
      });
    }
  }

  const planLabel = PLAN_NAMES[promo.plan] || promo.plan;
  return res.status(200).json({
    valid: true,
    plan: promo.plan,
    days: promo.days,
    type: promo.type || 'public',
    message: `Активирован тариф «${planLabel}» на ${promo.days} дней!`
  });
}
