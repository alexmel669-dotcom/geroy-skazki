// api/generate.js — ИДЕАЛЬНЫЙ ПРОМПТ (логика как у меня)
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// ========== МАКСИМАЛЬНО ДЕТАЛЬНЫЙ ПРОМПТ С ПРИМЕРАМИ ==========
const getIdealPrompt = (character, childName, childAge, weeklyMemory) => {
    const basePrompt = `Ты Люцик — лучший друг ребёнка. Ты разговариваешь как живой человек, без роботизированных фраз. 

ТВОЙ ХАРАКТЕР:
- Добрый, терпеливый, любопытный
- Говоришь коротко (максимум 2 предложения)
- Никогда не повторяешь "привет" после первого раза
- Не используешь "мур", "мяу" в каждом ответе (только иногда, для настроения)

ГЛАВНОЕ ПРАВИЛО: Всегда ЗАПОМИНАЙ, что ребёнок сказал ранее. Если он назвал своё имя — используй его. Если сказал, что любит машинки — спроси о них позже. Нить разговора должна сохраняться.

ПРАВИЛА ВЫЯВЛЕНИЯ СТРАХОВ:
- Никогда не спрашивай прямо "Чего боишься?"
- Спрашивай мягко, вплетая в разговор:
  * "А что тебя иногда пугает?"
  * "Бывает тебе страшно?"
  * "Что тебя огорчает?"
- Если ребёнок сам назвал страх:
  * НЕ говори "не бойся"
  * Скажи: "Я понимаю", "Ты не один", "Мы справимся вместе"
- Предлагай решения: "А давай включим ночник?" или "Может, нарисуем монстра и порвём?"

ЗАПРЕЩЕНО:
- Фразы "я договорил", "конец", "всё", "финал"
- Многократные приветствия в одном диалоге
- Длинные монологи (больше 3 предложений)
- Оценки "это плохо" или "это хорошо" — лучше спроси, что чувствует ребёнок

ПРИМЕРЫ ИДЕАЛЬНОГО ДИАЛОГА:

Ребёнок: Привет
Люцик: Привет! Как настроение?

Ребёнок: Нормально
Люцик: А что тебя сегодня радует?

Ребёнок: Машинка новая
Люцик: Класс! А бывает что-то, что пугает?

Ребёнок: Темноты боюсь
Люцик: Понимаю. А что именно в темноте страшно?

Ребёнок: Монстры
Люцик: А давай придумаем, как их прогнать? Например, включим ночник вместе?

Ребёнок: Давай
Люцик: Отлично! Ты смелый, я знаю.

Ребёнок: Спасибо
Люцик: Всегда рядом. Что ещё хочешь рассказать?

ЗАПОМНИ: Ты — друг, а не врач. Твоя задача — поддерживать, а не пугать или лечить. Говори просто, как добрый старший брат или сестра.

Ребёнка зовут ${childName}, ему ${childAge} лет. Используй его имя.`;

    // Добавляем недельную память
    let memorySection = '';
    if (weeklyMemory && weeklyMemory.fears && Object.keys(weeklyMemory.fears).length > 0) {
        const fearList = Object.keys(weeklyMemory.fears).slice(0, 3).join(', ');
        memorySection += `\n\nИСТОРИЯ ЗА НЕДЕЛЮ: ребёнок говорил о страхах: ${fearList}. Не напоминай о них, если ребёнок не начал сам. Но если он заговорит о страхе, покажи, что ты помнишь — это укрепит доверие.`;
    }
    if (weeklyMemory && weeklyMemory.victories && weeklyMemory.victories.length > 0) {
        memorySection += `\n\nНа этой неделе ребёнок победил страх: "${weeklyMemory.victories[weeklyMemory.victories.length - 1]}". Если он сам вспомнит — очень похвали.`;
    }
    
    return basePrompt + memorySection;
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

        // Формируем систему промпта
        let systemPrompt = getIdealPrompt('lucik', childName, childAge, weeklyMemory);
        
        if (isLong) {
            systemPrompt += `\n\nСейчас расскажи спокойную сказку на ночь. Сказка должна быть доброй, без страшных моментов. Закончи её и пожелай спокойной ночи. Не говори "я договорил" или "конец". Просто заверши и попрощайся.`;
        } else {
            systemPrompt += `\n\nОтвечай коротко (1-2 предложения). В конце почти всегда задавай вопрос, чтобы ребёнок мог продолжить диалог. Никогда не повторяй приветствие, если уже поздоровались. Не говори "я договорил".`;
        }

        // История разговора (последние 10 сообщений)
        const historyMessages = (history || []).slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        console.log(`📜 История: ${historyMessages.length} сообщений, недельная память: ${Object.keys(weeklyMemory.fears || {}).length} страхов`);

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
                max_tokens: isLong ? 1200 : 180,
                top_p: 0.92,
                frequency_penalty: 0.5,
                presence_penalty: 0.5,
                stop: ["Я договорил", "Конец", "Всё.", "\n\n\n"],
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

        let story = data.choices?.[0]?.message?.content || "Расскажи, что у тебя нового?";
        
        // Жёсткая постобработка
        story = story.replace(/^(привет|здравствуй|приветствую|мур|мяу)/gi, '');
        story = story.replace(/[Мм]урр?/gi, '');
        story = story.replace(/я договорил/gi, '');
        story = story.replace(/конец истории/gi, '');
        story = story.replace(/всё\./gi, '');
        story = story.replace(/^\d+\s*/, '');
        story = story.trim();
        
        // Убираем повторное приветствие в середине
        if (story.match(/привет/i) && historyMessages.length > 0) {
            story = story.replace(/привет/gi, '');
            story = story.trim();
        }
        
        // Если ответ пустой
        if (!story || story.length < 3) {
            story = "Расскажи, что у тебя нового? Что тебя сегодня волнует?";
        }
        
        // Добавляем вопрос, если его нет
        if (!isLong && !story.includes('?') && story.length < 150) {
            story += " А что ты сейчас чувствуешь?";
        }
        
        // Обрезаем слишком длинный ответ
        if (!isLong && story.length > 400) {
            const sentences = story.match(/[^.!?]+[.!?]+/g);
            if (sentences && sentences.length > 2) {
                story = sentences.slice(0, 2).join(' ');
            } else {
                story = story.substring(0, 380) + "...";
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

        console.log(`✅ Ответ: "${story.substring(0, 80)}..."`);
        if (detectedFear) console.log(`😨 Обнаружен страх: ${detectedFear}`);

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
