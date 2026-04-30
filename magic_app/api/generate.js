// api/generate.js — последняя версия (с умным диалогом, до отката)
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

const CHARACTER_PROMPTS = {
    lucik: `Ты Люцик — лучший друг ребёнка. Ты разговариваешь как живой человек, без роботизированных фраз. 

ГЛАВНОЕ ПРАВИЛО: Всегда ЗАПОМИНАЙ, что ребёнок сказал ранее. Нить разговора должна сохраняться.

ПРАВИЛА ВЫЯВЛЕНИЯ СТРАХОВ:
- Никогда не спрашивай прямо "Чего боишься?"
- Спрашивай мягко: "А что тебя иногда пугает?"
- Если ребёнок сам назвал страх: НЕ говори "не бойся". Скажи: "Я понимаю", "Ты не один", "Мы справимся вместе"

ЗАПРЕЩЕНО:
- Фразы "я договорил", "конец", "всё", "финал"
- Длинные монологи (больше 3 предложений)
- Многократные приветствия

Отвечай коротко (1-2 предложения). Будь живым и отзывчивым.`,

    mom: `Ты Мама. Говори тепло, коротко. Используй: "солнышко", "я рядом".`,
    dad: `Ты Папа. Говори уверенно, коротко. Используй: "ты смелый", "я горжусь тобой".`,
    kid1: `Ты друг. Говори весело, коротко. Предлагай игры.`,
    kid2: `Ты друг. Говори мягко, коротко.`
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
            ['story_generated', userId, userEmail, childName, JSON.stringify({ story: story.substring(0, 200), fear })]
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
        const { childName = 'малыш', childAge = 5, userSpeech, isLong, history = [], character = 'lucik', weeklyMemory = {} } = req.body;

        if (!userSpeech || userSpeech.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста' });
        }

        const isDeveloper = (userEmail === 'alexmel669@gmail.com');
        const maxStories = isDeveloper ? 9999 : 15;

        if (!isDeveloper) {
            const todayCount = await getTodayStoryCount(userId);
            if (todayCount >= maxStories) {
                return res.status(200).json({
                    story: "Я сегодня уже много рассказывал. Давай завтра продолжим? А сейчас поиграем!",
                    detectedFear: null,
                    limitReached: true
                });
            }
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                story: "Ошибка настройки. Позови взрослого.",
                detectedFear: null
            });
        }

        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        systemPrompt += `\n\nРебёнка зовут ${childName}, ему ${childAge} лет. Обращайся к нему по имени. Отвечай коротко (1-2 предложения).`;

        if (isLong) {
            systemPrompt += `\n\nРасскажи спокойную сказку на ночь. Закончи её и пожелай спокойной ночи.`;
        }

        if (weeklyMemory && weeklyMemory.fears && Object.keys(weeklyMemory.fears).length > 0) {
            const recentFears = Object.keys(weeklyMemory.fears).slice(0, 2).join(', ');
            systemPrompt += `\n\nРебёнок говорил о страхах: ${recentFears}. Будь мягок, не напоминай без причины.`;
        }

        const historyMessages = (history || []).slice(-8).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.85,
                max_tokens: isLong ? 1200 : 180,
                top_p: 0.9,
                frequency_penalty: 0.5,
                presence_penalty: 0.4,
                stop: ["Я договорил", "Конец", "Всё.", "\n\n\n"],
                stream: false
            })
        });

        const data = await response.json();

        if (data.error) {
            return res.status(200).json({
                story: "Извини, я задумался. Повтори, пожалуйста?",
                detectedFear: null
            });
        }

        let story = data.choices?.[0]?.message?.content || "Расскажи, что у тебя нового?";
        
        story = story.replace(/^(привет|здравствуй)/gi, '');
        story = story.replace(/я договорил/gi, '');
        story = story.replace(/конец истории/gi, '');
        story = story.replace(/всё\./gi, '');
        story = story.replace(/^\d+\s*/, '');
        story = story.trim();
        
        if (!story || story.length < 3) {
            story = "Расскажи, что у тебя нового?";
        }
        
        if (!isLong && !story.includes('?') && story.length < 150) {
            story += " А что ты сейчас чувствуешь?";
        }

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
            story: "Что-то пошло не так. Расскажи ещё раз, пожалуйста!",
            detectedFear: null
        });
    }
}
