import { setCors } from '../_middleware/cors.js';
import { validatePromocode } from '../_lib/promocodes.js';

const PLAN_NAMES = { basic: 'Базовый', family: 'Семейный', free: 'Бесплатный' };

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body || {};
  const promo = validatePromocode(code);

  if (!promo) {
    return res.status(200).json({ valid: false, message: 'Промокод не найден' });
  }

  const planLabel = PLAN_NAMES[promo.plan] || promo.plan;
  return res.status(200).json({
    valid: true,
    plan: promo.plan,
    days: promo.days,
    message: `Активирован тариф «${planLabel}» на ${promo.days} дней!`
  });
}
