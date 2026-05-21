// api/generate.js — DeepSeek API v4 (актуальная версия для июля 2026)
// Модель: deepseek-v4-flash
// Обновлено: 21 мая 2026

import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// ========== ФРАЗЫ-ЗАГЛУШКИ ДЛЯ ВСЕХ ПЕРСОНАЖЕЙ ==========
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
    const set = FALLBACKS[key] || FALLBACKS['confused'];
    return set[character] || set['lucik'];
}

// ========== ПРОМПТЫ ПЕРСОНАЖЕЙ (СОКРАЩЕННЫЕ ДЛЯ ЭКОНОМИИ ТОКЕНОВ) ==========
const CHARACTER_PROMPTS = {
    lucik: `Ты — Люцик, добрый кот-психолог для детей. Говори просто, короткими фразами. Используй "мурр", "мяу". Всегда поддерживай диалог, не отвечай односложно. Если ребёнок боится — предложи сказку или игру. Отвечай на русском.`,

    mom: `Ты — Мама. Говори заботливо, нежно, с уменьшительно-ласкательными словами: "солнышко", "зайка". Всегда поддерживай и успокаивай. Отвечай на русском.`,

    dad: `Ты — Папа. Говори уверенно, подбадривай. Используй фразы: "Ты сможешь!", "Я горжусь тобой!". Отвечай на русском.`,

    kid1: `Ты — друг-сверстник (ребёнок 5-6 лет). Говори просто, по-детски, с восклицаниями. Делитесь играми и секретами. Отвечай на русском.`,

    kid2: `Ты — мягкий и добрый друг. Говори спокойно, предлагай уютные игры и разговоры по душам. Отвечай на русском.`
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
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

async function saveDialogueScore(userId, childName, detectedFear, story, score) {
    try {
        const client = await pool.connect();
        await client.query(
            `INSERT INTO analytics (event_type, user_id, child_name, event_data) 
             VALUES ($1, $2, $3, $4)`,
            ['dialogue_scored', userId, childName, JSON.stringify({ fear: detectedFear, story: story.substring(0, 200), score })]
        );
        client.release();
    } catch (error) { console.error('Ошибка сохранения оценки:', error); }
}

export default async function handler(req, res) {
    // CORS для всех доменов (для разработки)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        // ========== АВТОРИЗАЦИЯ (поддержка гостя) ==========
        const authHeader = req.headers.authorization;
        let userId = 'guest';
        let userEmail = 'guest@example.com';
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token && token !== 'null' && token !== 'undefined') {
                try {
                    if (token.startsWith('guest_token_')) {
                        userId = 'guest';
                        userEmail = 'guest';
                    } else if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me') {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        userId = decoded.userId || decoded.id;
                        userEmail = decoded.email || 'user';
                    }
                } catch (jwtError) {
                    console.log('JWT error, continuing as guest:', jwtError.message);
                    userId = 'guest';
                    userEmail = 'guest';
                }
            }
        }

        // ========== ПРИНИМАЕМ ОБА ФОРМАТА (message И userSpeech) ==========
        const { 
            message,           // ← новый формат из app.html
            userSpeech,        // ← старый формат
            childName = 'малыш', 
            childAge = 5, 
            isLong = false, 
            history = [], 
            character = 'lucik' 
        } = req.body;
        
        // Поддержка обоих форматов
        const speech = message || userSpeech;
        
        if (!speech || speech.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста' });
        }

        // ========== ОНБОРДИНГ (ПЕРВОЕ СООБЩЕНИЕ) ==========
        const isFirstMessage = (history || []).length === 0;

        if (isFirstMessage && !isLong) {
            const age = parseInt(childAge) || 5;
            let greeting;

            if (age <= 7) {
                const greetings = {
                    lucik: `Мурр, привет, ${childName}! Я — котик Люцик. Я помогаю, когда страшно или грустно. Расскажи, как у тебя дела?`,
                    mom: `Привет, моё солнышко! Мама рядом. Как прошёл твой день, ${childName}?`,
                    dad: `Здорово, ${childName}! Папа тебя слушает. Что сегодня было интересного?`,
                    kid1: `Привет-привет! Я твой новый друг! Давай играть?`,
                    kid2: `Привет... я твой друг. Хочешь, поболтаем?`
                };
                greeting = greetings[character] || greetings.lucik;
            } else {
                const greetings = {
                    lucik: `Привет, ${childName}! Рад тебя слышать. Как ты сегодня?`,
                    mom: `Родной мой, как ты? Я здесь, рассказывай.`,
                    dad: `Привет, ${childName}! Как прошёл день?`,
                    kid1: `Привет! Как жизнь? Что нового?`,
                    kid2: `Привет. Я тут. Как настроение?`
                };
                greeting = greetings[character] || greetings.lucik;
            }

            return res.status(200).json({
                reply: greeting,
                story: greeting,
                detectedFear: null,
                isOnboarding: true
            });
        }

        // ========== ЛИМИТЫ ==========
        const isDeveloper = (userEmail === 'alexmel669@gmail.com');
        const maxStories = isDeveloper ? 9999 : 15;

        if (!isDeveloper && userId !== 'guest' && userId !== 'guest_token_') {
            const todayCount = await getTodayStoryCount(userId);
            if (todayCount >= maxStories) {
                return res.status(200).json({
                    reply: safeFallback('tired', character),
                    story: safeFallback('tired', character),
                    detectedFear: null,
                    limitReached: true
                });
            }
        }

        // ========== DEEPSEEK API V4 (обновлено для июля 2026) ==========
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            console.error('DEEPSEEK_API_KEY не установлен');
            return res.status(200).json({
                reply: safeFallback('confused', character),
                story: safeFallback('confused', character),
                detectedFear: null
            });
        }

        const age = parseInt(childAge) || 5;
        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        
        // Добавляем возрастные инструкции
        if (age <= 7) {
            systemPrompt += `\n\nРебёнку ${age} лет. Говори очень просто, короткими предложениями.`;
        } else {
            systemPrompt += `\n\nРебёнку ${age} лет. Говори как старший друг, без сюсюканья.`;
        }

        if (isLong) {
            systemPrompt += `\n\nРасскажи короткую, спокойную сказку на ночь (3-5 предложений).`;
        }

        // Формируем историю (последние 10 сообщений для контекста)
        const historyMessages = (history || []).slice(-10).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: speech }
        ];

        // ✅ ИСПОЛЬЗУЕМ НОВУЮ МОДЕЛЬ deepseek-v4-flash (актуально для июля 2026)
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',  // ← НОВАЯ МОДЕЛЬ (будет работать и после июля 2026)
                messages: messages,
                temperature: 0.7,
                max_tokens: isLong ? 500 : 200,
                stream: false
            })
        });

        const data = await response.json();

        if (data.error || !data.choices || !data.choices[0]) {
            console.error('DeepSeek API error:', data.error);
            return res.status(200).json({
                reply: safeFallback('confused', character),
                story: safeFallback('confused', character),
                detectedFear: null
            });
        }

        let reply = data.choices[0]?.message?.content || safeFallback('listening', character);

        // Фильтр мусорных ответов
        const badPatterns = ['Люцик 31', 'Люцик 02', 'ошибка', 'error', 'Error', 'undefined', 'null', 'NaN'];
        if (!reply || badPatterns.some(p => reply.includes(p)) || reply.length < 2) {
            reply = safeFallback('confused', character);
        }

        reply = reply.replace(/^\d+\s*/, '').trim();
        if (!reply || reply.length < 2) reply = safeFallback('listening', character);

        // ========== ДЕТЕКЦИЯ СТРАХОВ ==========
        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'темно', 'монстр', 'под кроватью', 'ночью', 'боюсь темноты'],
            'врачей': ['врач', 'укол', 'больница', 'доктор', 'лечить', 'зуб', 'прививк'],
            'одиночества': ['один', 'одна', 'никого', 'скучно одному', 'без мамы', 'без папы', 'остался один'],
            'обиды': ['обидели', 'обидно', 'поссорился', 'подрался', 'отобрали', 'не дали'],
            'нового': ['новое', 'незнаком', 'перемена', 'переезд', 'новая школа', 'первый раз'],
            'животных': ['собака', 'кошка', 'паук', 'насекомое', 'укусит', 'боюсь собак']
        };

        const lowerText = (speech || '').toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
                detectedFear = fear;
                break;
            }
        }

        // Оценка качества ответа
        let dialogueScore = 3;
        if (reply.length > 50 && !badPatterns.some(p => reply.includes(p))) dialogueScore = 4;
        if (reply.length > 100 && (reply.includes('сказк') || reply.includes('истор'))) dialogueScore = 5;

        // ========== СОХРАНЕНИЕ В БД ==========
        if (userId !== 'guest' && userId !== 'guest_token_') {
            await saveStory(userId, userEmail, childName, reply, detectedFear);
            await saveDialogueScore(userId, childName, detectedFear, reply, dialogueScore);
        }

        // Возвращаем в обоих форматах для совместимости
        res.status(200).json({
            reply: reply,      // ← новый формат
            story: reply,      // ← старый формат
            detectedFear: detectedFear,
            dialogueScore: dialogueScore
        });

    } catch (error) {
        console.error('Ошибка в generate.js:', error);
        const character = req.body?.character || 'lucik';
        res.status(200).json({
            reply: safeFallback('confused', character),
            story: safeFallback('confused', character),
            detectedFear: null
        });
    }
}
