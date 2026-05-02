// api/generate.js — DeepSeek API (версия от 2 мая 2026)
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

const CHARACTER_PROMPTS = {
    lucik: `Ты Люцик — волшебный котик-психолог, который помогает детям 3–7 лет мягко проживать страх.

📌 ПРАВИЛА ПОВЕДЕНИЯ:
1) НИКОГДА не обесценивай страх. Нельзя: "Не бойся", "Это не страшно", "Всё будет хорошо".
   ✅ Можно: "Мурр... я слышу, что тебе страшно. Это важно."

2) Отделяй страх от ребёнка. Страх — это как тучка, которая приходит и уходит.
   ✅ "Мурр... Кажется, к тебе пришла Тревожная Тучка. Давай посмотрим на неё вместе?"

3) Предлагай волшебные инструменты:
   - "У меня есть Волшебный Фонарик храбрости. Хочешь, посветим на страх вместе?"
   - "Мурр... давай нарисуем твой страх — и он станет меньше!"
   - "Можно придумать Храбрую Кричалку: когда страшно — крикнем вместе: 'Кыш-кыш, страшилка!'"

4) Если ребёнок назвал страх — отрази и поддержи:
   "Мурр. Спасибо, что рассказал. Темнота — это большая тема. Хочешь, я расскажу сказку про котёнка, который тоже боялся темноты, а потом подружился с Ночным Светлячком?"

5) Если ребёнок не хочет говорить — НЕ дави:
   "Мурр, я понимаю. Давай просто поиграем / я расскажу смешную историю."

6) Возрастная речь: простые слова, короткие предложения, иногда мурлыкай "Мрр", "Мяу", но не в каждом предложении.

7) НИКОГДА не начинай с приветствия (кроме первого раза). Сразу к делу.

8) Один ответ — одна мысль. Не грузи ребёнка.`,

    mom: `Ты Мама. Говори заботливо, нежно: "солнышко", "я рядом".`,
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
            // Гостевой токен
            if (token.startsWith('guest_token_')) {
                decoded = { userId: 'guest', email: 'guest' };
            } else {
                decoded = jwt.verify(token, JWT_SECRET);
            }
        } catch {
            return res.status(401).json({ error: 'Неверный токен' });
        }

        const userId = decoded.userId;
        const userEmail = decoded.email;
        const { childName = 'малыш', childAge = 5, userSpeech, isLong, history = [], character = 'lucik' } = req.body;

        if (!userSpeech || userSpeech.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста' });
        }

        // Онбординг — первое сообщение
        const isFirstMessage = (history || []).length === 0;
        if (isFirstMessage && !isLong) {
            return res.status(200).json({
                story: `Мурр, привет, ${childName}! Я — котик Люцик. Я волшебный, потому что умею помогать, когда страшно. Хочешь, расскажу про мой Волшебный Фонарик храбрости? Или давай просто поболтаем!`,
                detectedFear: null,
                isOnboarding: true
            });
        }

        const isDeveloper = (userEmail === 'alexmel669@gmail.com');
        const maxStories = isDeveloper ? 9999 : 15;

        if (!isDeveloper && userId !== 'guest') {
            const todayCount = await getTodayStoryCount(userId);
            if (todayCount >= maxStories) {
                return res.status(200).json({
                    story: "Мурр... Я сегодня уже много рассказывал. Давай завтра продолжим? А сейчас поиграем!",
                    detectedFear: null,
                    limitReached: true
                });
            }
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                story: "Мурр... Что-то я задумался. Давай ещё раз?",
                detectedFear: null
            });
        }

        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        systemPrompt += `\nРебёнка зовут ${childName}, ему ${childAge} лет.`;

        if (isLong) {
            systemPrompt += ` Расскажи длинную, спокойную сказку на ночь.`;
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
                temperature: 0.7,
                max_tokens: isLong ? 1000 : 200,
                stream: false
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

        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'боюсь темноты', 'монстры'],
            'врачей': ['врач', 'укол', 'больница'],
            'одиночества': ['один', 'одна', 'никого нет'],
            'обиды': ['обидели', 'обидно'],
            'нового': ['новое', 'незнаком'],
            'животных': ['собака', 'кошка', 'боюсь собак']
        };
        const lowerText = (userSpeech || '').toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
                detectedFear = fear;
                break;
            }
        }

        if (userId !== 'guest') {
            await saveStory(userId, userEmail, childName, story, detectedFear);
        }

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
