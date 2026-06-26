import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const FEEDBACK_KEY = 'geroy:feedbacks';

export async function getRecentFeedbacks(limit = 20) {
  try {
    const raw = await redis.lrange(FEEDBACK_KEY, 0, limit - 1);
    return raw.map((item) => {
      try { return JSON.parse(item); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

export async function saveFeedback(entry) {
  await redis.lpush(FEEDBACK_KEY, JSON.stringify(entry));
  await redis.ltrim(FEEDBACK_KEY, 0, 199);
}

export async function hasFeedbackBonus(email) {
  return Boolean(await redis.get(`geroy:feedback-bonus:${email.toLowerCase()}`));
}

export async function markFeedbackBonus(email) {
  await redis.set(`geroy:feedback-bonus:${email.toLowerCase()}`, '1');
}
