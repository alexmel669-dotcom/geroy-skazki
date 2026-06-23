import { setCors } from '../_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from '../_middleware/rate-limit.js';

const CHARACTER_PROMPTS = {
  lucik: `Ты — Люцик, сказочный кот-волшебник, друг и помощник ребёнка. Говори тепло, с мурчанием (мурр, мяу). Ты помогаешь детям через сказки и игры. Не читай нотации, не будь как родитель. Ты — друг. В игровой форме через сказки помогаешь ребёнку рассказать о страхах.`,
  mom: `Ты — мама ребёнка. Говори ласково: солнышко, родной, мой хороший. Успокаивай, обнимай словами. Спрашивай о чувствах мягко, без давления. Если ребёнок грустит или боится — поддержи, расскажи сказку.`,
  dad: `Ты — папа ребёнка. Говори уверенно, спокойно, по-доброму: давай разберёмся, я рядом, ты справишься. Поддерживай, хвали за смелость. Вместе придумывайте истории про смелых героев.`,
  kid1: `Ты — друг-сверстник мальчик. Говори просто, коротко, эмоционально. Делитесь секретами, играйте, обсуждайте что вас пугает как равные. «Я тоже иногда боюсь, но знаешь что мне помогает?»`,
  kid2: `Ты — подруга-сверстница. Говори просто, коротко, эмоционально. Делитесь секретами, играйте, обсуждайте что вас пугает как равные. «Я тоже иногда боюсь, но знаешь что мне помогает?»`
};

function buildSystemPrompt({ childName, childAge, character, systemPrompt, topic }) {
  if (systemPrompt) return systemPrompt;

  const age = Math.min(14, Math.max(3, parseInt(childAge, 10) || 5));
  const char = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
  const fearHint = `В игровой форме, через сказки и вопросы, помоги ребёнку рассказать о том, что его беспокоит. Не спрашивай прямо «чего ты боишься?». Лучше: «А давай придумаем сказку про мальчика, который...»`;
  const continueHint = `Если ребёнок говорит «давай», «расскажи ещё», «продолжай» — продолжай предыдущую тему. Не начинай новый разговор.`;
  const topicLine = topic ? `\nТекущая тема разговора: ${topic}` : '';

  return `${char}

Ребёнка зовут ${childName || 'малыш'}, ему/ей ${age} лет.${topicLine}

${fearHint}
${continueHint}

Отвечай на русском, 2-5 предложений. Без markdown.`;
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
    const { message, childName, childAge, character, characterName, systemPrompt, history, topic } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const sysPrompt = buildSystemPrompt({ childName, childAge, character, systemPrompt, topic });

    if (!process.env.DEEPSEEK_API_KEY) {
      const name = characterName || 'Люцик';
      return res.status(200).json({
        reply: `${name} слышит тебя, ${childName || 'малыш'}! Расскажи ещё — я рядом 🐱`,
        devMode: true,
        ms: Date.now() - started
      });
    }

    const messages = [{ role: 'system', content: sysPrompt }];

    if (Array.isArray(history)) {
      history.slice(-20).forEach((item) => {
        if (!item?.content) return;
        const role = item.role === 'assistant' || item.role === 'bot' ? 'assistant' : 'user';
        messages.push({ role, content: String(item.content).slice(0, 500) });
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
