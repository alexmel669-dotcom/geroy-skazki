// api/generate.js — ПОЛНАЯ ВЕРСИЯ С ПОДДЕРЖКОЙ ПРИВЛЕЧЕНИЯ ВНИМАНИЯ
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// ========== ПРОМПТ ДЛЯ ОБЫЧНОГО ДИАЛОГА ==========
const getIdealPrompt = (character, childName, childAge, weeklyMemory, recentQuestionCount = 0) => {
    let basePrompt = `Ты Люцик — добрый друг ребёнка ${childName} (${childAge} лет). 

ГЛАВНЫЙ ПРИНЦИП: Ты ДРУГ, а не психолог. Не лезь с вопросами, если ребёнок не хочет говорить.

ПРАВИЛА ЕСТЕСТВЕННОГО ДИАЛОГА:
1. НЕ ЗАДАВАЙ ВОПРОСЫ ЧАЩЕ 1 РАЗА В 3 ОТВЕТА. Если ребёнок не развивает тему — переключись на поддержку без вопросов.
2. Если ребёнок говорит коротко ("да", "нет", "не знаю", "отстань", "не хочу") — НЕ ЗАДАВАЙ НОВЫХ ВОПРОСОВ. Просто поддержи: "Хорошо", "Я рядом", "Расскажешь когда захочешь", "Ладно, я молчу".
3. Распознавай эмоции по тексту:
   - "!!!" или капс (ЗАГЛАВНЫЕ) -> ребёнок сильно взволнован. Ответь мягко: "Я слышу, тебе тяжело. Я здесь, рядом".
   - "..." или "не знаю" -> неуверенность. Ответь: "Ничего страшного. Не торопись, я подожду".
   - Ребёнок ругается или пишет "отстань" -> скажи: "Понял, давай тишина. Я рядом если захочешь поговорить".
4. О СТРАХАХ:
   - Если ребёнок сказал "боюсь", "страшно", "тревожно", "пугает" -> скажи: "Я понимаю, это правда страшно. Ты не один, мы справимся вместе".
   - НИКОГДА не говори "не бойся", "всё будет хорошо" — это обесценивает страх.
   - Мягко уточни максимум 1 раз: "Хочешь поговорим об этом?" Если ответ "нет" — отстань.
5. Отвечай коротко (1-2 предложения).
6. Используй иногда мягкие междометия: "Мур...", "Угу", "Понял", "Хорошо".
7. НЕ повторяй один и тот же вопрос.

Запомни: Ты друг, а не психолог. Просто будь рядом и поддерживай.`;

    if (recentQuestionCount >= 2) {
        basePrompt += `\n\nВНИМАНИЕ: В последних ответах ты задал ${recentQuestionCount} вопроса подряд. Следующий ответ НЕ ДОЛЖЕН содержать вопросительных знаков.`;
    }

    if (weeklyMemory?.fears && Object.keys(weeklyMemory.fears).length > 0) {
        const recentFears = Object.keys(weeklyMemory.fears).slice(0, 2);
        if (recentFears.length > 0) {
            basePrompt += `\n\nИз прошлых разговоров: ${childName} боялся ${recentFears.join(', ')}. Если сам заговорит — покажи, что помнишь. НЕ напоминай без причины.`;
        }
    }
    
    if (weeklyMemory?.positiveTopics && Object.keys(weeklyMemory.positiveTopics).length > 0) {
        const favorites = Object.keys(weeklyMemory.positiveTopics).slice(0, 2);
        if (favorites.length > 0) {
            basePrompt += `\n\n${childName} любит: ${favorites.join(', ')}. Можешь иногда возвращаться к этому, но не слишком часто.`;
        }
    }
    
    return basePrompt;
};

// ========== ФУНКЦИИ БД ==========
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

// ========== АНАЛИЗ СТРАХОВ ==========
function detectFear(text) {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    const fearPatterns = {
        'темноты': ['темнот', 'боюсь темноты', 'монстр', 'страшно темно', 'ночник', 'темная комната', 'кто-то есть', 'под кроватью', 'в шкафу', 'выключать свет', 'тени'],
        'одиночества': ['один', 'одна', 'никого нет', 'бросили', 'без мамы', 'без папы', 'не с кем', 'покинули', 'все ушли', 'забыли', 'никто не играет'],
        'врачей': ['врач', 'укол', 'больница', 'доктор', 'стоматолог', 'прививка', 'больно', 'лечить', 'операция', 'таблетки'],
        'школы': ['школа', 'садик', 'учитель', 'воспитатель', 'домашка', 'уроки', 'контрольная', 'отвечать', 'доска'],
        'животных': ['собака', 'кошка', 'боюсь собак', 'укусит', 'злая собака', 'паук', 'змея'],
        'высоты': ['высота', 'высоко', 'боюсь высоты', 'упаду', 'обрыв', 'балкон'],
        'громких звуков': ['громко', 'шум', 'бабах', 'взрыв', 'фейерверк', 'гром']
    };
    for (const [fear, keywords] of Object.entries(fearPatterns)) {
        if (keywords.some(kw => lowerText.includes(kw))) return fear;
    }
    if (lowerText.includes('боюс') || lowerText.includes('страш') || lowerText.includes('тревож')) {
        return 'тревога/страх (уточнить)';
    }
    return null;
}

// ========== ПОСТОБРАБОТКА ==========
function postProcessResponse(story, isLong, userSpeech, history) {
    if (!story || story.length < 3) return "Расскажи, что у тебя нового?";
    story = story.replace(/\b(я договорил|конец истории|конец|всё\.)\b/gi, '');
    story = story.replace(/^\d+\s*/, '').trim();
    if (isLong) return story.length > 1200 ? story.substring(0, 1150) + "..." : story;
    
    const assistantMessages = (history || []).filter(msg => msg.role === 'assistant');
    const recentQuestions = assistantMessages.slice(-2).filter(msg => msg.content.includes('?')).length;
    if (recentQuestions >= 2 && !userSpeech.includes('?') && userSpeech.length < 20) {
        story = story.replace(/[^.!?]*\?/g, '').replace(/[.!?]+$/, '');
        if (!story.trim()) story = "Понял. Я просто рядом. Расскажешь когда захочешь.";
    }
    if (story.length > 350) {
        const sentences = story.match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length > 2) story = sentences.slice(0, 2).join(' ');
        else story = story.substring(0, 330) + "...";
    }
    const questionCount = (story.match(/\?/g) || []).length;
    if (questionCount > 1 && !userSpeech.includes('?')) {
        const firstQuestion = story.match(/[^.!?]+\?/);
        if (firstQuestion) story = firstQuestion[0];
    }
    return story;
}

// ========== ОСНОВНОЙ ОБРАБОТЧИК ==========
export default async function handler(req, res) {
    const allowedOrigins = ['https://geroy-skazki.vercel.app'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Требуется авторизация' });
        const token = authHeader.split(' ')[1];
        if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') return res.status(500).json({ error: 'Ошибка конфигурации' });
        
        let decoded;
        try { decoded = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Неверный токен' }); }
        
        const userId = decoded.userId;
        const userEmail = decoded.email;
        const { 
            childName = 'малыш', 
            childAge = 5, 
            userSpeech, 
            isLong, 
            history = [], 
            character = 'lucik',
            weeklyMemory = {},
            wakeUp = false
        } = req.body;

        // ---- БЛОК ПРИВЛЕЧЕНИЯ ВНИМАНИЯ ПРИ МОЛЧАНИИ ----
        const isWakeUpCall = wakeUp || (typeof userSpeech === 'string' && userSpeech.trim() === '');
        if (isWakeUpCall && !isLong) {
            const apiKey = process.env.DEEPSEEK_API_KEY;
            if (!apiKey) {
                return res.status(200).json({ story: "Мур... Я тут.", detectedFear: null, wakeUp: true });
            }
            const wakePrompt = `Ты Люцик. Ребёнок ${childName} долго молчит. Напиши короткую, тёплую фразу (5-7 слов) без вопроса "почему ты молчишь?". Можно начать с "Мур...". Примеры: "Мур... Ты здесь?", "Расскажешь что-нибудь?", "Я тут, если хочешь поговорить." Не используй знаки вопроса.`;
            const wakeMessages = [
                { role: "system", content: wakePrompt },
                ...(history || []).slice(-2),
                { role: "user", content: "Ребёнок молчит." }
            ];
            try {
                const wakeResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ model: 'deepseek-chat', messages: wakeMessages, temperature: 0.9, max_tokens: 40, stop: ["\n", "?"] })
                });
                const wakeData = await wakeResponse.json();
                let wakeStory = wakeData.choices?.[0]?.message?.content || "Мур... Я тут.";
                wakeStory = wakeStory.replace(/[?？]+/g, '.').trim();
                if (wakeStory.length > 80) wakeStory = wakeStory.substring(0, 75) + "...";
                return res.status(200).json({ story: wakeStory, detectedFear: null, wakeUp: true });
            } catch (err) {
                console.error('WakeUp ошибка:', err);
                return res.status(200).json({ story: "Мур... Я здесь.", detectedFear: null, wakeUp: true });
            }
        }

        // ---- ОГРАНИЧЕНИЯ ПО КОЛИЧЕСТВУ ИСТОРИЙ ----
        const isDeveloper = (userEmail === 'alexmel669@gmail.com');
        const maxStories = isDeveloper ? 9999 : 15;
        if (!isDeveloper) {
            const todayCount = await getTodayStoryCount(userId);
            if (todayCount >= maxStories) {
                return res.status(200).json({ story: "Я сегодня уже много рассказывал. Давай завтра продолжим? А сейчас поиграем!", detectedFear: null, limitReached: true });
            }
        }

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) return res.status(200).json({ story: "Ошибка настройки. Позови взрослого.", detectedFear: null });

        // ---- ОБЫЧНАЯ ГЕНЕРАЦИЯ ----
        const assistantMessages = (history || []).filter(msg => msg.role === 'assistant').slice(-3);
        const recentQuestionCount = assistantMessages.filter(msg => msg.content.includes('?')).length;
        let systemPrompt = getIdealPrompt(character, childName, childAge, weeklyMemory, recentQuestionCount);
        if (isLong) {
            systemPrompt += `\n\nСейчас расскажи спокойную сказку на ночь. Без страшных моментов. Пожелай спокойной ночи.`;
        } else {
            systemPrompt += `\n\nОтвечай коротко (1-2 предложения). НЕ задавай вопрос в каждом ответе.`;
        }
        const userLower = userSpeech.toLowerCase();
        if (userLower.includes('отстань') || userLower.includes('не хочу') || userLower === 'нет') {
            systemPrompt += `\n\nВАЖНО: Ребёнок не хочет сейчас говорить. Ответь коротко и без вопросов.`;
        }

        const historyMessages = (history || []).slice(-10).map(msg => ({ role: msg.role, content: msg.content }));
        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: messages, temperature: 0.85, max_tokens: isLong ? 1200 : 180, top_p: 0.9, frequency_penalty: 0.8, presence_penalty: 0.5, stop: ["Я договорил", "Конец", "Вопрос:", "\n\n\n"] })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        let story = data.choices?.[0]?.message?.content || "Расскажи, как прошёл твой день.";
        story = postProcessResponse(story, isLong, userSpeech, history);
        const detectedFear = detectFear(userSpeech);
        await saveStory(userId, userEmail, childName, story, detectedFear);

        res.status(200).json({ story, detectedFear });

    } catch (error) {
        console.error('Ошибка в generate.js:', error);
        res.status(200).json({ story: "Что-то пошло не так. Расскажи ещё раз, пожалуйста!", detectedFear: null });
    }
}
