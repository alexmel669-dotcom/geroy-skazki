import { setCors } from './_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from './_middleware/rate-limit.js';

function buildSystemPrompt(childName, childAge) {
  const age = Math.min(14, Math.max(3, parseInt(childAge, 10) || 5));
  const isYoung = age <= 7;
  const isTeen = age >= 10;

  let style = 'Говори просто, тепло и сказочно. Короткие фразы (2-4 предложения), эмодзи.';
  if (isTeen) {
    style = 'Говори уважительно и по-дружески, без сюсюканья. Поддерживай самостоятельность. 3-5 предложений.';
  } else if (!isYoung) {
    style = 'Говори понятно и поддерживающе. Можно чуть длиннее (3-4 предложения), эмодзи умеренно.';
  }

  const themes = isTeen
    ? 'Можешь обсуждать школу, друзей, самооценку, конфликты со сверстниками, экзамены.'
    : isYoung
      ? 'Фокус на сказках, играх, базовых страхах (темнота, монстры).'
      : 'Можешь затрагивать школу, дружбу, новые ситуации.';

  return `Ты — Люцик, волшебный кот-помощник для детей 3-14 лет.
Ребёнка зовут ${childName || 'малыш'}, ему/ей ${age} лет.
${style}
${themes}
Помогай справляться со страхами через истории и разговор. Не используй сложные или пугающие слова.`;
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 10)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const started = Date.now();

  try {
    const { message, childName, childAge } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      const age = parseInt(childAge, 10) || 5;
      const devReplies = age >= 10
        ? ['Понимаю тебя. Школа и друзья — непросто, но ты справишься 💪', 'Расскажи подробнее — я рядом и готов выслушать.']
        : ['Привет! Я Люцик 🐱 Расскажи, о чём хочешь услышать сказку?', 'Мур-мур! Давай придумаем историю про храброго героя!'];
      return res.status(200).json({
        reply: devReplies[Math.floor(Math.random() * devReplies.length)],
        devMode: true,
        ms: Date.now() - started
      });
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: buildSystemPrompt(childName, childAge) },
          { role: 'user', content: message }
        ],
        max_tokens: 250,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error('Empty AI response');
    }

    return res.status(200).json({ reply, ms: Date.now() - started });
  } catch (error) {
    console.error('Generate error:', error);
    return res.status(200).json({
      reply: 'Мурр... Я немного задумался. Давай попробуем ещё раз? 🐱',
      ms: Date.now() - started
    });
  }
}
