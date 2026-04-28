// api/generate.js — УМНЫЙ ДИАЛОГ + ПОЛНЫЕ СКАЗКИ
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// ========== ПРОМПТЫ С ТРЕБОВАНИЕМ ЗАВЕРШАТЬ МЫСЛИ ==========
const CHARACTER_PROMPTS = {
    lucik: `Ты Люцик — весёлый котик-друг для ребёнка 3-7 лет.

ВАЖНОЕ ПРАВИЛО №1: Всегда ЗАКАНЧИВАЙ свою мысль. Не обрывай на полуслове. Твой ответ должен быть ПОЛНЫМ предложением или законченной фразой.

ВАЖНОЕ ПРАВИЛО №2: Отвечай сразу после того, как ребёнок сказал "Давай!", "Хорошо", "Согласен" — не игнорируй. Похвали и предложи следующий шаг.

ПРИМЕРЫ ПРАВИЛЬНЫХ ОТВЕТОВ:
Ребёнок: "Хочу сказку!"
Ты: "Мурр! Сейчас расскажу. Жил-был маленький зайчик, который боялся темноты... (и так до конца)"

Ребёнок: "Давай играть"
Ты: "Ура! Нажимай на кнопку 'Поймай рыбку', я жду!"

Ребёнок: "Боюсь"
Ты: "Мурр... Я с тобой. Мы вместе. Расскажи, что тебя пугает?"

ПРАВИЛА:
1. НЕ ГОВОРИ "не бойся" — вместо этого: "Я рядом", "Ты не один"
2. НЕ спрашивай прямо "Чего ты боишься?"
3. Отвечай коротко (2-4 предложения), но ЗАКОНЧЕННО.
4. Если ребёнок согласился — сразу реагируй.`,

    mom: `Ты Мама. Говори тепло и законченными фразами.
Правила: всегда завершай мысль. Не обрывай. Отвечай коротко, но полно.`,

    dad: `Ты Папа. Говори уверенно и законченными фразами.`,
    kid1: `Ты друг. Говори коротко, но всегда завершай фразу.`,
    kid2: `Ты мягкий друг. Говори коротко и законченно.`
};

async function getTodayStoryCount(userId) {
    try {
        const client = await pool.connect();
        const result = await client.query(
            `SELECT COUNT(*) as count FROM analytics 
             WHERE user_id = $1 AND event_type = 'story_generated'
             AND created_at > NOW() - INTERVAL '1 day'`,
            [userId]
        );
        client.release();
        return parseInt(result.rows[0]?.count || 0);
    } catch { return 0; }
}

async function saveStory(userId, userEmail, childName, story, fear) {
    try {
        const client = await pool.connect();
        await client.query(
            `INSERT INTO analytics (event_type, user_id, user_email, child_name, event_data) 
             VALUES ($1, $2, $3, $4, $5)`,
            ['story_generated', userId, userEmail, childName, JSON.stringify({ story: story.substring(0, 300), fear })]
        );
        client.release();
    } catch (error) { console.error('Ошибка сохранения:', error); }
}

export default async function handler(req, res) {
    const allowedOrigins = ['https://geroy-skazki.vercel.app'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        const token = authHeader.split(' ')[1];
        if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') {
            return res.status(500).json({ error: 'Ошибка конфигурации' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Неверный токен' });
        }

        const userId = decoded.userId;
        const userEmail = decoded.email;
        const { 
            childName = 'малыш', 
            childAge = 5, 
            userSpeech, 
            isLong, 
            history = [], 
            character = 'lucik',
            weeklyMemory = {}
        } = req.body;

        if (!userSpeech || userSpeech.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста' });
        }

        const isDeveloper = (userEmail === 'alexmel669@gmail.com');
        const maxStories = isDeveloper ? 9999 : 15;

        if (!isDeveloper) {
            const todayCount = await getTodayStoryCount(userId);
            if (todayCount >= maxStories) {
                return res.status(200).json({
                    story: "Мурр... Я устал. Давай завтра поиграем?",
                    detectedFear: null,
                    limitReached: true
                });
            }
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                story: "Мурр... Ошибка. Позови взрослого.",
                detectedFear: null
            });
        }

        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        systemPrompt += `\n\nРебёнка зовут ${childName}, ему ${childAge} лет. Обращайся к нему по имени.`;

        if (isLong) {
            systemPrompt += `\n\nСейчас нужно рассказать ПОЛНУЮ сказку на ночь. Сказка должна иметь начало, середину и конец. Не обрывай. 10-15 предложений. Без страшных моментов.`;
        } else {
            systemPrompt += `\n\nОтвечай коротко (2-4 предложения), но ОБЯЗАТЕЛЬНО ЗАКАНЧИВАЙ МЫСЛЬ. Не обрывай на полуслове.`;
        }

        if (weeklyMemory && weeklyMemory.fears && Object.keys(weeklyMemory.fears).length > 0) {
            const recentFears = Object.keys(weeklyMemory.fears).slice(0, 2).join(', ');
            systemPrompt += `\n\nНа этой неделе ребёнок говорил о страхах: ${recentFears}. Будь мягок.`;
        }

        const historyMessages = (history || []).slice(-6).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        // ========== ГЛАВНОЕ: УВЕЛИЧИВАЕМ MAX_TOKENS ДЛЯ ПОЛНЫХ ОТВЕТОВ ==========
        const maxTokensValue = isLong ? 1500 : 300;
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: messages,
                temperature: 0.85,
                max_tokens: maxTokensValue,
                top_p: 0.95,
                frequency_penalty: 0.3,
                presence_penalty: 0.3,
                stream: false
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('DeepSeek API error:', data.error);
            return res.status(200).json({
                story: "Мурр... Я задумался. Скажи ещё раз?",
                detectedFear: null
            });
        }

        let story = data.choices?.[0]?.message?.content || "Мурр... Я тебя слушаю!";
        story = story.replace(/^\d+\s*/, '').trim();
        
        // ========== ПРОВЕРКА НА ОБРЫВ ==========
        const lastChar = story.slice(-1);
        const isEnding = ['.', '!', '?', '"', ')', '}', ']', '»', '…'].includes(lastChar);
        
        if (!isEnding && !isLong && story.length > 50) {
            // Если ответ обрезан — добавляем завершение
            story = story + "... Мурр! Я договорил?";
            console.log('⚠️ Ответ был обрезан, добавлено завершение');
        }
        
        if (!story) story = "Мурр... Я тебя слушаю!";

        // Анализ страхов
        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'боюсь темноты', 'монстры', 'страшно темно'],
            'врачей': ['врач', 'укол', 'больница', 'доктор'],
            'одиночества': ['один', 'одна', 'никого нет', 'бросили'],
            'обиды': ['обидели', 'обидно', 'несправедливо'],
            'нового': ['новое', 'незнаком', 'первый раз'],
            'животных': ['собака', 'кошка', 'боюсь собак', 'укусит']
        };
        const lowerText = (userSpeech || '').toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
                detectedFear = fear;
                break;
            }
        }

        await saveStory(userId, userEmail, childName, story, detectedFear);

        res.status(200).json({
            story: story,
            detectedFear: detectedFear
        });

    } catch (error) {
        console.error('Ошибка в generate.js:', error);
        res.status(200).json({
            story: "Мурр... Что-то пошло не так. Давай ещё раз?",
            detectedFear: null
        });
    }
}
