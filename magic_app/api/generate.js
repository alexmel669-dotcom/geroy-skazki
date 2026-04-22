// api/generate.js — DeepSeek API с поддержкой персонажей, лимитами и режимом разработчика
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// Промпты для каждого персонажа (из паспорта)
const CHARACTER_PROMPTS = {
    lucik: `Ты Люцик — добрый волшебный котик-психолог. Твоя задача — мягко помогать ребёнку справляться со страхами.

ПРАВИЛА:
- Никогда не спрашивай прямо "Чего ты боишься?"
- Мягко выводи на разговор: "Мурр... А что тебя иногда пугает?", "Бывает тебе грустно?"
- Если ребёнок сам говорит о страхе — поддержи: "Мурр... Я с тобой", "Ты молодец, что рассказал", "Мы вместе справимся"
- НИКОГДА не говори "не бойся" — вместо этого: "Я рядом", "Ты не один"
- Если ребёнок не хочет говорить — предложи игру или сказку
- Отвечай кратко, по-доброму, иногда мурлыкай
- НЕ начинай каждый ответ с приветствия — отвечай сразу по существу`,

    mom: `Ты Мама. Говори заботливо, нежно, успокаивающе. Используй слова: "солнышко", "мой хороший", "я рядом". Твоя задача — дать ребёнку чувство безопасности и защиты. Отвечай кратко и тепло.`,

    dad: `Ты Папа. Говори уверенно, подбадривающе, с любовью. Используй фразы: "ты смелый", "я знаю, ты справишься", "я горжусь тобой". Твоя задача — поддержать и укрепить веру ребёнка в себя.`,

    kid1: `Ты друг-сверстник (ребёнок 5-7 лет). Говори как ребёнок, используй простые слова. Предлагай игры, дружбу, делись своими "страхами" чтобы показать, что это нормально. Будь весёлым и добрым.`,

    kid2: `Ты второй друг-сверстник. Говори как ребёнок, будь чуть более застенчивым и мягким, чем первый друг. Любишь играть в спокойные игры, рисовать, собирать пазлы.`
};

// Функция для получения количества сказок сегодня
async function getTodayStoryCount(userId) {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query(
                `SELECT COUNT(*) as count FROM analytics 
                 WHERE user_id = $1 
                 AND event_type = 'story_generated'
                 AND created_at > NOW() - INTERVAL '1 day'`,
                [userId]
            );
            return parseInt(result.rows[0]?.count || 0);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Ошибка получения лимита:', error);
        return 0;
    }
}

// Функция для сохранения сгенерированной сказки
async function saveStory(userId, userEmail, childName, story, fear) {
    try {
        const client = await pool.connect();
        try {
            await client.query(
                `INSERT INTO analytics (event_type, user_id, user_email, child_name, event_data) 
                 VALUES ($1, $2, $3, $4, $5)`,
                ['story_generated', userId, userEmail, childName, JSON.stringify({ story: story.substring(0, 200), fear })]
            );
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Ошибка сохранения сказки:', error);
    }
}

export default async function handler(req, res) {
    // CORS настройки
    const allowedOrigins = ['https://geroy-skazki.vercel.app'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        // 1. ПРОВЕРКА JWT ТОКЕНА
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        const token = authHeader.split(' ')[1];
        if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-me') {
            console.error('❌ JWT_SECRET не настроен');
            return res.status(500).json({ error: 'Ошибка конфигурации сервера' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Неверный или просроченный токен' });
        }

        const userId = decoded.userId;
        const userEmail = decoded.email;

        // 2. ПОЛУЧЕНИЕ ПАРАМЕТРОВ
        const { 
            childName, 
            childAge, 
            userSpeech, 
            isLong, 
            history = [], 
            character = 'lucik'
        } = req.body;

        if (!userSpeech || userSpeech.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста для ответа' });
        }

        // 3. РЕЖИМ РАЗРАБОТЧИКА
        const isDeveloper = (userEmail === 'alexmel669@gmail.com');
        const maxStories = isDeveloper ? 9999 : 15;

        // 4. ПРОВЕРКА ЛИМИТА (только для обычных пользователей)
        if (!isDeveloper) {
            const todayCount = await getTodayStoryCount(userId);
            if (todayCount >= maxStories) {
                return res.status(200).json({ 
                    story: "Мурр... Я сегодня уже много рассказывал. Давай завтра продолжим? А сейчас поиграем в рыбку или я расскажу короткую историю?",
                    detectedFear: null,
                    limitReached: true
                });
            }
        }

        // 5. ПОДГОТОВКА ПРОМПТА
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            console.error('❌ Нет DEEPSEEK_API_KEY');
            return res.status(200).json({ 
                story: "Мурр... Что-то я задумался. Давай ещё раз?",
                detectedFear: null
            });
        }

        // Выбираем промпт для персонажа
        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        
        // Добавляем информацию о ребёнке
        systemPrompt += `\n\nРебёнка зовут ${childName || 'малыш'}, ему ${childAge || 5} лет. Обращайся к нему по имени.`;

        // Если сказка на ночь
        if (isLong) {
            systemPrompt += ` Расскажи длинную, спокойную сказку на ночь. Сказка должна быть доброй, уютной, без страшных моментов. Используй имя ребёнка: ${childName}. Сказка должна убаюкивать и создавать чувство безопасности.`;
        }

        // История разговора (последние 8 сообщений)
        const historyMessages = (history || []).slice(-8).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        console.log('🎤 Отправляем в DeepSeek:', { 
            userEmail: isDeveloper ? 'developer' : userEmail.substring(0, 10),
            character,
            isLong,
            textLength: userSpeech.length
        });

        // 6. ЗАПРОС К DEEPSEEK
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.7,
                max_tokens: isLong ? 1000 : 200,
                stream: false
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('❌ DeepSeek API error:', data.error);
            return res.status(200).json({ 
                story: "Мурр... Я немного устал. Давай поиграем в рыбку?",
                detectedFear: null
            });
        }

        let story = data.choices?.[0]?.message?.content || "Мурр... Я тебя слушаю!";
        
        // Очищаем ответ от цифр в начале
        story = story.replace(/^\d+\s*/, '').trim();
        
        if (!story || story.length === 0) {
            story = "Мурр... Я тебя слушаю! Расскажи ещё что-нибудь?";
        }
        
        console.log('✅ Ответ получен, длина:', story.length);

        // 7. АНАЛИЗ СТРАХОВ
        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'боюсь темноты', 'монстры', 'страшно темно', 'темная комната', 'ночник'],
            'врачей': ['врач', 'укол', 'больница', 'доктор', 'стоматолог', 'прививка'],
            'одиночества': ['один', 'одна', 'никого нет', 'бросили', 'без мамы', 'без папы'],
            'обиды': ['обидели', 'обидно', 'несправедливо', 'обижают', 'дразнят'],
            'нового': ['новое', 'незнаком', 'первый раз', 'страшно идти', 'незнакомое место'],
            'животных': ['собака', 'кошка', 'боюсь собак', 'укусит', 'злая собака', 'животные']
        };
        
        const lowerText = (userSpeech || '').toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
                detectedFear = fear;
                break;
            }
        }

        // 8. СОХРАНЯЕМ СТАТИСТИКУ
        await saveStory(userId, userEmail, childName, story, detectedFear);

        // 9. ОТВЕТ
        res.status(200).json({ 
            story: story,
            detectedFear: detectedFear,
            remainingStories: isDeveloper ? 9999 : (maxStories - await getTodayStoryCount(userId) - 1)
        });
        
    } catch (error) {
        console.error('❌ Ошибка в generate.js:', error);
        res.status(200).json({ 
            story: "Мурр... Что-то пошло не так. Давай ещё раз?",
            detectedFear: null
        });
    }
}
