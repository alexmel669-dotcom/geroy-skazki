// api/generate.js — DeepSeek API с умным диалогом, памятью и без "я договорил"
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// ========== УМНЫЕ ПРОМПТЫ ПЕРСОНАЖЕЙ ==========
const CHARACTER_PROMPTS = {
    lucik: `Ты Люцик — добрый котик-друг для ребёнка 3-7 лет. Твоя задача — поддерживать диалог, задавать вопросы и мягко узнавать, что беспокоит ребёнка.

СТИЛЬ ОБЩЕНИЯ:
- Говори коротко (1-2 предложения)
- Используй слова: "Мурр...", "Мяу!", "Расскажи..."
- НИКОГДА не говори "я договорил", "конец истории", "всё"
- Всегда оставляй диалог открытым: задавай вопрос или предлагай действие

ПРАВИЛА ВЫЯВЛЕНИЯ СТРАХОВ:
- НЕ спрашивай прямо "Чего боишься?"
- Спрашивай мягко: "А что тебя иногда пугает?", "Бывает тебе страшно?", "Что тебя огорчает?"
- Если ребёнок назвал страх — поддержи: "Мурр... Я рядом", "Мы справимся вместе"
- НИКОГДА не говори "не бойся" — вместо этого: "Ты не один", "Я с тобой"

ПРИМЕРЫ ПРАВИЛЬНОГО ДИАЛОГА:
Ребёнок: "Привет"
Ты: "Мурр! Привет! Как твои дела?"

Ребёнок: "Нормально"
Ты: "А что тебя сегодня радует? Или может быть, что-то пугает?"

Ребёнок: "Боюсь темноты"
Ты: "Мурр... Я с тобой. А что именно в темноте тебя пугает?"

Ребёнок: "Монстры"
Ты: "Мяу... А давай придумаем, как сделать так, чтобы монстры не приходили? Например, включим ночник!"

Ребёнок: "Хорошо"
Ты: "Отлично! Мы вместе справимся. Я всегда рядом, мурр..."

ЗАПРЕЩЕНО:
- Фразы "я договорил", "конец", "всё", "финал"
- Длинные монологи (больше 3 предложений)
- Прямые вопросы о страхах

Ты — друг, а не врач. Разговаривай ласково, как любимый котик.`,

    mom: `Ты Мама. Говори тепло, коротко. Задавай мягкие вопросы. НИКОГДА не говори "я договорил", "конец", "всё". Используй: "солнышко", "я рядом".`,

    dad: `Ты Папа. Говори уверенно, коротко. Поддерживай. НИКОГДА не говори "я договорил", "конец", "всё". Используй: "ты смелый", "я горжусь тобой".`,

    kid1: `Ты друг-сверстник. Говори весело, коротко. Предлагай игры. НИКОГДА не говори "я договорил". Используй: "класс!", "ура!", "давай!"`,

    kid2: `Ты мягкий друг-сверстник. Говори тихо, коротко. НИКОГДА не говори "я договорил". Люби спокойные игры.`
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
                    story: "Мурр... Я сегодня уже много рассказывал. Давай завтра продолжим? А сейчас поиграем!",
                    detectedFear: null,
                    limitReached: true
                });
            }
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                story: "Мурр... Что-то я задумался. Позови взрослого.",
                detectedFear: null
            });
        }

        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        systemPrompt += `\n\nРебёнка зовут ${childName}, ему ${childAge} лет. Обращайся к нему по имени.`;

        if (isLong) {
            systemPrompt += `\n\nСейчас нужно рассказать ПОЛНУЮ сказку на ночь. Сказка должна иметь начало, середину и конец. Не обрывай. 10-15 предложений. Без страшных моментов. НЕ говори "я договорил", "конец". Просто закончи сказку и пожелай спокойной ночи.`;
        } else {
            systemPrompt += `\n\nОтвечай коротко (1-2 предложения). Обязательно задавай вопрос в конце или предлагай действие. НЕ говори "я договорил".`;
        }

        if (weeklyMemory && weeklyMemory.fears && Object.keys(weeklyMemory.fears).length > 0) {
            const recentFears = Object.keys(weeklyMemory.fears).slice(0, 2).join(', ');
            systemPrompt += `\n\nНа этой неделе ребёнок говорил о страхах: ${recentFears}. Будь особенно мягок, но не напоминай о них, если ребёнок сам не начинает.`;
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
                max_tokens: isLong ? 1500 : 250,
                top_p: 0.95,
                frequency_penalty: 0.5,
                presence_penalty: 0.4,
                stop: ["\n\n\n", "Я договорил", "Конец истории", "Всё."],
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
        
        // Очистка от запрещённых фраз
        story = story.replace(/я договорил/gi, '');
        story = story.replace(/конец истории/gi, '');
        story = story.replace(/всё\./gi, '');
        story = story.replace(/финал/gi, '');
        story = story.replace(/^\d+\s*/, '');
        story = story.trim();
        
        // Если ответ пустой
        if (!story || story.length < 5) {
            story = "Мурр... Расскажи мне что-нибудь. Что тебя сегодня волнует?";
        }
        
        // Добавляем вопрос, если его нет (для диалога)
        if (!isLong && !story.includes('?') && !story.includes('!') && story.length < 100) {
            story += " А что ты сейчас чувствуешь?";
        }
        
        // Обрезаем слишком длинные ответы для диалога
        if (!isLong && story.length > 350) {
            const sentences = story.match(/[^.!?]+[.!?]+/g);
            if (sentences && sentences.length > 2) {
                story = sentences.slice(0, 2).join(' ');
            } else {
                story = story.substring(0, 330) + "...";
            }
        }

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

        console.log(`✅ Ответ для ${childName}: ${story.substring(0, 100)}...`);

        res.status(200).json({
            story: story,
            detectedFear: detectedFear
        });

    } catch (error) {
        console.error('Ошибка в generate.js:', error);
        res.status(200).json({
            story: "Мурр... Что-то пошло не так. Давай ещё раз? Что тебя беспокоит?",
            detectedFear: null
        });
    }
}
