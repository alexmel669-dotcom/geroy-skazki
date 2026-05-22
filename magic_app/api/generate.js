// api/generate.js — DeepSeek API v4 (исправлен: память, сказка, приветствие)
// Обновлено: 22 мая 2026

import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

const FALLBACKS = {
    tired: {
        lucik: "Мурр... Я немного устал. Давай поиграем?",
        mom:   "Я немного устала, давай поиграем, родной?",
        dad:   "Устал немного. Давай поиграем?",
        kid1:  "Фух, устал! Давай поиграем?",
        kid2:  "Я устала... Давай поиграем?"
    },
    confused: {
        lucik: "Мурр... Я немного задумался. Давай ещё раз?",
        mom:   "Ой, я задумалась... Давай ещё раз, солнышко?",
        dad:   "Хм, задумался. Давай ещё раз?",
        kid1:  "Ой, я задумался! Давай ещё разок?",
        kid2:  "Я задумалась... Давай ещё раз?"
    },
    listening: {
        lucik: "Мурр... Я тебя слушаю!",
        mom:   "Я тебя слушаю, мой хороший!",
        dad:   "Я слушаю, продолжай!",
        kid1:  "Я слушаю! Рассказывай!",
        kid2:  "Я тебя слушаю..."
    }
};

function safeFallback(key, character) {
    const set = FALLBACKS[key] || FALLBACKS.confused;
    return set[character] || set.lucik;
}

const CHARACTER_PROMPTS = {
    lucik: `Ты — Люцик, добрый кот-психолог для детей 3-12 лет. 
            Говори просто, короткими фразами. Используй "мурр", "мяу". 
            Всегда поддерживай диалог, не отвечай односложно. 
            Если ребёнок боится — предложи сказку или игру. 
            НИКОГДА не начинай ответ со слова "Привет", если это не первое сообщение.
            Отвечай на русском.`,

    mom: `Ты — Мама. Говори заботливо, нежно. НИКОГДА не начинай ответ со слова "Привет" в середине диалога. Отвечай на русском.`,

    dad: `Ты — Папа. Говори уверенно, подбадривай. НИКОГДА не начинай ответ со слова "Привет" в середине диалога. Отвечай на русском.`,

    kid1: `Ты — друг-сверстник (девочка). Говори по-детски, весело. НИКОГДА не начинай ответ со слова "Привет" в середине диалога. Отвечай на русском.`,

    kid2: `Ты — друг-сверстник (мальчик). Говори по-детски, дружелюбно. НИКОГДА не начинай ответ со слова "Привет" в середине диалога. Отвечай на русском.`
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        const authHeader = req.headers.authorization;
        let userId = 'guest';
        let userEmail = 'guest@example.com';
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token && token !== 'null' && token !== 'undefined') {
                try {
                    if (token.startsWith('guest_token_')) {
                        userId = 'guest';
                    } else if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me') {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        userId = decoded.userId || decoded.id;
                        userEmail = decoded.email || 'user';
                    }
                } catch (jwtError) {
                    console.log('JWT error, continuing as guest');
                }
            }
        }

        const { 
            message, 
            userSpeech,
            childName = 'малыш', 
            childAge = 5, 
            isLong = false, 
            history = [], 
            character = 'lucik' 
        } = req.body;
        
        const speech = message || userSpeech;
        
        if (!speech || speech.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста' });
        }

        // Определяем, первое ли это сообщение в диалоге
        const isFirstMessage = (history || []).length === 0;

        if (isFirstMessage && !isLong) {
            const age = parseInt(childAge) || 5;
            let greeting;
            if (age <= 7) {
                const greetings = {
                    lucik: `Мурр, привет, ${childName}! Я — котик Люцик. Расскажи, как у тебя дела?`,
                    mom: `Привет, моё солнышко! Мама рядом. Как прошёл твой день, ${childName}?`,
                    dad: `Здорово, ${childName}! Папа тебя слушает. Что сегодня было интересного?`,
                    kid1: `Привет! Я твоя подружка. Давай играть?`,
                    kid2: `Привет! Я твой друг. Расскажи, что нового?`
                };
                greeting = greetings[character] || greetings.lucik;
            } else {
                const greetings = {
                    lucik: `Привет, ${childName}! Рад тебя слышать. Как ты сегодня?`,
                    mom: `Родной мой, как ты? Я здесь, рассказывай.`,
                    dad: `Привет, ${childName}! Как прошёл день?`,
                    kid1: `Привет! Как жизнь? Что нового?`,
                    kid2: `Привет! Как настроение?`
                };
                greeting = greetings[character] || greetings.lucik;
            }
            return res.status(200).json({ reply: greeting, story: greeting, detectedFear: null, isOnboarding: true });
        }

        // Лимиты
        const isDeveloper = (userEmail === 'alexmel669@gmail.com');
        const maxStories = isDeveloper ? 9999 : 15;
        if (!isDeveloper && userId !== 'guest') {
            const todayCount = await getTodayStoryCount(userId);
            if (todayCount >= maxStories) {
                return res.status(200).json({ reply: safeFallback('tired', character), story: safeFallback('tired', character), limitReached: true });
            }
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return res.status(200).json({ reply: safeFallback('confused', character), story: safeFallback('confused', character) });
        }

        const age = parseInt(childAge) || 5;
        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        
        if (age <= 7) {
            systemPrompt += `\n\nРебёнку ${age} лет. Говори очень просто, короткими предложениями. Используй сказки и игры.`;
        } else {
            systemPrompt += `\n\nРебёнку ${age} лет. Говори как старший друг, можешь обсуждать школу, друзей, увлечения.`;
        }

        if (isLong) {
            systemPrompt += `\n\nРасскажи законченную сказку на ночь (5-7 предложений). Обязательно заверши её выводом: "Спокойной ночи, ..."`;
        }

        // Передаём историю (последние 15 сообщений для контекста)
        const historyMessages = (history || []).slice(-15).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: speech }
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
                temperature: 0.7,
                max_tokens: isLong ? 700 : 250,
                stream: false
            })
        });

        const data = await response.json();

        if (data.error || !data.choices || !data.choices[0]) {
            console.error('DeepSeek API error:', data.error);
            return res.status(200).json({ reply: safeFallback('confused', character), story: safeFallback('confused', character) });
        }

        let reply = data.choices[0]?.message?.content || safeFallback('listening', character);

        // Фильтруем ответы, начинающиеся с "Привет" (кроме первого сообщения)
        if (!isFirstMessage && reply.trim().toLowerCase().startsWith('привет')) {
            reply = reply.replace(/^привет[,\s]*/i, '').trim();
            if (!reply) reply = safeFallback('listening', character);
        }

        const badPatterns = ['Люцик 31', 'Люцик 02', 'ошибка', 'error', 'undefined', 'null', 'NaN'];
        if (!reply || badPatterns.some(p => reply.includes(p)) || reply.length < 2) {
            reply = safeFallback('confused', character);
        }

        reply = reply.replace(/^\d+\s*/, '').trim();

        // Детекция страхов
        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'темно', 'монстр', 'под кроватью', 'ночью'],
            'врачей': ['врач', 'укол', 'больница', 'доктор'],
            'одиночества': ['один', 'одна', 'никого', 'без мамы', 'без папы'],
            'обиды': ['обидели', 'обидно', 'поссорился'],
            'нового': ['новое', 'незнаком', 'перемена', 'новая школа'],
            'животных': ['собака', 'кошка', 'паук', 'укусит']
        };
        const lowerText = (speech || '').toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
                detectedFear = fear;
                break;
            }
        }

        if (userId !== 'guest') {
            await saveStory(userId, userEmail, childName, reply, detectedFear);
        }

        res.status(200).json({ reply: reply, story: reply, detectedFear: detectedFear });

    } catch (error) {
        console.error('Ошибка в generate.js:', error);
        const character = req.body?.character || 'lucik';
        res.status(200).json({ reply: safeFallback('confused', character), story: safeFallback('confused', character) });
    }
}
