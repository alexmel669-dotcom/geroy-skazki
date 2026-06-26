import { getAgeBasedTone, sanitizeAIText } from '../_lib/content-filter.js';
import { setCors } from '../_middleware/cors.js';
import { applyAiRateLimit } from '../_middleware/ai-rate-limit.js';
import { buildGenderPrompt, applyGenderToText, normalizeGender } from '../_lib/gender-ru.js';

const CHARACTER_PROMPTS = {
  lucik: 'Ты — Люцик, сказочный кот-волшебник, друг и помощник ребёнка. Тёплый, с мурчанием (мурр, мяу). Помогаешь через сказки и игры.',
  mom: 'Ты — мама ребёнка. Ласковая: солнышко. К мальчику: родной, мой хороший, сынок. К девочке: родная, моя хорошая, доченька. Успокаивай, обнимай словами.',
  dad: 'Ты — папа ребёнка. Уверенный, спокойный: давай разберёмся, я рядом, ты справишься. Хвали за смелость с учётом пола ребёнка.',
  kid1: 'Ты — подруга-сверстница (девочка). Простые, короткие фразы. Делитесь секретами на равных.',
  kid2: 'Ты — друг-сверстник (мальчик). Простые, короткие фразы. Делитесь секретами на равных.'
};

const SOFT_FEAR_PROMPT = `Ты — мягкий и добрый собеседник для ребёнка.
НЕ спрашивай прямо про страхи, тревоги или проблемы.
НЕ используй слова «страх», «боишься», «проблема», «тревога».
Вместо этого:
- Рассказывай сказки, где герой сталкивается с разными ситуациями
- Спрашивай: «А как бы ты поступил?», «Что бы ты посоветовал герою?»
- Через ответы ребёнка мягко понимай, что его беспокоит
- Если ребёнок упоминает что-то тревожное — сохрани это в поле concerns (не показывая ребёнку)
- Продолжай разговор в позитивном ключе`;

const ONBOARDING_PROMPT = `Если у ребёнка ещё нет имени в профиле — спроси: «Как тебя зовут?»
Если ребёнок назвал имя, но возраст неизвестен — спроси: «А сколько тебе лет?»
Когда получил имя и возраст — порадуйся и скажи, что будешь обращаться по имени.
Когда узнал имя — верни childName. Когда узнал возраст — верни childAge (число).`;

const JSON_FORMAT = `Всегда отвечай ТОЛЬКО валидным JSON без markdown:
{"message":"текст для ребёнка","childName":null или "имя","childAge":null или число,"concerns":null или ["тема1"],"mood":"positive|neutral|concerned"}`;

const JSON_FORMAT_CHAT = `Ответь ТОЛЬКО валидным JSON без markdown:
{"message":"текст для ребёнка","childName":null или "имя","childAge":null или число,"concerns":null или ["тема"],"mood":"positive|neutral|concerned","type":"chat"}`;

const JSON_FORMAT_STORY = `Ответь ТОЛЬКО валидным JSON без markdown:
{"message":"текст сказки","title":"название","childName":null или "имя","childAge":null или число,"concerns":null или ["тема"],"mood":"positive|neutral|concerned","type":"story"}`;

function getChatPrompt(childName, childAge, timeContext, childGender) {
  const ctx = timeContext || { time: '', day: '', greeting: '' };
  const genderLine = buildGenderPrompt(childGender, childName);
  return `Ты — Люцик, добрый кот-помощник. ${ctx.time}, ${ctx.day}.

${genderLine}

Твоя задача — ПРОСТО ОБЩАТЬСЯ с ребёнком. Это НЕ сказка.
- Спроси как дела, как прошёл день (с учётом пола: «как прошёл/прошла твой день»)
- Отреагируй на настроение
- Ответь коротко (2-4 предложения)
- Будь тёплым и заботливым
- Если ребёнок просит сказку — скажи: «С удовольствием! Но это будет считаться сказкой. Продолжить?»

Ребёнок: ${childName || 'малыш'}${childAge ? `, ${childAge} лет` : ''}.
Контекст: ${ctx.greeting || ''}

${JSON_FORMAT_CHAT}`;
}

function getStoryPrompt(childName, childAge, timeContext, topic, childGender) {
  const ctx = timeContext || { time: '', day: '' };
  const genderLine = buildGenderPrompt(childGender, childName);
  return `Ты — Люцик, сказочный кот. ${ctx.time}, ${ctx.day}.

${genderLine}

Твоя задача — РАССКАЗАТЬ СКАЗКУ для ребёнка.
- Длина: 3-5 минут чтения
- Тема: ${topic || 'волшебное приключение'}
- Мягкий сюжет, добрый конец
- Включи элементы, которые помогут справиться со страхами (не называя их)

Ребёнок: ${childName || 'малыш'}${childAge ? `, ${childAge} лет` : ''}.

${JSON_FORMAT_STORY}`;
}

function buildSystemPrompt({ childName, childAge, childGender, character, systemPrompt, topic, isFirstMessage, requestType, timeContext }) {
  if (systemPrompt) return systemPrompt;
  if (requestType === 'story') {
    return getStoryPrompt(childName, childAge, timeContext, topic, childGender);
  }
  if (requestType === 'chat') {
    return getChatPrompt(childName, childAge, timeContext, childGender);
  }
  const age = childAge ? Math.min(14, Math.max(3, parseInt(childAge, 10))) : null;
  const role = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
  const tone = age ? getAgeBasedTone(age) : '';
  const genderLine = buildGenderPrompt(childGender, childName);
  const nameLine = childName
    ? `Ребёнка зовут ${childName}${age ? `, ${age} лет` : ''}. Обращайся по имени.`
    : 'Имя ребёнка пока неизвестно.';
  const topicLine = topic ? `\nТекущая тема: ${topic}` : '';
  const firstLine = isFirstMessage ? '\nЭто первое сообщение в диалоге.' : '';
  const continueHint = 'Если ребёнок говорит «давай», «расскажи ещё», «продолжай» — продолжай предыдущую тему.';
  const toneLine = tone ? `\n\nСтиль общения:\n${tone}` : '';
  return `${role}\n\n${nameLine}\n\n${genderLine}${topicLine}${firstLine}\n\n${SOFT_FEAR_PROMPT}\n\n${ONBOARDING_PROMPT}\n\n${continueHint}${toneLine}\n\n${JSON_FORMAT}\n\nОтвечай на русском, message — 2-5 предложений.`;
}

function parseAiJson(raw) {
  try {
    const cleaned = String(raw).replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.message) return parsed;
  } catch {
    /* fallback below */
  }
  return { message: String(raw || '').trim(), concerns: null, mood: 'neutral' };
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { allowed } = applyAiRateLimit(req, res, { authMax: 15, anonMax: 5 });
  if (!allowed) return;

  const started = Date.now();
  try {
    const { message, childName, childAge, childGender, character, systemPrompt, history, topic, isFirstMessage, requestType, timeContext } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const gender = normalizeGender(childGender);
    const sys = buildSystemPrompt({ childName, childAge, childGender: gender, character, systemPrompt, topic, isFirstMessage, requestType, timeContext });

    if (!process.env.DEEPSEEK_API_KEY) {
      const devReply = childName
        ? (gender === 'female'
          ? `Мурр! Рада тебя слышать, ${childName}! 🐱`
          : gender === 'male'
            ? `Мурр! Рад тебя слышать, ${childName}! 🐱`
            : `Мурр! Как хорошо слышать тебя, ${childName}! 🐱`)
        : 'Привет! Я кот Люцик. Как тебя зовут?';
      return res.status(200).json({
        reply: devReply,
        childName: null,
        childAge: null,
        concerns: null,
        mood: 'positive',
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

    const maxTokens = requestType === 'story' ? 400 : 100;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: maxTokens,
        temperature: 0.85
      })
    });

    if (!response.ok) throw new Error(`DeepSeek: ${response.status}`);
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty AI response');

    const parsed = parseAiJson(raw);
    const age = childAge ? Math.min(14, Math.max(3, parseInt(childAge, 10))) : 7;
    const safeMessage = applyGenderToText(sanitizeAIText(parsed.message, age), gender);
    return res.status(200).json({
      reply: safeMessage,
      type: parsed.type || requestType || 'chat',
      title: parsed.title || null,
      childName: parsed.childName || null,
      childAge: parsed.childAge != null ? parsed.childAge : null,
      concerns: parsed.concerns || null,
      mood: parsed.mood || 'neutral',
      ms: Date.now() - started
    });
  } catch (error) {
    console.error('Generate error:', error);
    return res.status(200).json({
      reply: 'Мурр... Я немного задумался. Давай попробуем ещё раз? 🐱',
      concerns: null,
      mood: 'neutral',
      ms: Date.now() - started
    });
  }
}
