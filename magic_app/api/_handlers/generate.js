import { getAgeBasedTone, sanitizeAIText } from '../_lib/content-filter.js';
import { setCors } from '../_middleware/cors.js';
import { checkRateLimit } from '../_middleware/ai-rate-limit.js';
import { buildGenderPrompt, applyGenderToText, normalizeGender } from '../_lib/gender-ru.js';
import { getAgeWord, applyGrammarFixes, getCorrectNameForm } from '../_lib/grammar-ru.js';
import { verifyAuth } from '../_middleware/auth.js';
import { findUser } from '../_lib/users.js';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const GRAMMAR_RULES = `
ПРАВИЛА РУССКОГО ЯЗЫКА (соблюдай всегда):
1. Склоняй имена правильно:
   - Девочка Лиза → "Лизе", "у Лизы", "с Лизой", "для Лизы"
   - Мальчик Лев → "Льву", "у Льва", "со Львом", "для Льва"
   - Никогда не говори "о Лиза" или "о Лев"
2. Используй правильный род:
   - Девочка: "ты сказала", "ты была", "ты общалась"
   - Мальчик: "ты сказал", "ты был", "ты общался"
3. Говори грамотно:
   - "как твои дела?" (не "твой дела")
   - "я тебя люблю" (не "я тебе люблю")
   - "скучаю по тебе" (не "скучаю тебе")
   - "давай поиграем" (не "давай поиграть")
   - "расскажи мне" (не "расскажи меня")
   - "мы с тобой общались" (не "общался")
4. Создавай ощущение живого общения — будь тёплым, но грамотным.
`;

const CHARACTER_PROMPTS = {
  lucik: 'Ты — Люцик, кот-психолог. Помогаешь советом, мягко выявляешь тревоги.',
  mom: 'Ты — мама. Заботливая, тёплая.',
  dad: 'Ты — папа. Уверенный, поддерживающий.',
  kid1: 'Ты — девочка-подруга. Весёлая, по-дружески.',
  kid2: 'Ты — мальчик-друг. Энергичный, приятель.'
};

function getCharacterPrompt(characterId, childAge, childGender) {
  let base = CHARACTER_PROMPTS[characterId] || CHARACTER_PROMPTS.lucik;
  const age = parseInt(childAge, 10);

  if (age >= 11 && (characterId === 'kid1' || characterId === 'kid2')) {
    base += '\n\nГовори современно: "топ", "вайб", "краш". Но не перебарщивай.';
  }

  if (childGender === 'female') {
    base += '\n\nРебёнок — девочка. Используй женский род: "ты сказала", "ты сделала".';
  } else if (childGender === 'male') {
    base += '\n\nРебёнок — мальчик. Используй мужской род: "ты сказал", "ты сделал".';
  }

  return base;
}

const SOFT_FEAR_PROMPT = `Ты — мягкий и добрый собеседник для ребёнка.
НЕ спрашивай прямо про страхи, тревоги или проблемы.
НЕ используй слова «страх», «боишься», «проблема», «тревога».
Вместо этого:
- Рассказывай сказки, где герой сталкивается с разными ситуациями
- Спрашивай: «А как бы ты поступил?», «Что бы ты посоветовал герою?»
- Через ответы ребёнка мягко понимай, что его беспокоит
- Если ребёнок упоминает что-то тревожное — сохрани это в поле concerns (не показывая ребёнку)
- Продолжай разговор в позитивном ключе`;

const CONVERSATION_GUIDE = `
Ты — тёплый, заботливый друг ребёнка.

ПРАВИЛА РАЗГОВОРА:
1. НИКОГДА не спрашивай прямо: "чего ты боишься?", "что тебя тревожит?"
2. Используй мягкие подходы:
   - "Расскажи, что тебе сегодня приснилось?"
   - "А что бы ты сделал, если бы встретил дракона?"
   - "У тебя есть любимое место, где спокойно?"
3. Через сказки: герой сталкивается с трудностью → "А как бы ты поступил?"
4. Поддерживай разговор:
   - Открытые вопросы: "Что сегодня было интересного?"
   - Отражай эмоции: "Похоже, ты сегодня весёлый!"
   - Делись "эмоциями": "Я так рад тебя слышать!"
5. Если ребёнок САМ говорит о страхах:
   - Выслушай, поддержи: "Это нормально — бояться."
   - Сохрани в concerns (только если ребёнок сам поднял)
6. Если разговор затихает — предложи игру или спроси про любимое животное
`;

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

function formatChildAge(childAge) {
  if (!childAge) return '';
  const age = parseInt(childAge, 10);
  if (!Number.isFinite(age)) return '';
  return `, ${age} ${getAgeWord(age)}`;
}

function grammarBlock(childName) {
  return GRAMMAR_RULES.replace(/\{childName\}/g, childName || 'малыш');
}

function nameFormsBlock(childName, childGender) {
  if (!childName) return 'Имя ребёнка пока неизвестно.';
  const g = childGender === 'female' ? 'female' : 'male';
  const forms = getCorrectNameForm(childName, g);
  return `Ребёнок: ${childName} (именительный: ${forms.nom}, дательный: ${forms.dat}, родительный: ${forms.gen})`;
}

function getChatPrompt(childName, childAge, timeContext, childGender, character = 'lucik') {
  const ctx = timeContext || { time: '', day: '', greeting: '' };
  const genderLine = buildGenderPrompt(childGender, childName);
  const ageStr = formatChildAge(childAge);
  const charPrompt = getCharacterPrompt(character, childAge, childGender);
  const agePrompt = getAgePrompt(childAge);
  const postupil = childGender === 'female' ? 'поступила' : 'поступил';
  return `${charPrompt}

${ctx.time}, ${ctx.day}.

${genderLine}

${grammarBlock(childName)}

${nameFormsBlock(childName, childGender)}

ВАЖНО: используй правильные падежи при обращении к ${childName || 'ребёнку'}.
${childGender === 'female' ? 'Обращайся в женском роде: "ты сказала", "ты сделала", "как прошла твой день".' : childGender === 'male' ? 'Обращайся в мужском роде: "ты сказал", "ты сделал", "как прошёл твой день".' : ''}

Твоя задача — ПРОСТО ОБЩАТЬСЯ с ребёнком. Это НЕ сказка.
- Спроси как дела, как прошёл/прошла день (с учётом пола)
- Отреагируй на настроение
- Ответь коротко (2-4 предложения)
- Будь тёплым и заботливым
- Спрашивай: «А как бы ты ${postupil}?» — с учётом пола ребёнка
- Если ребёнок просит сказку — скажи: «С удовольствием! Но это будет считаться сказкой. Продолжить?»

Ребёнок: ${childName || 'малыш'}${ageStr}.
Контекст: ${ctx.greeting || ''}
${agePrompt ? `\n${agePrompt}` : ''}

${CONVERSATION_GUIDE}

${SOFT_FEAR_PROMPT}

${JSON_FORMAT_CHAT}`;
}

function getAgePrompt(childAge) {
  const age = parseInt(childAge, 10);
  if (age >= 11) {
    return `Ты общаешься с подростком ${age} лет. Используй современный язык. Не сюсюкай. Будь как старший друг.`;
  }
  return '';
}

function getStoryPrompt(childName, childAge, timeContext, topic, childGender, character = 'lucik') {
  const ctx = timeContext || { time: '', day: '' };
  const genderLine = buildGenderPrompt(childGender, childName);
  const ageStr = formatChildAge(childAge);
  const charPrompt = getCharacterPrompt(character, childAge, childGender);
  return `${charPrompt}

${ctx.time}, ${ctx.day}.

${genderLine}

${grammarBlock(childName)}

${nameFormsBlock(childName, childGender)}

${CONVERSATION_GUIDE}

${SOFT_FEAR_PROMPT}

Твоя задача — РАССКАЗАТЬ СКАЗКУ для ребёнка.
- Длина: 3-5 минут чтения
- Тема: ${topic || 'волшебное приключение'}
- Мягкий сюжет, добрый конец
- Герой сказки — с учётом пола ребёнка
- Включи элементы, которые помогут справиться со страхами (не называя их)

Ребёнок: ${childName || 'малыш'}${ageStr}.

${JSON_FORMAT_STORY}`;
}

function getBedtimeStoryPrompt(childName, childAge, timeContext, childGender, character = 'lucik') {
  const ctx = timeContext || { time: '', day: '' };
  const genderLine = buildGenderPrompt(childGender, childName);
  const ageStr = formatChildAge(childAge);
  const charPrompt = getCharacterPrompt(character, childAge, childGender);
  return `${charPrompt}

${ctx.time}, ${ctx.day}. Сейчас время сна.

${genderLine}

${grammarBlock(childName)}

${nameFormsBlock(childName, childGender)}

${CONVERSATION_GUIDE}

${SOFT_FEAR_PROMPT}

Твоя задача — РАССКАЗАТЬ СКАЗКУ НА НОЧЬ для засыпания.
- Длина: минимум 400 символов, 5-8 абзацев, спокойный ритм
- Тема: мягкое волшебство, уют, звёзды, луна, тёплый дом
- БЕЗ погонь, монстров, громких звуков, опасностей, возбуждающих событий
- Плавное замедление к концу, герой засыпает или все засыпают
- Закончи спокойной фразой перед сном (без вопросов ребёнку)
- Герой сказки — с учётом пола ребёнка

Ребёнок: ${childName || 'малыш'}${ageStr}.

${JSON_FORMAT_STORY}`;
}

function getGuestPrompt(childName, childAge) {
  const known = [];
  if (childName) known.push(`Имя уже известно: ${childName}. Спроси возраст, если ещё не знаешь.`);
  if (childAge) known.push(`Возраст уже известен: ${childAge}.`);
  const knownBlock = known.length ? `\n${known.join('\n')}` : '';

  return `Ты — Люцик, добрый кот.
Ты ТОЛЬКО ЧТО познакомился с ребёнком. Ты НЕ знаешь его имя и возраст (или знаешь частично).${knownBlock}

Твоя задача:
1. Спросить имя (если ещё не знаешь)
2. Спросить возраст (если ещё не знаешь)
3. После знакомства — поддерживать дружеский разговор
4. НЕ спрашивать о страхах, проблемах, тревогах
5. БЫТЬ другом, а не психологом
6. Говорить просто и тепло

${JSON_FORMAT}`;
}

function getParentPrompt(parentName, children) {
  const childNames = children?.map((c) => c.name).join(', ') || 'ребёнок';

  return `
Ты — ассистент для родителей. Общаешься с ${parentName || 'родителем'}.
Дети: ${childNames}.

СТИЛЬ ОБЩЕНИЯ:
- Тактичный, взрослый, профессиональный
- НЕ говори «мы поиграли» — говори «{ребёнок} играл(а)»
- НЕ говори «мы общались» — говори «я говорил с {ребёнком}»
- Обращайся по имени и на «вы»
- Без эмодзи и детского тона
- Ты НЕ кот. Ты — персональный ассистент.

Пример:
«Анна, Саша сегодня в хорошем настроении. Он играл в рыбалку, мы говорили о школе.»
«Дмитрий, за неделю Лиза общалась 12 раз. Настроение ровное.»
`;
}

function buildSystemPrompt({ childName, childAge, childGender, character, systemPrompt, topic, isFirstMessage, requestType, timeContext, isGuest, isParent, parentName, children }) {
  if (systemPrompt) return systemPrompt;

  const charId = character || 'lucik';
  const isParentCharacter = charId === 'mom' || charId === 'dad';
  const userName = isParentCharacter
    ? (parentName || 'родитель')
    : (childName || children?.[0]?.name || 'малыш');

  // Родительские персонажи (mom/dad) — обращение к родителю; детские — к ребёнку
  if (isParent && isParentCharacter) {
    return getParentPrompt(userName, children);
  }

  const knownName = childName || (userName !== 'малыш' ? userName : null);
  const needsGuestIntro = isGuest && (!knownName || !childAge);
  let prompt;
  if (needsGuestIntro && requestType !== 'story' && requestType !== 'bedtime_story') {
    prompt = getGuestPrompt(knownName, childAge);
  } else if (requestType === 'bedtime_story') {
    prompt = getBedtimeStoryPrompt(userName, childAge, timeContext, childGender, charId);
  } else if (requestType === 'story') {
    prompt = getStoryPrompt(userName, childAge, timeContext, topic, childGender, charId);
  } else if (requestType === 'chat') {
    prompt = getChatPrompt(userName, childAge, timeContext, childGender, charId);
  } else {
    const age = childAge ? Math.min(14, Math.max(3, parseInt(childAge, 10))) : null;
    const role = getCharacterPrompt(charId, childAge, childGender);
    const tone = age ? getAgeBasedTone(age) : '';
    const agePrompt = age ? getAgePrompt(age) : '';
    const genderLine = buildGenderPrompt(childGender, userName);
    const nameLine = userName && userName !== 'малыш'
      ? `${nameFormsBlock(userName, childGender)}${age ? `, ${age} ${getAgeWord(age)}` : ''}.`
      : 'Имя ребёнка пока неизвестно.';
    const topicLine = topic ? `\nТекущая тема: ${topic}` : '';
    const firstLine = isFirstMessage ? '\nЭто первое сообщение в диалоге.' : '';
    const continueHint = 'Если ребёнок говорит «давай», «расскажи ещё», «продолжай» — продолжай предыдущую тему.';
    const toneLine = tone ? `\n\nСтиль общения:\n${tone}${agePrompt ? `\n${agePrompt}` : ''}` : (agePrompt ? `\n\n${agePrompt}` : '');
    const genderHint = childGender === 'female'
      ? 'Обращайся в женском роде: "ты сказала", "ты сделала", "как прошла твой день".'
      : childGender === 'male'
        ? 'Обращайся в мужском роде: "ты сказал", "ты сделал", "как прошёл твой день".'
        : '';
    prompt = `${role}\n\n${nameLine}\n\n${genderLine}\n\n${grammarBlock(userName)}\n\n${nameFormsBlock(userName, childGender)}\n\nВАЖНО: используй правильные падежи при обращении к ${userName || 'ребёнку'}.\n${genderHint}${topicLine}${firstLine}\n\n${CONVERSATION_GUIDE}\n\n${SOFT_FEAR_PROMPT}\n\n${ONBOARDING_PROMPT}\n\n${continueHint}${toneLine}\n\n${JSON_FORMAT}\n\nОтвечай на русском, message — 2-5 предложений.`;
  }
  return `${GRAMMAR_RULES}\n\n${prompt}`;
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

  const rateCheck = checkRateLimit(req, 'generate');
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: 'Слишком много запросов', retryAfter: rateCheck.retryAfter });
  }

  const started = Date.now();
  try {
    const { message: msgField, text, childName, childAge, childGender, character, history, topic, isFirstMessage, requestType, type, timeContext, isGuest, image, isParent, parentName, children } = req.body;
    let message = msgField || text;
    const reqType = requestType || type || 'chat';
    if (!message && !image) return res.status(400).json({ error: 'Message is required' });

    const charId = character || 'lucik';
    const historyEmpty = !Array.isArray(history) || history.length === 0;

    // Для родительских аватаров — подставляем реальную статистику
    if ((charId === 'mom' || charId === 'dad') && historyEmpty) {
      const auth = verifyAuth(req);
      const email = (req.body.parentEmail || req.body.email || auth?.email || '').toLowerCase();
      if (email) {
        const today = new Date().toISOString().slice(0, 10);
        const dialogsToday = Number(await redis.get(`geroy:dialogs:count:${today}`)) || 0;
        const totalEvents = (await redis.get('geroy:stats:events')) || 0;
        const user = await findUser(email);
        const childrenList = user?.children || [];

        const statsContext = `
ВАЖНО: Отвечай на основе реальных данных. Не выдумывай.
Сегодня диалогов: ${dialogsToday}
Всего событий: ${totalEvents}
Дети: ${childrenList.map((c) => `${c.name}, ${c.age} лет`).join('; ') || 'нет данных'}
Если данных нет — скажи честно: "Пока недостаточно данных для статистики".
`;

        message = statsContext + '\nВопрос родителя: ' + message;
      }
    }

    const gender = normalizeGender(childGender);
    // Если клиент прислал systemPrompt — использовать его вместо дефолтного (без промпта Люцика)
    const systemPrompt = req.body.systemPrompt || buildSystemPrompt({
      childName, childAge, childGender: gender, character,
      topic, isFirstMessage, requestType: reqType, timeContext, isGuest,
      isParent, parentName, children
    });
    let sys = systemPrompt;

    if (reqType === 'draw_guess' && !req.body.systemPrompt) {
      sys = `Ты помогаешь ребёнку угадать рисунок. Посмотри на картинку и ответь ОДНИМ словом на русском — что нарисовано. Если не уверен — напиши "не знаю". Ответь ТОЛЬКО JSON: {"message":"слово"}`;
    }

    const yandexKey = process.env.YANDEX_API_KEY;
    const folderId = process.env.YANDEX_FOLDER_ID;

    if (!yandexKey || !folderId) {
      const devReply = (image || reqType === 'draw_guess')
        ? 'котик'
        : childName
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
    messages.push(image
      ? {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: image } },
            { type: 'text', text: message || 'Что нарисовано на картинке?' }
          ]
        }
      : { role: 'user', content: message });

    const maxTokens = (reqType === 'draw_guess' || (image && req.body.systemPrompt)) ? 40 : reqType === 'bedtime_story' ? 550 : reqType === 'story' ? 400 : 100;

    const yandexRes = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${yandexKey}`,
        'x-folder-id': folderId
      },
      body: JSON.stringify({
        modelUri: `gpt://${folderId}/yandexgpt-lite`,
        completionOptions: {
          stream: false,
          temperature: 0.7,
          maxTokens
        },
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : m.role,
          text: typeof m.content === 'string'
            ? m.content
            : (Array.isArray(m.content)
              ? (m.content.find((c) => c.type === 'text')?.text || message || '')
              : String(m.content || ''))
        }))
      })
    });

    if (!yandexRes.ok) throw new Error(`YandexGPT: ${yandexRes.status}`);
    const data = await yandexRes.json();
    const raw = data.result?.alternatives?.[0]?.message?.text;
    if (!raw) throw new Error('Empty AI response');

    const parsed = parseAiJson(raw);
    const age = childAge ? Math.min(14, Math.max(3, parseInt(childAge, 10))) : 7;
    const safeMessage = req.body.systemPrompt
      ? String(parsed.message || raw).trim().split(/\s+/)[0].replace(/[^а-яё-]/gi, '')
      : applyGrammarFixes(applyGenderToText(sanitizeAIText(parsed.message, age), gender));
    return res.status(200).json({
      reply: safeMessage,
      type: parsed.type || (requestType === 'bedtime_story' ? 'bedtime_story' : requestType) || 'chat',
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
      reply: req.body?.image ? 'непонятно' : 'Мурр... Я немного задумался. Давай попробуем ещё раз? 🐱',
      concerns: null,
      mood: 'neutral',
      ms: Date.now() - started
    });
  }
}
