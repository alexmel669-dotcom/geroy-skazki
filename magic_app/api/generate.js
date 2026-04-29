// api/generate.js — ИСПРАВЛЕННАЯ ВЕРСИЯ
// Правильная поддержка диалога, выявление страхов, нет допроса
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// ========== УЛУЧШЕННЫЙ ПРОМПТ С ПОДДЕРЖКОЙ ЭМОЦИЙ ==========
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
4. О СТРАХАХ (ОЧЕНЬ ВАЖНО):
   - Если ребёнок сказал "боюсь", "страшно", "тревожно", "пугает" -> скажи: "Я понимаю, это правда страшно. Ты не один, мы справимся вместе".
   - НИКОГДА не говори "не бойся", "всё будет хорошо", "не переживай" — это обесценивает страх.
   - Мягко уточни максимум 1 раз: "Хочешь поговорим об этом?" ИЛИ "Расскажешь, что случилось?"
   - Если ребёнок ответил "нет" или "не знаю" -> сразу отстань, скажи "Ладно, я просто рядом когда нужно".
5. Отвечай коротко (1-2 предложения). Ребёнок устанет от длинных монологов.
6. Используй иногда мягкие междометия: "Мур...", "Угу", "Понял", "Хорошо".
7. НЕ повторяй один и тот же вопрос. Запомни, что ребёнок уже ответил.

ПРИМЕРЫ ПРАВИЛЬНОГО ДИАЛОГА:

Ребёнок: Привет
Ты: Привет! Рад тебя видеть.

Ребёнок: Я играл
Ты: Здорово! А во что играл?

Ребёнок: Не знаю
Ты: Ничего страшного. Расскажешь потом.

Ребёнок: Мне страшно одному
Ты: Понимаю. Я всегда рядом, даже если не видно.

Ребёнок: Спасибо
Ты: Пожалуйста, ${childName}. Ты молодец, что говоришь о страхах.

Ребёнок: Отстань
Ты: Хорошо. Я здесь, если захочешь поговорить.

Ребёнок: МНЕ СТРАШНО!!!
Ты: Я слышу, тебе правда страшно. Я рядом, не бойся меня, бойся чего хочешь.

Запомни: Ты друг, а не психолог. Просто будь рядом и поддерживай.`;

    // Если было слишком много вопросов подряд — жёстко ограничиваем
    if (recentQuestionCount >= 2) {
        basePrompt += `\n\nВНИМАНИЕ: В последних ответах ты задал ${recentQuestionCount} вопроса подряд. Следующий ответ НЕ ДОЛЖЕН содержать вопросительных знаков. Просто поддержи или скажи что-то ободряющее без вопросов.`;
    }

    // Добавляем недельную память (кратко, без навязывания)
    if (weeklyMemory && weeklyMemory.fears && Object.keys(weeklyMemory.fears).length > 0) {
        const recentFears = Object.keys(weeklyMemory.fears).slice(0, 2);
        if (recentFears.length > 0) {
            basePrompt += `\n\nИз прошлых разговоров: ${childName} боялся ${recentFears.join(', ')}. Если он сам заговорит об этом — покажи, что помнишь. НЕ напоминай без причины.`;
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
    } catch { 
        return 0; 
    }
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
    } catch (error) { 
        console.error('Ошибка сохранения:', error); 
    }
}

// ========== РАСШИРЕННЫЙ АНАЛИЗ СТРАХОВ ==========
function detectFear(text) {
    if (!text) return null;
    
    const lowerText = text.toLowerCase();
    
    // Расширенные паттерны страхов
    const fearPatterns = {
        'темноты': [
            'темнот', 'боюсь темноты', 'монстр', 'страшно темно', 'ночник', 'темная комната',
            'кто-то есть', 'под кроватью', 'в шкафу', 'выключать свет', 'тени', 'страшно спать',
            'не вижу', 'темнеет', 'ночь', 'ночью', 'выключили свет', 'темница'
        ],
        'одиночества': [
            'один', 'одна', 'никого нет', 'бросили', 'без мамы', 'без папы', 'не с кем',
            'покинули', 'все ушли', 'меня нет', 'забыли', 'не подходит никто', 'никто не играет',
            'никто не любит', 'не нужен', 'остался один', 'покинутый'
        ],
        'врачей': [
            'врач', 'укол', 'больница', 'доктор', 'стоматолог', 'прививка', 'больно',
            'лечить', 'операция', 'медсестра', 'таблетки', 'лекарство', 'уколоться',
            'поликлиника', 'палата', 'хирург', 'зубной'
        ],
        'школы': [
            'школа', 'садик', 'учитель', 'воспитатель', 'детсад', 'домашка', 'уроки',
            'контрольная', 'отвечать', 'доска', 'вызывают', 'класс', 'перемена',
            'страшно идти в школу', 'плохие оценки', 'двойка'
        ],
        'животных': [
            'собака', 'кошка', 'боюсь собак', 'укусит', 'злая собака', 'кусается',
            'животное', 'паук', 'змея', 'мышь', 'насекомое', 'жучок'
        ],
        'высоты': [
            'высота', 'высоко', 'боюсь высоты', 'упаду', 'обрыв', 'балкон', 'крыша',
            'с высоты', 'на высоте', 'головокружение от высоты'
        ],
        'громких звуков': [
            'громко', 'шум', 'бабах', 'взрыв', 'фейерверк', 'гром', 'раскат',
            'шумит', 'испугался звука', 'неожиданный звук'
        ]
    };
    
    // Проверяем каждый паттерн
    for (const [fear, keywords] of Object.entries(fearPatterns)) {
        if (keywords.some(kw => lowerText.includes(kw))) {
            return fear;
        }
    }
    
    // Дополнительно: ловим общие слова страха, которые не попали в категории
    if (lowerText.includes('боюс') || lowerText.includes('страш') || 
        lowerText.includes('тревож') || lowerText.includes('пуга') ||
        lowerText.includes('ужасн') || lowerText.includes('паник')) {
        return 'тревога/страх (уточнить)';
    }
    
    return null;
}

// ========== ЩАДЯЩАЯ ПОСТОБРАБОТКА ОТВЕТА ==========
function postProcessResponse(story, isLong, userSpeech, history) {
    if (!story || story.length < 3) {
        return "Расскажи, что у тебя нового?";
    }
    
    // Убираем только явные служебные фразы (НЕ трогаем "Мурр..." и приветствия)
    story = story.replace(/\b(я договорил|конец истории|конец|всё\.)\b/gi, '');
    story = story.replace(/^\d+\s*/, '');
    story = story.trim();
    
    // Для длинных ответов (сказки) — минимальная обработка
    if (isLong) {
        if (story.length > 1200) {
            story = story.substring(0, 1150) + "...";
        }
        return story;
    }
    
    // Для диалогов: проверяем количество вопросов подряд
    const assistantMessages = (history || []).filter(msg => msg.role === 'assistant');
    const recentQuestions = assistantMessages.slice(-2).filter(msg => msg.content.includes('?')).length;
    
    // Если AI уже задавал вопросы и пользователь не отвечал на них развёрнуто
    if (recentQuestions >= 2 && !userSpeech.includes('?') && userSpeech.length < 20) {
        // Убираем все вопросы из ответа
        story = story.replace(/[^.!?]*\?/g, '');
        story = story.replace(/[.!?]+$/, '');
        if (!story.trim()) {
            story = "Понял. Я просто рядом. Расскажешь когда захочешь.";
        }
    }
    
    // Ограничиваем длину для диалога
    if (story.length > 350) {
        const sentences = story.match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length > 2) {
            story = sentences.slice(0, 2).join(' ');
        } else {
            story = story.substring(0, 330) + "...";
        }
    }
    
    // Если всё ещё слишком много вопросов (>1), оставляем только первый
    const questionCount = (story.match(/\?/g) || []).length;
    if (!isLong && questionCount > 1 && !userSpeech.includes('?')) {
        const firstQuestion = story.match(/[^.!?]+\?/);
        if (firstQuestion) {
            story = firstQuestion[0];
        }
    }
    
    return story;
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

        // Лимиты на генерацию
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

        // Подсчитываем, сколько вопросов AI задал подряд
        const assistantMessages = (history || []).filter(msg => msg.role === 'assistant').slice(-3);
        const recentQuestionCount = assistantMessages.filter(msg => msg.content.includes('?')).length;

        // Формируем системный промпт с учётом количества вопросов
        let systemPrompt = getIdealPrompt(character, childName, childAge, weeklyMemory, recentQuestionCount);
        
        if (isLong) {
            systemPrompt += `\n\nСейчас расскажи спокойную сказку на ночь. Сказка должна быть доброй, без страшных моментов. Закончи её и пожелай спокойной ночи. Не говори "я договорил" или "конец".`;
        } else {
            systemPrompt += `\n\nОтвечай коротко (1-2 предложения). Помни: НЕ задавай вопрос в каждом ответе.`;
        }

        // Добавляем специальную обработку, если ребёнок явно не хочет говорить
        const userLower = userSpeech.toLowerCase();
        if (userLower.includes('отстань') || userLower.includes('не хочу') || userLower === 'нет') {
            systemPrompt += `\n\nВАЖНО: Ребёнок не хочет сейчас говорить. Ответь максимально коротко и прекрати вопросы. Например: "Хорошо", "Ладно, я молчу", "Понял".`;
        }

        // История разговора (последние 10 сообщений для лучшего контекста)
        const historyMessages = (history || []).slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        console.log(`📜 История: ${historyMessages.length} сообщений`);
        console.log(`❓ Вопросов подряд: ${recentQuestionCount}`);
        console.log(`👤 Сообщение: "${userSpeech.substring(0, 100)}"`);

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.85,  // Чуть снизил для предсказуемости
                max_tokens: isLong ? 1200 : 180,
                top_p: 0.9,
                frequency_penalty: 0.8,  // Увеличил, чтобы избегать повторов
                presence_penalty: 0.5,
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
        
        // Постобработка ответа
        story = postProcessResponse(story, isLong, userSpeech, history);
        
        // Анализ страхов (улучшенный)
        let detectedFear = detectFear(userSpeech);
        
        // Дополнительно проверяем страх в ответе AI (на случай, если AI распознал)
        if (!detectedFear && story.toLowerCase().includes('страх') || story.toLowerCase().includes('боишься')) {
            // Не назначаем конкретный страх, но логируем
            console.log('⚠️ AI упомянул страх в ответе');
        }

        // Сохраняем в БД
        await saveStory(userId, userEmail, childName, story, detectedFear);

        console.log(`✅ Ответ: "${story.substring(0, 100)}..."`);
        if (detectedFear) console.log(`😨 Выявлен страх: ${detectedFear}`);

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
