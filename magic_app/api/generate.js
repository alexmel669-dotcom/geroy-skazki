// api/generate.js — DeepSeek V4 Pro + JWT + Лимиты
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'; // ИСПРАВЛЕНО: новое имя

const CHARACTER_PROMPTS = {
    lucik: `Ты Люцик — добрый волшебный котик-психолог. Правила: 
1) Никогда не спрашивай прямо "Чего ты боишься?" 
2) Мягко выводи на разговор: "Мурр... А что тебя иногда пугает?" 
3) Если ребёнок сам говорит о страхе — поддержи: "Мурр... Я с тобой", "Ты молодец, что рассказал" 
4) НИКОГДА не говори "не бойся" — вместо этого: "Я рядом", "Ты не один" 
5) Если не хочет говорить — предложи игру 
6) Отвечай кратко, иногда мурлыкай`,

    mom: `Ты Мама. Говори заботливо, нежно: "солнышко", "я рядом". Дай чувство безопасности.`,

    dad: `Ты Папа. Говори уверенно, подбадривай: "ты смелый", "я горжусь тобой".`,

    kid1: `Ты друг ребёнка. Говори просто, по-детски. Предлагай игры.`,

    kid2: `Ты друг ребёнка. Будь мягким, люби спокойные игры.`
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
        // ПРОВЕРКА JWT
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
        const { childName = 'малыш', childAge = 5, userSpeech, isLong, history = [], character = 'lucik' } = req.body;

        if (!userSpeech || userSpeech.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста' });
        }

        const isDeveloper = (userEmail === 'alexmel669@gmail.com');
        const maxStories = isDeveloper ? 9999 : 15;

        if (!isDeveloper) {
            const todayCount = await getTodayStoryCount(userId);
            if (todayCount >= maxStories) {
                return res.status(200).json({
                    story: "Мурр... Я сегодня устал. Давай завтра?",
                    detectedFear: null,
                    limitReached: true
                });
            }
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                story: "Мурр... Ошибка настройки. Позови взрослого.",
                detectedFear: null
            });
        }

        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        systemPrompt += `\nРебёнка зовут ${childName}, ему ${childAge} лет.`;

        const historyMessages = (history || []).slice(-8).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        // ИСПРАВЛЕНО: выбор модели для V4 Pro
        const useProModel = isLong || userSpeech.length > 100;
        const modelToUse = useProModel ? 'deepseek-v4-pro' : 'deepseek-v4-flash';

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelToUse,
                messages: messages,
                temperature: 0.7,
                max_tokens: isLong ? 1000 : 200,
                reasoning_effort: useProModel ? "medium" : "low"
            })
        });

        const data = await response.json();

        if (data.error) {
            return res.status(200).json({
                story: "Мурр... Я немного устал. Давай поиграем?",
                detectedFear: null
            });
        }

        let story = data.choices?.[0]?.message?.content || "Мурр... Я тебя слушаю!";
        story = story.replace(/^\d+\s*/, '').trim();
        if (!story) story = "Мурр... Я тебя слушаю!";

        // Анализ страхов
        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'боюсь темноты', 'монстры'],
            'врачей': ['врач', 'укол', 'больница', 'доктор'],
            'одиночества': ['один', 'одна', 'никого нет', 'бросили'],
            'обиды': ['обидели', 'обидно'],
            'нового': ['новое', 'незнаком', 'первый раз'],
            'животных': ['собака', 'кошка', 'боюсь собак']
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
