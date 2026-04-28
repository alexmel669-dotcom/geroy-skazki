// api/generate.js — ИДЕАЛЬНАЯ ЛОГИКА ДИАЛОГА
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

// ========== МИНИМАЛИСТИЧНЫЕ ПРОМПТЫ (БЕЗ ЛИШНИХ "МУР") ==========
const CHARACTER_PROMPTS = {
    lucik: `Ты Люцик — добрый друг ребёнка.

ПРАВИЛА ДИАЛОГА:
1. Запоминай, что ребёнок уже сказал. Не повторяй "привет" если уже поздоровались.
2. НЕ начинай каждый ответ с "Мур". Говори по-человечески.
3. НИКОГДА не говори "я договорил", "конец", "всё".
4. Всегда задавай вопрос в конце, чтобы продолжить диалог.
5. Если ребёнок сказал о страхе — поддержи: "Ты не один", "Я рядом", НЕ говори "не бойся".

Пример правильного диалога:
Ребёнок: Привет
Ты: Привет! Как дела?

Ребёнок: Хорошо
Ты: А что тебя сегодня радует?

Ребёнок: Машинка
Ты: Классно! А бывает что-то, что пугает?

Ребёнок: Темнота
Ты: Я понимаю. А давай придумаем, что делать? Например, ночник включить?

Говори коротко, 1-2 предложения. Будь живым и отзывчивым.`,

    mom: `Ты Мама. Говори тепло, коротко. НЕ повторяй приветствия. Задавай вопросы.`,
    dad: `Ты Папа. Говори уверенно, коротко. НЕ повторяй приветствия. Поддерживай.`,
    kid1: `Ты друг. Говори по-детски, коротко. НЕ повторяй приветствия.`,
    kid2: `Ты друг. Говори мягко, коротко. НЕ повторяй приветствия.`
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

        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        systemPrompt += `\n\nРебёнка зовут ${childName}, ему ${childAge} лет. Обращайся по имени.`;

        if (isLong) {
            systemPrompt += `\n\nРасскажи спокойную сказку на ночь. Закончи её и пожелай спокойной ночи. Не говори "я договорил".`;
        } else {
            systemPrompt += `\n\nОтвечай коротко (1-2 предложения). Обязательно задавай вопрос. НЕ говори "привет", если уже поздоровались. НЕ говори "я договорил".`;
        }

        // Добавляем информацию о прошлых страхах (но не напоминаем навязчиво)
        if (weeklyMemory && weeklyMemory.fears && Object.keys(weeklyMemory.fears).length > 0) {
            const recentFears = Object.keys(weeklyMemory.fears).slice(0, 2).join(', ');
            systemPrompt += `\n\nРебёнок говорил о страхах: ${recentFears}. Будь мягок, но не напоминай без причины.`;
        }

        // Формируем историю из переданных сообщений
        const historyMessages = (history || []).slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        console.log(`📜 История содержит ${historyMessages.length} сообщений для контекста`);

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.8,
                max_tokens: isLong ? 1200 : 180,
                top_p: 0.9,
                frequency_penalty: 0.6,
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
        
        // Жёсткая очистка от мусора
        story = story.replace(/^(привет|здравствуй|приветствую)/gi, '');
        story = story.replace(/[Мм]ур+/gi, '');
        story = story.replace(/я договорил/gi, '');
        story = story.replace(/конец истории/gi, '');
        story = story.replace(/всё\./gi, '');
        story = story.replace(/^\d+\s*/, '');
        story = story.trim();
        
        // Убираем множественные приветствия в начале
        if (story.length > 0) {
            const firstWord = story.split(' ')[0].toLowerCase();
            if (firstWord === 'привет' || firstWord === 'здравствуй') {
                story = story.split(' ').slice(1).join(' ').trim();
            }
        }
        
        // Если ответ пустой
        if (!story || story.length < 3) {
            story = "Расскажи, что у тебя нового? Что тебя сегодня волнует?";
        }
        
        // Добавляем вопрос, если его нет
        if (!isLong && !story.includes('?') && story.length < 150) {
            story += " А что ты сейчас чувствуешь?";
        }
        
        // Обрезаем слишком длинные ответы
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
            'темноты': ['темнот', 'боюсь темноты', 'монстры', 'страшно темно', 'ночник'],
            'врачей': ['врач', 'укол', 'больница', 'доктор', 'стоматолог'],
            'одиночества': ['один', 'одна', 'никого нет', 'бросили', 'без мамы'],
            'обиды': ['обидели', 'обидно', 'несправедливо', 'дразнят'],
            'нового': ['новое', 'незнаком', 'первый раз', 'страшно идти'],
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

        console.log(`✅ Ответ для ${childName}: "${story.substring(0, 80)}..."`);

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
