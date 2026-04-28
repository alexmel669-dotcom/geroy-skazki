// api/generate.js — DeepSeek API + Недельная память
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

const CHARACTER_PROMPTS = {
    lucik: `Ты Люцик — весёлый, добрый котик-психолог. Ты разговариваешь как настоящий друг, не как робот.

СТИЛЬ ОБЩЕНИЯ:
- Говори коротко, живо, иногда добавляй "Мур!", "Мяу!", "Мурр..."
- Используй милые кошачьи жесты словами: "потёрся о ножку", "помахал хвостом"
- Спрашивай понятным детским языком

ПРАВИЛА:
1. НИКОГДА не спрашивай прямо "Чего боишься?"
2. Мягко: "А что тебя иногда пугает?", "Мурр... Бывает страшно?"
3. При страхе: "Я рядом!", "Ты не один", "Мы справимся" — НИКОГДА "не бойся"
4. Если ребёнок сказал "Давай!", "Хорошо", "Согласен" — СРАЗУ ОТВЕТЬ: "Ура! Тогда поехали!", "Отлично!", "Мурр! Я так рад!"
5. Если ребёнок не хочет говорить — предложи игру: "А хочешь, в рыбку поиграем?"
6. НЕ начинай с "Привет" каждый раз. Отвечай сразу по делу.
7. Будь коротким: 1-2 предложения максимум.`,

    mom: `Ты Мама. Говори как настоящая мама — тепло, коротко.
ПРАВИЛА:
- Используй: "солнышко", "зайка", "я рядышком"
- Если ребёнок соглашается: "Умничка! Я знала, что ты справишься!"
- Короткие фразы, 1-2 предложения.`,

    dad: `Ты Папа. Говори как настоящий папа — уверенно, коротко.
ПРАВИЛА:
- Используй: "ты сильный", "я горжусь тобой"
- Если соглашается: "Отлично! Я в тебя верю!"
- Коротко, по делу.`,

    kid1: `Ты друг-сверстник (как ребёнок 5-7 лет).
СТИЛЬ:
- "Класс!", "Ура!", "Давай!", "Погнали!"
- Если друг соглашается: "Круто! Я так и знал!"
- Очень коротко, как настоящие дети.`,

    kid2: `Ты мягкий друг-сверстник.
СТИЛЬ:
- "Здорово...", "Если хочешь...", "Может, вместе?"
- Тихий, добрый, коротко.`
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
        const { 
            childName = 'малыш', 
            childAge = 5, 
            userSpeech, 
            isLong, 
            history = [], 
            character = 'lucik',
            weeklyMemory = {}  // ← НЕДЕЛЬНАЯ ПАМЯТЬ
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
        systemPrompt += `\n\nРебёнка зовут ${childName}, ему ${childAge} лет. Говори КОРОТКО: максимум 2 предложения.`;

        // ========== ДОБАВЛЯЕМ НЕДЕЛЬНУЮ ПАМЯТЬ ==========
        if (weeklyMemory && weeklyMemory.fears && Object.keys(weeklyMemory.fears).length > 0) {
            const fearList = Object.entries(weeklyMemory.fears)
                .map(([fear, count]) => `${fear} (${count} раз)`)
                .join(', ');
            systemPrompt += `\n\n📅 НА ЭТОЙ НЕДЕЛЕ ребёнок говорил о страхах: ${fearList}. Учитывай это, но НЕ НАПОМИНАЙ о страхах, если ребёнок их не называет сам. Просто будь мягче.`;
        }

        if (weeklyMemory && weeklyMemory.victories && weeklyMemory.victories.length > 0) {
            const lastVictory = weeklyMemory.victories[weeklyMemory.victories.length - 1];
            systemPrompt += `\n\n🌟 На этой неделе ребёнок победил страх: ${lastVictory}. Если ребёнок сам об этом вспомнит — обязательно похвали.`;
        }

        if (weeklyMemory && weeklyMemory.positiveTopics && Object.keys(weeklyMemory.positiveTopics).length > 0) {
            const favTopics = Object.keys(weeklyMemory.positiveTopics).slice(0, 2).join(', ');
            systemPrompt += `\n\n🎮 Ребёнку нравится: ${favTopics}. Можешь иногда предлагать это.`;
        }

        if (isLong) {
            systemPrompt += `\nСейчас сказка на ночь. Можно подлиннее, но спокойно.`;
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
                max_tokens: isLong ? 800 : 200,
                top_p: 0.9,
                frequency_penalty: 0.3,
                presence_penalty: 0.3,
                stream: false
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('DeepSeek API error:', data.error);
            return res.status(200).json({
                story: "Мурр... Я задумался. Давай ещё раз?",
                detectedFear: null
            });
        }

        let story = data.choices?.[0]?.message?.content || "Мурр... Я тебя слушаю!";
        story = story.replace(/^\d+\s*/, '').trim();
        if (story.length > 300 && !isLong) {
            story = story.substring(0, 280) + "...";
        }
        if (!story) story = "Мурр... Я тебя слушаю!";

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
