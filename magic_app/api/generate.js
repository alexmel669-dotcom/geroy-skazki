// api/generate.js
// DeepSeek Chat API — FINAL production-ready version

import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// ======================================
// Vercel body limit
// ======================================
export const config = {
api: {
bodyParser: {
sizeLimit: '1mb'
}
}
};

// ======================================
// PostgreSQL Pool (global cache)
// ======================================
const pool =
global._pgPool ||
(global._pgPool = new Pool({
connectionString: process.env.POSTGRES_URL,
ssl: { rejectUnauthorized: false },
max: 3,
idleTimeoutMillis: 10000,
connectionTimeoutMillis: 5000
}));

// ======================================
// ENV
// ======================================
const JWT_SECRET = process.env.JWT_SECRET;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// ======================================
// Dynamic CORS
// ======================================
function getAllowedOrigin(req) {
const origin = req.headers.origin || req.headers.referer || '';

if (
origin.includes('geroy-skazki.vercel.app') ||
origin.includes('geroy-skazki-git-')
) {
return origin;
}

return 'https://geroy-skazki.vercel.app';
}

// ======================================
// Allowed characters
// ======================================
const ALLOWED_CHARACTERS = [
'lucik',
'mom',
'dad',
'kid1',
'kid2'
];

// ======================================
// RATE LIMIT
// ======================================
const RATE_LIMIT = new Map();

function cleanupRateLimit() {
const now = Date.now();

for (const [key, entry] of RATE_LIMIT.entries()) {
if (now > entry.resetAt) {
RATE_LIMIT.delete(key);
}
}
}

function checkRateLimit(ip, userId) {
cleanupRateLimit();

const now = Date.now();

const key =
userId !== 'guest'
? `user:${userId}`
: `ip:${ip}`;

const windowMs = 60_000;

const maxRequests =
userId !== 'guest'
? 20
: 5;

if (!RATE_LIMIT.has(key)) {
RATE_LIMIT.set(key, {
count: 1,
resetAt: now + windowMs
});

```
return true;
```

}

const entry = RATE_LIMIT.get(key);

if (now > entry.resetAt) {
RATE_LIMIT.set(key, {
count: 1,
resetAt: now + windowMs
});

```
return true;
```

}

if (entry.count >= maxRequests) {
return false;
}

entry.count++;

return true;
}

// ======================================
// Fear detection
// ======================================
function detectFear(text) {
if (!text) return null;

const lowerText = text.toLowerCase();

const fearPatterns = {
темноты: [
/темнот/,
/монстр/,
/страшно.*ноч/,
/боюсь.*темн/
],

```
врачей: [
  /врач/,
  /укол/,
  /больниц/,
  /доктор.*страш/,
  /боюсь.*укол/
],

одиночества: [
  /один .*страш/,
  /одна .*боюсь/,
  /без мамы/,
  /без папы/,
  /скучно.*один/,
  /боюсь.*один/
],

обиды: [
  /обидели/,
  /обидно/,
  /обидел/
],

нового: [
  /новое.*страш/,
  /боюсь.*нов/,
  /перемена.*школ/,
  /переезд.*боюсь/
],

животных: [
  /собака.*страш/,
  /паук/,
  /боюсь.*животн/,
  /страшно.*собак/
]
```

};

for (const [fear, patterns] of Object.entries(fearPatterns)) {
if (patterns.some(pattern => pattern.test(lowerText))) {
return fear;
}
}

return null;
}

// ======================================
// Sanitize
// ======================================
function sanitizeContent(content) {
if (!content || typeof content !== 'string') {
return '';
}

return content
.replace(/[<>"'`&]/g, '')
.replace(/javascript:/gi, '')
.replace(/on\w+=/gi, '')
.substring(0, 500);
}

// ======================================
// Fallbacks
// ======================================
const FALLBACKS = {
tired: {
lucik: 'Мурр... Я немного устал. Давай поиграем?',
mom: 'Я немного устала, давай поиграем, родной?',
dad: 'Устал немного. Давай поиграем?',
kid1: 'Фух, устал! Давай поиграем?',
kid2: 'Я устала... Давай поиграем?'
},

confused: {
lucik: 'Мурр... Я немного задумался. Давай ещё раз?',
mom: 'Ой, я задумалась... Давай ещё раз, солнышко?',
dad: 'Хм, задумался. Повтори?',
kid1: 'Ой, я задумался! Давай ещё разок?',
kid2: 'Я задумалась... Давай ещё раз?'
},

listening: {
lucik: 'Мурр... Я тебя слушаю!',
mom: 'Я тебя слушаю, мой хороший!',
dad: 'Я слушаю, продолжай!',
kid1: 'Я слушаю! Рассказывай!',
kid2: 'Я тебя слушаю...'
}
};

function safeFallback(key, char) {
return (
FALLBACKS[key]?.[char] ||
FALLBACKS[key]?.lucik ||
FALLBACKS.confused.lucik
);
}

// ======================================
// Character prompts
// ======================================
const CHARACTER_PROMPTS = {
lucik: `
Ты — Люцик, добрый кот-психолог.

Правила:

* Говори коротко (1-3 предложения)
* Используй "мурр" для успокоения
* Не начинай ответы с "Привет"
* Отвечай только на русском
* Будь спокойным и добрым
* Если ребёнок боится — успокой и поддержи
  `,

  mom: `
  Ты — заботливая мама.

Правила:

* Говори тепло и нежно
* Используй ласковые обращения
* Поддерживай ребёнка
* Не начинай ответы с "Привет"
* Отвечай только на русском
* Если ребёнок грустит — обними словами
  `,

  dad: `
  Ты — добрый и сильный папа.

Правила:

* Говори уверенно и спокойно
* Подбадривай ребёнка
* Хвали за смелость
* Не начинай ответы с "Привет"
* Отвечай только на русском
* Если ребёнок боится — скажи, что защитишь
  `,

  kid1: `
  Ты — весёлая подружка ребёнка.

Правила:

* Говори как ребёнок 5-7 лет
* Используй простые слова
* Будь игривой и весёлой
* Не начинай ответы с "Привет"
* Отвечай только на русском
* Предлагай игры и развлечения
  `,

  kid2: `
  Ты — дружелюбный друг ребёнка.

Правила:

* Говори просто и понятно
* Будь весёлым и энергичным
* Используй детские выражения
* Не начинай ответы с "Привет"
* Отвечай только на русском
* Поддерживай в играх и приключениях
  `
  };

// ======================================
// Save analytics
// ======================================
async function saveStory(userId, userEmail, childName, story, fear) {
if (!userId || userId === 'guest' || userId.length > 100) {
return;
}

if (!userEmail || userEmail === '[guest@example.com](mailto:guest@example.com)') {
return;
}

let client;

try {
client = await pool.connect();

```
await client.query(
  `
  INSERT INTO analytics (
    event_type,
    user_id,
    user_email,
    child_name,
    event_data
  )
  VALUES ($1,$2,$3,$4,$5)
  `,
  [
    'story_generated',
    userId.substring(0, 100),
    userEmail.substring(0, 255),
    childName.substring(0, 100),
    JSON.stringify({
      story: story.substring(0, 200),
      fear: fear || null
    })
  ]
);
```

} catch (e) {
console.error('saveStory error:', e.message);

} finally {
if (client) {
client.release();
}
}
}

// ======================================
// Fetch retry
// ======================================
async function fetchWithRetry(url, options, maxRetries = 2) {
for (let attempt = 0; attempt <= maxRetries; attempt++) {
try {
return await fetch(url, options);

```
} catch (error) {
  if (attempt === maxRetries) {
    throw error;
  }

  await new Promise(resolve =>
    setTimeout(resolve, Math.pow(2, attempt) * 500)
  );
}
```

}
}

// ======================================
// MAIN HANDLER
// ======================================
export default async function handler(req, res) {

// ======================================
// CORS
// ======================================
const allowedOrigin = getAllowedOrigin(req);

res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
res.setHeader('Access-Control-Allow-Credentials', 'true');
res.setHeader('Vary', 'Origin');

if (req.method === 'OPTIONS') {
return res.status(200).end();
}

if (req.method !== 'POST') {
return res.status(405).json({
error: 'Метод не поддерживается'
});
}

// ======================================
// Content-Type check
// ======================================
const contentType = req.headers['content-type'] || '';

if (!contentType.includes('application/json')) {
return res.status(400).json({
error: 'Only application/json supported'
});
}

try {

```
// ======================================
// AUTH
// ======================================
const authHeader = req.headers.authorization;

let userId = 'guest';
let userEmail = 'guest@example.com';

if (authHeader?.startsWith('Bearer ')) {

  const token = authHeader.split(' ')[1];

  if (
    token &&
    token !== 'null' &&
    !token.startsWith('guest_token_') &&
    JWT_SECRET
  ) {

    if (token.split('.').length === 3) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);

        userId =
          decoded.userId ||
          decoded.id ||
          'guest';

        userEmail =
          decoded.email ||
          'guest@example.com';

      } catch (e) {
        console.error('JWT verify error:', e.message);
      }
    }
  }
}

// ======================================
// RATE LIMIT
// ======================================
const clientIp =
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.socket.remoteAddress ||
  'unknown';

if (!checkRateLimit(clientIp, userId)) {
  return res.status(429).json({
    error: 'Слишком много запросов',
    reply: 'Мурр... Давай немного отдохнём и продолжим через минутку?',
    detectedFear: null
  });
}

// ======================================
// BODY
// ======================================
const body = req.body || {};

const message = sanitizeContent(
  String(body.message || body.userSpeech || '')
);

if (!message) {
  return res.status(400).json({
    error: 'Нет текста сообщения'
  });
}

// ======================================
// CHILD DATA
// ======================================
const childName = String(body.childName || 'малыш')
  .replace(/[<>"'`&]/g, '')
  .substring(0, 50);

const childAge = Math.min(
  Math.max(parseInt(body.childAge) || 5, 2),
  12
);

const isLong = Boolean(body.isLong);

const character =
  ALLOWED_CHARACTERS.includes(body.character)
    ? body.character
    : 'lucik';

// ======================================
// HISTORY
// ======================================
const rawHistory = Array.isArray(body.history)
  ? body.history
  : [];

const history = rawHistory
  .slice(-12)
  .filter(
    h =>
      h &&
      typeof h === 'object' &&
      (h.role === 'user' || h.role === 'assistant')
  )
  .map(h => ({
    role: h.role,
    content: sanitizeContent(h.content)
  }));

// ======================================
// FEAR STATS
// ======================================
const fearStats =
  body.fearStats &&
  typeof body.fearStats === 'object'
    ? body.fearStats
    : {};

// ======================================
// FIRST MESSAGE
// ======================================
const isFirstMessage = history.length === 0;

const detectedFear = detectFear(message);

if (isFirstMessage && !isLong && !detectedFear) {

  const greetings = {
    lucik: `Мурр, привет, ${childName}! Я котик Люцик. Расскажи, как дела?`,
    mom: `Привет, солнышко! Мама рядом. Как день прошёл?`,
    dad: `Привет, ${childName}! Папа слушает. Что интересного?`,
    kid1: 'Привет! Я твоя подружка. Давай играть?',
    kid2: 'Привет! Я твой друг. Расскажи что нового?'
  };

  return res.status(200).json({
    reply: greetings[character] || greetings.lucik,
    detectedFear: null
  });
}

// ======================================
// API KEY CHECK
// ======================================
if (!DEEPSEEK_API_KEY) {
  console.error('DEEPSEEK_API_KEY отсутствует');

  return res.status(200).json({
    reply: safeFallback('confused', character),
    detectedFear: null
  });
}

// ======================================
// SYSTEM PROMPT
// ======================================
let systemPrompt =
  CHARACTER_PROMPTS[character] ||
  CHARACTER_PROMPTS.lucik;

systemPrompt += `\nРебёнку ${childAge} лет.\n`;

if (childAge <= 7) {
  systemPrompt += 'Говори очень просто и коротко (1-2 предложения).\n';
} else {
  systemPrompt += 'Говори как старший добрый друг.\n';
}

if (Object.keys(fearStats).length > 0) {

  const topFear = Object.entries(fearStats)
    .sort((a, b) => b[1] - a[1])[0];

  systemPrompt += `\nГлавный страх ребёнка: "${topFear[0]}".\nБудь особенно бережным.\n`;
}

if (isLong) {
  systemPrompt += `
```

Расскажи законченную сказку на ночь.

Требования:

* Ровно 5-7 предложений
* Добрый и счастливый финал
* Никаких страшных сцен
* Используй звёзды, луну, облака
* Заверши словами:
  "Спокойной ночи" или "Сказка закончена"
  `;
  }

  // ======================================
  // CHAT MESSAGES
  // ======================================
  const messages = [
  {
  role: 'system',
  content: systemPrompt
  },

  ```
  ...history,

  {
    role: 'user',
    content: message
  }
  ```

  ];

  // ======================================
  // DEEPSEEK REQUEST
  // ======================================
  const controller = new AbortController();

  const timeout = setTimeout(() => {
  controller.abort();
  }, 8000);

  let data;

  try {

  ```
  const response = await fetchWithRetry(
    'https://api.deepseek.com/v1/chat/completions',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`
      },

      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: isLong ? 550 : 180,
        stream: false
      }),

      signal: controller.signal
    }
  );

  clearTimeout(timeout);

  try {
    data = await response.json();

  } catch (jsonError) {

    return res.status(200).json({
      reply: safeFallback('confused', character),
      detectedFear: detectedFear || null
    });
  }

  if (!response.ok) {
    console.error('DeepSeek API error:', {
      status: response.status,
      error: data?.error?.message || 'Unknown error'
    });
  }
  ```

  } catch (fetchError) {

  ```
  clearTimeout(timeout);

  if (fetchError.name === 'AbortError') {

    return res.status(200).json({
      reply: safeFallback('tired', character),
      detectedFear: detectedFear || null
    });
  }

  throw fetchError;
  ```

  }

  // ======================================
  // RESPONSE
  // ======================================
  let reply =
  data?.choices?.[0]?.message?.content ||
  safeFallback('listening', character);

  reply = sanitizeContent(reply);

  if (
  !isFirstMessage &&
  reply.trim().toLowerCase().startsWith('привет')
  ) {
  reply = reply
  .replace(/^привет[,\s]*/i, '')
  .trim();
  }

  if (!reply || reply.length < 2) {
  reply = safeFallback('confused', character);
  }

  reply = reply
  .replace(/^\d+[.)]\s*/, '')
  .trim();

  // ======================================
  // ANALYTICS
  // ======================================
  if (userId !== 'guest') {
  await saveStory(
  userId,
  userEmail,
  childName,
  reply,
  detectedFear
  );
  }

  // ======================================
  // FINAL RESPONSE
  // ======================================
  return res.status(200).json({
  reply,
  detectedFear: detectedFear || null
  });

  } catch (error) {

  console.error(
  'generate error:',
  error.message
  );

  const character =
  req.body?.character &&
  ALLOWED_CHARACTERS.includes(req.body.character)
  ? req.body.character
  : 'lucik';

  return res.status(200).json({
  reply: safeFallback('confused', character),
  detectedFear: null
  });
  }
  }
