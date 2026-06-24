import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';

const CHARACTER_PROMPTS = {
  lucik: 'Ты — Люцик, сказочный кот-волшебник, друг и помощник ребёнка. Тёплый, с мурчанием (мурр, мяу). Помогаешь через сказки и игры.',
  mom: 'Ты — мама ребёнка. Ласковая: солнышко, родной. Успокаиваешь, обнимаешь словами.',
  dad: 'Ты — папа ребёнка. Уверенный, спокойный: давай разберёмся, я рядом, ты справишься.',
  kid1: 'Ты — друг-сверстник мальчик. Простые, короткие фразы. Делитесь секретами на равных.',
  kid2: 'Ты — подруга-сверстница. Простые, короткие фразы. Делитесь секретами на равных.'
};

function buildSystemPrompt({ childName, childAge, character, systemPrompt, topic }) {
  if (systemPrompt) return systemPrompt;
  const age = Math.min(14, Math.max(3, parseInt(childAge, 10) || 5));
  const role = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
  const fearHint = 'В игровой форме, через сказки, помоги ребёнку рассказать о беспокойствах. Не спрашивай прямо «чего ты боишься?».';
  const continueHint = 'Если ребёнок говорит «давай», «расскажи ещё», «продолжай» — продолжай предыдущую тему.';
  const topicLine = topic ? `\nТекущая тема: ${topic}` : '';
  return `${role}\n\nРебёнок: ${childName || 'малыш'}, ${age} лет.${topicLine}\n${fearHint}\n${continueHint}\nОтвечай на русском, 2-5 предложений.`;
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 10)) return res.status(429).json({ error: 'Too many requests' });

  const started = Date.now();
  try {
    const { message, childName, childAge, character, systemPrompt, history, topic } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const sys = buildSystemPrompt({ childName, childAge, character, systemPrompt, topic });

    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(200).json({
        reply: `Мурр! Я ${character || 'Люцик'}, слушаю тебя, ${childName || 'малыш'}! 🐱`,
        devMode: true,
        ms: Date.now() - started
      });
    }

    const messages = [{ role: 'system', content: sys }];
    if (Array.isArray(history)) {
      history.slice(-20).forEach((item) => {
        if (!item?.content) return;
        messages.push({
          role: item.role === 'assistant' || item.role === 'bot' ? 'assistant' : 'user',
          content: String(item.content).slice(0, 500)
        });
      });
    }
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: 300,
        temperature: 0.85
      })
    });

    if (!response.ok) throw new Error(`DeepSeek: ${response.status}`);
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error('Empty AI response');
    return res.status(200).json({ reply, ms: Date.now() - started });
  } catch (error) {
    console.error('Generate error:', error);
    return res.status(200).json({
      reply: 'Мурр... Я немного задумался. Давай попробуем ещё раз? 🐱',
      ms: Date.now() - started
    });
  }
}
