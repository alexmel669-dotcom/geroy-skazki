// api/generate.js — DeepSeek V4 Flash (ускорено, память, сказки без обрывов)
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});
const JWT_SECRET = process.env.JWT_SECRET;

const FALLBACKS = {
    tired: { lucik: "Мурр... Я немного устал. Давай поиграем?", mom: "Я немного устала, давай поиграем, родной?", dad: "Устал немного. Давай поиграем?", kid1: "Фух, устал! Давай поиграем?", kid2: "Я устала... Давай поиграем?" },
    confused: { lucik: "Мурр... Я немного задумался. Давай ещё раз?", mom: "Ой, я задумалась... Давай ещё раз, солнышко?", dad: "Хм, задумался. Повтори?", kid1: "Ой, я задумался! Давай ещё разок?", kid2: "Я задумалась... Давай ещё раз?" },
    listening: { lucik: "Мурр... Я тебя слушаю!", mom: "Я тебя слушаю, мой хороший!", dad: "Я слушаю, продолжай!", kid1: "Я слушаю! Рассказывай!", kid2: "Я тебя слушаю..." }
};
function safeFallback(key, char) { return (FALLBACKS[key]?.[char] || FALLBACKS[key]?.lucik || FALLBACKS.confused.lucik); }

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
        await client.query(`INSERT INTO analytics (event_type, user_id, user_email, child_name, event_data) VALUES ($1,$2,$3,$4,$5)`,
            ['story_generated', userId, userEmail, childName, JSON.stringify({ story: story.substring(0,200), fear })]);
        client.release();
    } catch(e) { console.error('saveStory error', e); }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        const authHeader = req.headers.authorization;
        let userId = 'guest', userEmail = 'guest@example.com';
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token && token !== 'null' && !token.startsWith('guest_token_') && JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me') {
                try { const decoded = jwt.verify(token, JWT_SECRET); userId = decoded.userId || decoded.id; userEmail = decoded.email || 'user'; } catch(e) {}
            }
        }

        const { message, userSpeech, childName='малыш', childAge=5, isLong=false, history=[], character='lucik' } = req.body;
        const speech = message || userSpeech;
        if (!speech || !speech.trim()) return res.status(400).json({ error: 'Нет текста' });

        const isFirstMessage = (history || []).length === 0;
        if (isFirstMessage && !isLong) {
            const age = parseInt(childAge) || 5;
            const greetings = {
                lucik: `Мурр, привет, ${childName}! Я котик Люцик. Расскажи, как дела?`,
                mom: `Привет, солнышко! Мама рядом. Как день прошёл?`,
                dad: `Привет, ${childName}! Папа слушает. Что интересного?`,
                kid1: `Привет! Я твоя подружка. Давай играть?`,
                kid2: `Привет! Я твой друг. Расскажи что нового?`
            };
            return res.status(200).json({ reply: greetings[character]||greetings.lucik, story: greetings[character]||greetings.lucik, detectedFear: null });
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) return res.status(200).json({ reply: safeFallback('confused', character), story: safeFallback('confused', character) });

        const age = parseInt(childAge) || 5;
        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        systemPrompt += `\nРебёнку ${age} лет. Говори ${age<=7 ? 'просто, коротко' : 'как старший друг'}.`;
        if (isLong) systemPrompt += `\nРасскажи законченную сказку на ночь (5-7 предложений). Обязательно заверши фразой "Спокойной ночи" или "Сказка закончена".`;

        const historyMessages = (history || []).slice(-12).map(msg => ({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content }));
        const messages = [{ role: 'system', content: systemPrompt }, ...historyMessages, { role: 'user', content: speech }];

        const startTime = Date.now();
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'deepseek-v4-flash', messages, temperature: 0.7, max_tokens: isLong ? 550 : 180, stream: false })
        });
        const data = await response.json();
        console.log(`DeepSeek ответ за ${Date.now()-startTime}ms`);

        let reply = data.choices?.[0]?.message?.content || safeFallback('listening', character);
        if (!isFirstMessage && reply.trim().toLowerCase().startsWith('привет')) reply = reply.replace(/^привет[,\s]*/i, '').trim();
        if (!reply || reply.length<2) reply = safeFallback('confused', character);
        reply = reply.replace(/^\d+\s*/, '').trim();

        let detectedFear = null;
        const fearKeywords = { 'темноты':['темнот','монстр','ночью'], 'врачей':['врач','укол','больница'], 'одиночества':['один','одна','без мамы'], 'обиды':['обидели','обидно'], 'нового':['новое','перемена'], 'животных':['собака','кошка','паук'] };
        const lowerText = speech.toLowerCase();
        for (const [fear, kw] of Object.entries(fearKeywords)) if (kw.some(k=>lowerText.includes(k))) { detectedFear=fear; break; }

        if (userId !== 'guest') await saveStory(userId, userEmail, childName, reply, detectedFear);
        res.status(200).json({ reply, story: reply, detectedFear });
    } catch (error) {
        console.error('generate error', error);
        const character = req.body?.character || 'lucik';
        res.status(200).json({ reply: safeFallback('confused', character), story: safeFallback('confused', character) });
    }
}
