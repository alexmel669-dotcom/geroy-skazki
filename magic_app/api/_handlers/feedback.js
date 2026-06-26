import { setCors } from '../_middleware/cors.js';
import { verifyAuth } from '../_middleware/auth.js';
import { findUser, saveUser } from '../_lib/users.js';
import { getEffectivePlan } from '../_lib/promocodes.js';
import { ADMIN_API_TOKEN } from '../_lib/admin-token.js';
import { getRecentFeedbacks, saveFeedback, hasFeedbackBonus, markFeedbackBonus } from '../_lib/feedbacks.js';

export { getRecentFeedbacks };

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method === 'GET') {
    if (req.headers.authorization !== ADMIN_API_TOKEN) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const feedbacks = await getRecentFeedbacks(20);
    return res.status(200).json({ feedbacks });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rating, text, page, requestExtend } = req.body || {};
    const stars = parseInt(rating, 10);
    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'Rating 1-5 required' });
    }

    const user = verifyAuth(req);
    const entry = {
      rating: stars,
      text: String(text || '').trim().slice(0, 1000),
      page: String(page || '').slice(0, 80),
      email: user?.email ? `${user.email.split('@')[0].slice(0, 3)}@...` : 'guest',
      createdAt: new Date().toISOString()
    };

    await saveFeedback(entry);

    let extended = false;
    if (requestExtend && stars >= 4 && user?.email) {
      const already = await hasFeedbackBonus(user.email);
      if (!already) {
        const profile = await findUser(user.email);
        if (profile) {
          const base = profile.planExpiry ? new Date(profile.planExpiry) : new Date();
          if (base < new Date()) base.setTime(Date.now());
          base.setDate(base.getDate() + 7);
          profile.planExpiry = base.toISOString();
          if (profile.plan === 'free') profile.plan = 'basic';
          await saveUser(user.email, profile);
          await markFeedbackBonus(user.email);
          extended = true;
        }
      }
    }

    return res.status(200).json({
      success: true,
      extended,
      plan: user?.email ? getEffectivePlan(await findUser(user.email)) : null
    });
  } catch (error) {
    console.error('Feedback error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
