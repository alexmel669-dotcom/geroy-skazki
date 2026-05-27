// api/generate.js — DeepSeek Chat (безопасность, rate limit, валидация, память, таймаут)
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// ✅ Пул соединений с глобальным кешем (пункт 5)
const pool = global._pgPool || (global._pgPool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000
}));

const JWT_SECRET = process.env.JWT_SECRET;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const ALLOWED_ORIGIN = 'https://geroy-skazki.vercel.app';

// ✅ Белый список персонажей (пункт 3)
const ALLOWED_CHARACTERS = ['lucik', 'mom', 'dad', 'kid1', 'kid2'];

// ✅ Rate limiting (пункт 2)
const RATE_LIMIT = new Map();

function checkRateLimit(ip, userId) {
    const now = Date.now();
    const key = userId !== 'guest' ? `user:${userId}` : `ip:${ip}`;
    const windowMs = 60_000;
    const maxRequests = userId !== 'guest' ? 20 : 5;
    
    if (!RATE_LIMIT.has(key)) {
        RATE_LIMIT.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    
    const entry = RATE_LIMIT.get(key);
    if (now > entry.resetAt) {
        RATE_LIMIT.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    
    if (entry.count >= maxRequests) return false;
    entry.count++;
    return true;
}

// ✅ Детекция страха вынесена в функцию (пункт 4)
function detectFear(text) {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    const fearKeywords = {
        'темноты': ['темнот', 'монстр', 'ночью', 'страшно в темноте'],
        'врачей': ['врач', 'укол', 'больница', 'доктор'],
        'одиночества': ['один', 'одна', 'без мамы', 'без папы', 'скучно'],
        'обиды': ['обидели', 'обидно', 'обидел'],
        'нового': ['новое', 'перемена', 'переезд', 'боюсь нового'],
        'животных': ['собака', 'кошка', 'паук', 'животных']
    };
    for (const [fear, keywords] of Object.entries(fearKeywords)) {
        if (keywords.some(k => lowerText.includes(k))) return fear;
    }
    return null;
}

// Fallback-фразы
const FALLBACKS = {
    tired: {
        lucik: "Мурр... Я немного устал. Давай поиграем?",
        mom: "Я немного устала, давай поиграем, родной?",
        dad: "Устал немного. Давай поиграем?",
        kid1: "Фух, устал! Давай поиграем?",
        kid2: "Я устала... Давай поиграем?"
    },
    confused: {
        lucik: "Мурр... Я немного задумался. Давай ещё раз?",
        mom: "Ой, я задумалась... Давай ещё раз, солнышко?",
        dad: "Хм, задумался. Повтори?",
        kid1: "Ой, я задумался! Давай ещё разок?",
        kid2: "Я задумалась... Давай ещё раз?"
    },
    listening: {
        lucik: "Мурр... Я тебя слушаю!",
        mom: "Я тебя слушаю, мой хороший!",
        dad: "Я слушаю, продолжай!",
        kid1: "Я слушаю! Рассказывай!",
        kid2: "Я тебя слушаю..."
    }
};

function safeFallback(key, char) {
    return FALLBACKS[key]?.[char] || FALLBACKS[key]?.lucik || FALLBACKS.confused.lucik;
}

const CHARACTER_PROMPTS = {
    lucik: `Ты — Люцик, добрый кот-психолог. Говори коротко, без "Привет" в середине диалога. Используй "мурр". Отвечай на русском.`,
    mom: `Ты — Мама. Говори заботливо, нежно. Никогда не начинай ответ с "Привет" в середине диалога.`,
    dad: `Ты — Папа. Говори уверенно, подбадривай. Без "Привет" в середине диалога.`,
    kid1: `Ты — друг-девочка. Говори по-детски, весело. Без лишних приветствий.`,
    kid2: `Ты — друг-мальчик. Говори дружелюбно, по-детски. Без "Привет" в каждом ответе.`
};

async function saveStory(userId, userEmail, childName, story, fear) {
    try {
        const client = await pool.connect();
        await client.query(
            `INSERT INTO analytics (event_type, user_id, user_email, child_name, event_data) VALUES ($1,$2,$3,$4,$5)`,
            ['story_generated', userId, userEmail, childName, JSON.stringify({ story: story.substring(0, 200), fear })]
        );
        client.release();
    } catch (e) {
        console.error('saveStory error', e);
    }
}
export default async function handler(req, res) {
    // ✅ CORS с конкретным origin (пункт 1)
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        // --- Аутентификация ---
        const authHeader = req.headers.authorization;
        let userId = 'guest';
        let userEmail = 'guest@example.com';

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token && token !== 'null' && !token.startsWith('guest_token_') && JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me') {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    userId = decoded.userId || decoded.id || 'guest';
                    userEmail = decoded.email || 'guest@example.com';
                } catch (e) {
                    // токен невалидный — остаёмся гостем
                }
            }
        }

        // ✅ Rate limiting (пункт 2)
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit(clientIp, userId)) {
            return res.status(429).json({
                error: 'Слишком много запросов',
                reply: 'Мурр... Я немного устал. Давай подождём минутку?',
                detectedFear: null
            });
        }

        // ✅ Валидация и санитизация входящих данных (пункт 3)
        const body = req.body || {};
        const rawMessage = String(body.message || body.userSpeech || '');
        const message = rawMessage.trim().substring(0, 500);
        
        if (!message) {
            return res.status(400).json({ error: 'Нет текста сообщения' });
        }

        const childName = String(body.childName || 'малыш')
            .replace(/[<>"'`&]/g, '')
            .substring(0, 50);
        
        const childAge = Math.min(Math.max(parseInt(body.childAge) || 5, 2), 12);
        
        const isLong = Boolean(body.isLong);
        
        const character = ALLOWED_CHARACTERS.includes(body.character) ? body.character : 'lucik';
        
        // ✅ История валидируется (пункт 3)
        const rawHistory = Array.isArray(body.history) ? body.history : [];
        const history = rawHistory
            .slice(-12)
            .filter(h => h && typeof h === 'object' && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
            .map(h => ({ role: h.role, content: h.content.substring(0, 500) }));

        // ✅ fearStats для персонализации (пункт 8)
        const fearStats = body.fearStats && typeof body.fearStats === 'object' ? body.fearStats : {};

        // --- Проверка первого сообщения с детекцией страха (пункт 4) ---
        const isFirstMessage = history.length === 0;
        const detectedFear = detectFear(message);

        if (isFirstMessage && !isLong && !detectedFear) {
            const greetings = {
                lucik: `Мурр, привет, ${childName}! Я котик Люцик. Расскажи, как дела?`,
                mom: `Привет, солнышко! Мама рядом. Как день прошёл?`,
                dad: `Привет, ${childName}! Папа слушает. Что интересного?`,
                kid1: `Привет! Я твоя подружка. Давай играть?`,
                kid2: `Привет! Я твой друг. Расскажи что нового?`
            };
            return res.status(200).json({
                reply: greetings[character] || greetings.lucik,
                detectedFear: null
            });
        }

        // --- Проверка API ключа ---
        if (!DEEPSEEK_API_KEY) {
            console.error('DEEPSEEK_API_KEY не настроен');
            return res.status(200).json({
                reply: safeFallback('confused', character),
                detectedFear: null
            });
        }

        // --- Формирование промпта ---
        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        systemPrompt += `\nРебёнку ${childAge} лет. Говори ${childAge <= 7 ? 'просто, коротко' : 'как старший друг'}.`;
        
        // ✅ Добавляем fearStats (пункт 8)
        if (Object.keys(fearStats).length > 0) {
            const topFear = Object.entries(fearStats).sort((a, b) => b[1] - a[1])[0];
            systemPrompt += `\nУ ребёнка главный страх: "${topFear[0]}" (проявлялся ${topFear[1]} раз). Будь особенно бережен к этой теме.`;
        }
        
        if (isLong) {
            systemPrompt += `\nРасскажи законченную сказку на ночь (5-7 предложений). Обязательно заверши фразой "Спокойной ночи" или "Сказка закончена".`;
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: message }
        ];

        // --- Запрос к DeepSeek с таймаутом (пункты 6, 7) ---
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        let data;
        try {
            const startTime = Date.now();
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',  // ✅ Пункт 7
                    messages,
                    temperature: 0.7,
                    max_tokens: isLong ? 550 : 180,
                    stream: false
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            data = await response.json();
            console.log(`DeepSeek ответ за ${Date.now() - startTime}ms`);
        } catch (fetchError) {
            clearTimeout(timeout);
            if (fetchError.name === 'AbortError') {
                console.error('DeepSeek timeout после 8 сек');
                return res.status(200).json({
                    reply: safeFallback('tired', character),
                    detectedFear: detectedFear || null
                });
            }
            throw fetchError;
        }

        // --- Обработка ответа ---
        let reply = data.choices?.[0]?.message?.content || safeFallback('listening', character);

        // Убираем "Привет" если не первое сообщение
        if (!isFirstMessage && reply.trim().toLowerCase().startsWith('привет')) {
            reply = reply.replace(/^привет[,\s]*/i, '').trim();
        }

        if (!reply || reply.length < 2) {
            reply = safeFallback('confused', character);
        }

        // Убираем нумерацию в начале
        reply = reply.replace(/^\d+\s*/, '').trim();

        // --- Сохранение в аналитику ---
        if (userId !== 'guest') {
            await saveStory(userId, userEmail, childName, reply, detectedFear);
        }

        // ✅ Только reply, без дублирования story (пункт 9)
        return res.status(200).json({
            reply,
            detectedFear: detectedFear || null
        });

    } catch (error) {
        console.error('generate error:', error);
        const character = (req.body?.character && ALLOWED_CHARACTERS.includes(req.body.character))
            ? req.body.character
            : 'lucik';
        return res.status(200).json({
            reply: safeFallback('confused', character),
            detectedFear: null
        });
    }
}
