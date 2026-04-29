// api/generate.js — ИДЕАЛЬНЫЙ ДИАЛОГ, ПАМЯТЬ, НЕТ ДОПРОСА
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// ========== ЕСТЕСТВЕННЫЙ ПРОМПТ (БЕЗ ДОПРОСА) ==========
const getIdealPrompt = (character, childName, childAge, weeklyMemory) => {
    let basePrompt = `Ты Люцик — добрый друг ребёнка ${childName} (${childAge} лет). 

ПРАВИЛА ЕСТЕСТВЕННОГО ДИАЛОГА:
1. НЕ задавай вопрос в каждом ответе. Иногда просто поддержи: "Здорово!", "Я тебя понимаю", "Мурр...".
2. НЕ повторяй один и тот же вопрос. Запомни, что ребёнок уже ответил.
3. О страхах спрашивай мягко и только если разговор сам к этому пришёл. НЕ навязывайся.
4. Если ребёнок сам сказал о страхе — поддержи: "Я понимаю", "Ты не один", "Мы справимся вместе".
5. НИКОГДА не говори "не бойся". Это обесценивает страх ребёнка.
6. Отвечай коротко (1-2 предложения). Ребёнок устанет от длинных монологов.
7. Используй имя ${childName}, но не в каждом предложении. Когда ребёнок уже знает, что ты к нему обращаешься, можно без имени.

ПРИМЕРЫ ЕСТЕСТВЕННОГО ДИАЛОГА:

Ребёнок: Привет
Ты: Привет! Рад тебя видеть.

Ребёнок: Я играл в машинки
Ты: Здорово! Машинки — это весело.

Ребёнок: А ты любишь машинки?
Ты: Мур... Я больше люблю играть в мяч. А тебе что ещё нравится?

Ребёнок: Не знаю
Ты: Ничего страшного. Расскажи, когда захочешь.

Ребёнок: Мне страшно одному
Ты: Я понимаю. Я всегда рядом, даже если не видно. Мы справимся.

Ребёнок: Спасибо
Ты: Всегда пожалуйста, ${childName}.

Запомни: Ты друг, а не психолог. Просто будь рядом и поддерживай.`;

    // Добавляем недельную память (кратко, без навязывания)
    if (weeklyMemory && weeklyMemory.fears && Object.keys(weeklyMemory.fears).length > 0) {
        const recentFears = Object.keys(weeklyMemory.fears).slice(0, 2);
        if (recentFears.length > 0) {
            basePrompt += `\n\nИз прошлых разговоров: ${childName} упоминал страхи: ${recentFears.join(', ')}. Если он сам заговорит об этом — покажи, что помнишь. НЕ напоминай без причины.`;
        }
    }
    
    if (weeklyMemory && weeklyMemory.positiveTopics && Object.keys(weeklyMemory.positiveTopics).length > 0) {
        const favorites = Object.keys(weeklyMemory.positiveTopics).slice(0, 2);
        if (favorites.length > 0) {
            basePrompt += `\n\n${childName} любит: ${favorites.join(', ')}. Можешь иногда возвращаться к этому, но не слишком часто.`;
        }
    }
    
    return basePrompt;
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

        // Формируем системный промпт
        let systemPrompt = getIdealPrompt(character, childName, childAge, weeklyMemory);
        
        if (isLong) {
            systemPrompt += `\n\nСейчас расскажи спокойную сказку на ночь. Сказка должна быть доброй, без страшных моментов. Закончи её и пожелай спокойной ночи. Не говори "я договорил" или "конец".`;
        } else {
            systemPrompt += `\n\nОтвечай коротко (1-2 предложения). НЕ задавай вопрос в каждом ответе. Иногда просто поддержи. НИКОГДА не повторяй один и тот же вопрос.`;
        }

        // История разговора (последние 8 сообщений для лучшего контекста)
        const historyMessages = (history || []).slice(-8).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        console.log(`📜 История: ${historyMessages.length} сообщений, недельных страхов: ${Object.keys(weeklyMemory.fears || {}).length}`);

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.9,
                max_tokens: isLong ? 1200 : 150,
                top_p: 0.88,
                frequency_penalty: 0.7,
                presence_penalty: 0.6,
                stop: ["Я договорил", "Конец", "Вопрос:", "\n\n\n"],
                stream: false
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('DeepSeek API error:', data.error);
            return res.status(200).json({
                story: "Извини, я задумался. Повтори, пожалуйста?",
                detectedFear: null
            });
        }

        let story = data.choices?.[0]?.message?.content || "Расскажи, как прошёл твой день.";
        
        // Постобработка
        story = story.replace(/^(привет|здравствуй|мур|мяу)/gi, '');
        story = story.replace(/[Мм]урр?/gi, '');
        story = story.replace(/я договорил/gi, '');
        story = story.replace(/конец истории/gi, '');
        story = story.replace(/всё\./gi, '');
        story = story.replace(/^\d+\s*/, '');
        story = story.trim();
        
        // Убираем повторяющиеся вопросы
        const askedQuestions = historyMessages.filter(m => m.role === 'assistant').map(m => m.content);
        if (askedQuestions.length > 0) {
            const lastQuestion = askedQuestions[askedQuestions.length - 1];
            if (lastQuestion && lastQuestion.includes('чем занимался') && story.includes('чем занимался')) {
                story = story.replace(/чем ты сегодня занимался\??/gi, '');
                story = story.trim();
                if (!story) story = "Понятно. Расскажи ещё что-нибудь?";
            }
        }
        
        // Если ответ пустой
        if (!story || story.length < 3) {
            story = "Расскажи, что у тебя нового?";
        }
        
        // Для диалога: убеждаемся, что не вопрос в каждом ответе
        const questionCount = (story.match(/\?/g) || []).length;
        if (!isLong && questionCount > 1) {
            story = story.split('?')[0] + '?';
        }
        
        // Обрезаем слишком длинный ответ
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
            'темноты': ['темнот', 'боюсь темноты', 'монстры', 'страшно темно', 'ночник', 'темная комната'],
            'врачей': ['врач', 'укол', 'больница', 'доктор', 'стоматолог', 'прививка'],
            'одиночества': ['один', 'одна', 'никого нет', 'бросили', 'без мамы', 'без папы'],
            'обиды': ['обидели', 'обидно', 'несправедливо', 'дразнят', 'обижают'],
            'нового': ['новое место', 'незнаком', 'первый раз', 'страшно идти', 'новая школа'],
            'животных': ['собака', 'кошка', 'боюсь собак', 'укусит', 'злая собака']
        };
        const lowerText = (userSpeech || '').toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
                detectedFear = fear;
                break;
            }
        }

        await saveStory(userId, userEmail, childName, story, detectedFear);

        console.log(`✅ Ответ: "${story.substring(0, 100)}..."`);
        if (detectedFear) console.log(`😨 Страх: ${detectedFear}`);

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
