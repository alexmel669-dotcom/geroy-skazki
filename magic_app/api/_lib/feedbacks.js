import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const FEEDBACK_KEY = 'geroy:feedbacks';
const FEEDBACK_LIST_KEY = 'geroy:feedbacks:list';

async function readFeedbackArray() {
  try {
    const stored = await redis.get(FEEDBACK_KEY);
    if (Array.isArray(stored)) return stored;
    const raw = await redis.lrange(FEEDBACK_LIST_KEY, 0, 199);
    const parsed = raw.map((item) => {
      try { return JSON.parse(item); } catch { return null; }
    }).filter(Boolean);
    if (parsed.length) await redis.set(FEEDBACK_KEY, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function writeFeedbackArray(feedbacks) {
  await redis.set(FEEDBACK_KEY, feedbacks.slice(0, 100));
}

export async function getRecentFeedbacks(limit = 20) {
  const all = await readFeedbackArray();
  return all.slice(0, limit);
}

export async function getPublicFeedbacks(limit = 5) {
  const all = await readFeedbackArray();
  return all.filter((f) => f.approved !== false).slice(0, limit);
}

export async function saveFeedback(entry) {
  const item = {
    ...entry,
    date: entry.date || entry.createdAt || new Date().toISOString(),
    approved: entry.approved !== false
  };
  await redis.lpush(FEEDBACK_LIST_KEY, JSON.stringify(item));
  await redis.ltrim(FEEDBACK_LIST_KEY, 0, 199);
  const all = await readFeedbackArray();
  all.unshift(item);
  await writeFeedbackArray(all);
}

export async function savePublicFeedback(entry) {
  return saveFeedback(entry);
}

export async function setFeedbackAdminReply(index, reply) {
  const all = await readFeedbackArray();
  if (!all[index]) return false;
  all[index].adminReply = reply;
  await writeFeedbackArray(all);
  return true;
}

export async function hasFeedbackBonus(email) {
  return Boolean(await redis.get(`geroy:feedback-bonus:${email.toLowerCase()}`));
}

export async function markFeedbackBonus(email) {
  await redis.set(`geroy:feedback-bonus:${email.toLowerCase()}`, '1');
}
