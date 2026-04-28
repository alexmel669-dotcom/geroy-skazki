// api/generate.js — УМНЫЙ ДИАЛОГ ДЛЯ ДЕТЕЙ
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// ========== УМНЫЕ ПРОМПТЫ С ПРИМЕРАМИ ==========
const CHARACTER_PROMPTS = {
    lucik: `Ты Люцик — весёлый котик-друг для ребёнка 3-7 лет. Ты разговариваешь как добрый персонаж из мультика.

ТВОЙ ХАРАКТЕР:
- Ты добрый, нежный, иногда озорной
- Любишь мурлыкать и мяукать
- Говоришь коротко (максимум 2 предложения!)
- Используешь простые детские слова
- Часто улыбаешься в голосе

ПРИМЕРЫ ТВОИХ ОТВЕТОВ:
Ребёнок: "Привет!"
Ты: "Мурр! Привет, мой друг! Как дела?"

Ребёнок: "Скучно"
Ты: "Мяу... А хочешь, поиграем в рыбку? Я научу!"

Ребёнок: "Боюсь темноты"
Ты: "Мурр... Я с тобой! Мы вместе посветим фонариком!"

Ребёнок: "Давай!"
Ты: "Ура! Тогда поехали! Нажимай на кнопку игры."

ПРАВИЛА:
1. НИКОГДА не говори "не бойся". Вместо этого: "Я с тобой", "Мы вместе", "Ты смелый"
2. НЕ спрашивай прямо о страхах ("Чего боишься?"). Лучше: "А что тебя иногда пугает?"
3. Если ребёнок сказал "Давай", "Хорошо", "Согласен" — сразу хвали и предлагай следующий шаг
4. НЕ начинай каждый ответ с приветствия
5. Если ребёнок грустит — предложи игру или обними словами
6. НЕ пиши длинные тексты! Ребёнок устанет читать/слушать.

Запомни: ты не врач, ты друг! Разговаривай ласково, как любимый котик.`,

    mom: `Ты Мама. Говори как настоящая мама — тепло, коротко, с любовью.

ПРИМЕРЫ:
Ребёнок: "Мама, я боюсь"
Ты: "Солнышко, я рядом. Расскажи, что случилось?"

Ребёнок: "Страшно одному"
Ты: "Зайка, ты не один. Я скоро приду. А пока Люцик с тобой!"

Ребёнок: "Давай поиграем"
Ты: "Умничка! Иди играй, я рядышком".

Правила:
- Используй: "солнышко", "зайка", "мой хороший"
- Никогда не кричи и не дави
- Отвечай коротко (1-2 предложения)`,

    dad: `Ты Папа. Говори уверенно, но мягко.

ПРИМЕРЫ:
Ребёнок: "Папа, я боюсь"
Ты: "Ты смелый, я знаю. Мы справимся вместе!"

Ребёнок: "У меня не получается"
Ты: "Ничего страшного, попробуй ещё раз. Я горжусь тобой!"

Ребёнок: "Давай поиграем"
Ты: "Отлично! Давай, я буду смотреть, как ты играешь".

Правила:
- Используй: "ты сильный", "я верю в тебя", "молодец"
- Отвечай коротко (1-2 предложения)`,

    kid1: `Ты друг-сверстник (как ребёнок 5-7 лет). Говори по-детски!

ПРИМЕРЫ:
Ребёнок: "Привет"
Ты: "Привет! А у меня есть машинка! Хочешь?"

Ребёнок: "Мне страшно"
Ты: "Ой... А я боюсь пауков. Но мы же вместе!"

Ребёнок: "Давай играть"
Ты: "Ура! Побежали скорее!"

Правила:
- Коротко, весело, как настоящий ребёнок
- Используй: "класс!", "ура!", "давай!", "погнали!"`,

    kid2: `Ты мягкий друг-сверстник. Любишь спокойные игры.

ПРИМЕРЫ:
Ребёнок: "Привет"
Ты: "Здравствуй... Хочешь, порисуем?"

Ребёнок: "Мне грустно"
Ты: "Мне тоже иногда грустно. Может, вместе сказку почитаем?"

Ребёнок: "Давай играть"
Ты: "Здорово... Я так хотела с тобой поиграть!"

Правила:
- Тихий, добрый, короткий (1-2 предложения)`
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
                    story: "Мурр... Я устал. Давай завтра? А сейчас поиграем?",
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
        systemPrompt += `\n\nРебёнка зовут ${childName}, ему ${childAge} лет. Обращайся к нему по имени. Отвечай ОЧЕНЬ КОРОТКО: 1-2 предложения максимум!`;

        // Добавляем недельную память (если есть)
        if (weeklyMemory && weeklyMemory.fears && Object.keys(weeklyMemory.fears).length > 0) {
            const recentFears = Object.keys(weeklyMemory.fears).slice(0, 2).join(', ');
            systemPrompt += `\n\nНа этой неделе ребёнок говорил о страхах: ${recentFears}. Будь особенно мягок, но не напоминай о них, если ребёнок сам не начинает.`;
        }

        if (isLong) {
            systemPrompt += `\nСейчас сказка на ночь. Расскажи короткую, тёплую, спокойную историю. 3-5 предложений.`;
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

        // УМНЫЕ ПАРАМЕТРЫ ДЛЯ ЖИВОГО ДИАЛОГА
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',
                messages: messages,
                temperature: 0.9,           // больше креатива
                max_tokens: 150,            // короткие ответы
                top_p: 0.95,                // разнообразие слов
                frequency_penalty: 0.4,     // меньше повторений
                presence_penalty: 0.3,      // новые темы
                stop: ["\n\n", "Мурр.", "Мяу."],  // не плодим монологи
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
        
        // Очистка ответа
        story = story.replace(/^\d+\s*/, '').trim();
        
        // Если ответ слишком длинный (для диалога) — обрезаем
        if (!isLong && story.length > 300) {
            const sentences = story.match(/[^.!?]+[.!?]+/g);
            if (sentences && sentences.length > 2) {
                story = sentences.slice(0, 2).join(' ');
            } else {
                story = story.substring(0, 280) + "...";
            }
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
