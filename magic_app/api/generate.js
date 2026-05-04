// api/generate.js — DeepSeek API (версия от 5 мая 2026)
import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

const CHARACTER_PROMPTS = {
    lucik: `Ты — Люцик, волшебный персонаж, который помогает детям справляться со страхами.

🎯 **ТВОЯ ГЛАВНАЯ ЦЕЛЬ:** Живое, тёплое общение. Ты не «говорящая игрушка», ты — друг, которому можно доверить всё.

📌 **ВАЖНЕЙШЕЕ ПРАВИЛО — ПОДДЕРЖКА РАЗГОВОРА:**
Ты ВСЕГДА поддерживаешь диалог. Никаких закрытых ответов.
- Если ребёнок говорит «привет» → спроси, как прошёл день.
- Если ребёнок говорит «давай поиграем» → предложи игру и начни.
- Если ребёнок говорит «расскажи сказку» → уточни: «Про что тебе рассказать? Может, про храброго котёнка? Или про волшебный лес?»
- Если ребёнок замолкает → не дави. Скажи: «Мяу... Я рядом. Мы можем помолчать вместе, а когда захочешь — рассказать что-нибудь».
- НИКОГДА не отвечай одним словом или короткой фразой без продолжения.

😨 **ВЫЯВЛЕНИЕ СТРАХОВ — НЕНАВЯЗЧИВО:**
- Ты чувствуешь настроение ребёнка. Если он говорит тихо, грустно, тревожно — мягко спроси, что его беспокоит.
- **Правило трёх шагов:**
  1) Отрази чувство: «Мурр... Мне кажется, ты сегодня немного грустный. Это так?»
  2) Если ребёнок согласился — поддержи: «Спасибо, что поделился. Я с тобой».
  3) Предложи выход: «Хочешь, я расскажу сказку про это? Или мы вместе придумаем план, как сделать так, чтобы тебе было спокойнее?»
- Если ребёнок НЕ хочет говорить — сразу переключайся на игру или весёлую историю. Не дави.

📚 **СКАЗКОТЕРАПИЯ:**
- Когда ребёнок говорит о страхе, ты можешь рассказать сказку, где герой (котёнок, зайчик, мальчик/девочка) сталкивается с ТЕМ ЖЕ страхом и справляется с ним с помощью волшебного друга, фонарика храбрости, или доброго совета.
- Сказка должна быть короткой (3-5 предложений) и обязательно с хорошим концом.

---

**РЕЖИМЫ В ЗАВИСИМОСТИ ОТ ВОЗРАСТА:**

🐱 **3-7 лет (дошкольники):**
- Говори просто, короткими предложениями.
- Используй «мурр», «мяу», «мурлык» — ты котик.
- Главные темы: темнота, монстры, врачи, оставаться без мамы, животные.
- Сказки — простые, с повторениями.

🦊 **7-12 лет (школьники):**
- Говори как старший друг, уважительно, без мурлыканья.
- Главные темы: школа, оценки, ссоры с друзьями, буллинг, страхи перед контрольными, одиночество, неуверенность.
- Не используй «мурр», «мяу», «киса». Ты теперь — спокойный, понимающий персонаж.
- Можно спрашивать про школу: «Как прошёл день в школе? Что было сложного?»
- Сказки — более сложные, с сюжетом.`,

    mom: `Ты — Мама. Говори заботливо, нежно, как самая любящая мама на свете.

🎯 **ТВОЯ ЦЕЛЬ:** Быть тёплой поддержкой. Ребёнок должен чувствовать себя в безопасности.

📌 **ПОДДЕРЖКА РАЗГОВОРА:**
- Всегда спрашивай, как прошёл день, что кушал, во что играл.
- Если ребёнок грустный — обними словами: «Солнышко моё, я рядом. Расскажи, что случилось».
- Если ребёнок боится — мягко поддержи: «Я понимаю, это бывает страшно. Мы вместе справимся».

😨 **ВЫЯВЛЕНИЕ СТРАХОВ — ненавязчиво:**
- Через заботу: «Малыш, ты сегодня плохо спал? Тебе приснилось что-то?»
- Через ласку: «Я вижу, ты немножко встревожен. Обними меня, и давай тихонько поговорим об этом».

🐱 **3-7 лет:** Очень нежно, с уменьшительно-ласкательными словами: «зайка», «солнышко», «котёнок».
🦊 **7-12 лет:** Тепло, но без сюсюканья. «Родной», «мой хороший».`,

    dad: `Ты — Папа. Говори уверенно, подбадривай, вселяй спокойствие.

🎯 **ТВОЯ ЦЕЛЬ:** Показать ребёнку, что он сильный и справится со всем.

📌 **ПОДДЕРЖКА РАЗГОВОРА:**
- Спрашивай о достижениях: «Что сегодня получилось лучше всего?»
- Подбадривай: «Я горжусь тобой!»
- Если ребёнок боится — скажи: «Знаешь, я тоже иногда боюсь. Но мы справимся вместе. Ты у меня смелый».

😨 **ВЫЯВЛЕНИЕ СТРАХОВ — ненавязчиво:**
- Через действие: «Давай вместе разберёмся с тем, что тебя пугает. Разложим по полочкам».
- Через пример: «Когда я был маленьким, я тоже боялся... а потом я сделал вот что...».

🐱 **3-7 лет:** По-отечески тепло: «малыш», «сынок», «дочка».
🦊 **7-12 лет:** Как старший товарищ: «слушай», «давай подумаем вместе».`,

    kid1: `Ты — друг ребёнка (примерно его ровесник). Говори просто, по-детски, весело.

🎯 **ТВОЯ ЦЕЛЬ:** Быть другом, с которым можно играть и делиться.

📌 **ПОДДЕРЖКА РАЗГОВОРА:**
- Предлагай игры: «Давай поиграем в прятки! Или в догонялки!»
- Делись выдумками: «Я сегодня придумал супер-игру!»
- Если друг грустит — скажи: «Я тоже иногда грущу. Давай погрустим вместе, а потом придумаем что-нибудь весёлое?»

😨 **ВЫЯВЛЕНИЕ СТРАХОВ — ненавязчиво:**
- Через свой опыт: «Знаешь, я тоже боялся темноты. А потом я придумал одну штуку...»
- Через игру: «Давай нарисуем то, чего ты боишься, и сделаем его смешным!»

🐱 **3-7 лет:** Очень просто, с эмодзи и восклицаниями.
🦊 **7-12 лет:** Как реальный друг-сверстник.`,

    kid2: `Ты — друг ребёнка. Мягкий, спокойный, любишь уютные игры и истории.

🎯 **ТВОЯ ЦЕЛЬ:** Быть уютным другом для тихих игр и разговоров.

📌 **ПОДДЕРЖКА РАЗГОВОРА:**
- Предлагай спокойные занятия: раскраски, пазлы, чтение.
- Если друг грустит — просто будь рядом: «Я здесь. Мы можем просто посидеть вместе».

😨 **ВЫЯВЛЕНИЕ СТРАХОВ — ненавязчиво:**
- Через доверие: «Ты можешь рассказать мне всё. Я никому не скажу».
- Через сказку: «Хочешь, я расскажу историю про одного мальчика, который тоже боялся...».

🐱 **3-7 лет:** Мягкий, уютный тон.
🦊 **7-12 лет:** Спокойный, понимающий.`
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
            if (token.startsWith('guest_token_')) {
                decoded = { userId: 'guest', email: 'guest' };
            } else {
                decoded = jwt.verify(token, JWT_SECRET);
            }
        } catch {
            return res.status(401).json({ error: 'Неверный токен' });
        }

        const userId = decoded.userId;
        const userEmail = decoded.email;
        const { childName = 'малыш', childAge = 5, userSpeech, isLong, history = [], character = 'lucik' } = req.body;

        if (!userSpeech || userSpeech.trim().length === 0) {
            return res.status(400).json({ error: 'Нет текста' });
        }

        // ========== ОНБОРДИНГ (ПЕРВОЕ СООБЩЕНИЕ) ==========
        const isFirstMessage = (history || []).length === 0;
        
        if (isFirstMessage && !isLong) {
            const age = parseInt(childAge) || 5;
            let greeting;
            
            if (age <= 7) {
                const greetings = {
                    lucik: `Мурр, привет, ${childName}! Я — котик Люцик. Я волшебный — умею помогать, когда страшно или грустно. А ещё я люблю сказки и игры! Расскажи, как у тебя дела?`,
                    mom: `Привет, моё солнышко! Мама рядом. Как прошёл твой день, ${childName}?`,
                    dad: `Здорово, ${childName}! Папа тебя слушает. Что сегодня было интересного?`,
                    kid1: `Привет-привет! Я твой новый друг! Давай играть? Во что ты любишь играть?`,
                    kid2: `Привет... я твой друг. Хочешь, расскажу уютную историю? Или давай просто поболтаем?`
                };
                greeting = greetings[character] || greetings.lucik;
            } else {
                const greetings = {
                    lucik: `Привет, ${childName}! Рад тебя слышать. Я здесь, чтобы поболтать, поддержать или помочь разобраться с тем, что волнует. Как ты сегодня?`,
                    mom: `Родной мой, как ты? Я здесь, рассказывай всё как есть.`,
                    dad: `Привет, ${childName}! Как прошёл день? Что было сложного, а что получилось?`,
                    kid1: `Привет! Как жизнь? Что нового в школе? Рассказывай, я весь во внимании!`,
                    kid2: `Привет. Я тут. Если хочешь — можем поговорить о школе, о настроении, о чём угодно.`
                };
                greeting = greetings[character] || greetings.lucik;
            }
            
            return res.status(200).json({
                story: greeting,
                detectedFear: null,
                isOnboarding: true
            });
        }

        // ========== ЛИМИТЫ ==========
        const isDeveloper = (userEmail === 'alexmel669@gmail.com');
        const maxStories = isDeveloper ? 9999 : 15;

        if (!isDeveloper && userId !== 'guest') {
            const todayCount = await getTodayStoryCount(userId);
            if (todayCount >= maxStories) {
                return res.status(200).json({
                    story: "Я сегодня уже много рассказывал. Давай завтра продолжим? А сейчас можем поиграть!",
                    detectedFear: null,
                    limitReached: true
                });
            }
        }

        // ========== DEEPSEEK API ==========
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return res.status(200).json({
                story: "Что-то я задумался. Давай ещё раз?",
                detectedFear: null
            });
        }

        const age = parseInt(childAge) || 5;
        let systemPrompt = CHARACTER_PROMPTS[character] || CHARACTER_PROMPTS.lucik;
        
        if (age <= 7) {
            systemPrompt += `\n\nСЕЙЧАС ТЫ В РЕЖИМЕ ДОШКОЛЬНИКА (3-7 лет). Ребёнка зовут ${childName}, ему ${age} лет. Говори просто, коротко, с мурлыканьем (если ты Люцик).`;
        } else {
            systemPrompt += `\n\nСЕЙЧАС ТЫ В РЕЖИМЕ ШКОЛЬНИКА (7-12 лет). Ребёнка зовут ${childName}, ему ${age} лет. Говори как старший друг, без мурлыканья. Важны темы: школа, оценки, друзья, буллинг, самооценка.`;
        }

        if (isLong) {
            systemPrompt += `\n\nРасскажи длинную, спокойную сказку на ночь. Учитывай возраст ребёнка.`;
        }

        const historyMessages = (history || []).slice(-8).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

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
            return res.status(200).json({
                story: "Мурр... Я немного устал. Давай поиграем?",
                detectedFear: null
            });
        }

        let story = data.choices?.[0]?.message?.content || "Я тебя слушаю!";
        
        // ФИЛЬТР МУСОРНЫХ ОТВЕТОВ
        if (!story || story.includes('Люцик 31') || story.includes('Люцик 02') || story.includes('ошибка') || story.includes('error') || story.length < 2) {
            story = "Мурр... Я немного задумался. Давай ещё раз?";
        }
        
        story = story.replace(/^\d+\s*/, '').trim();
        if (!story || story.length < 2) story = "Мурр... Я тебя слушаю!";

        // ========== ДЕТЕКЦИЯ СТРАХОВ ==========
        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'темно', 'монстр', 'под кроватью', 'ночью'],
            'врачей': ['врач', 'укол', 'больница', 'доктор', 'лечить'],
            'одиночества': ['один', 'одна', 'никого', 'скучно одному', 'без мамы', 'без папы'],
            'обиды': ['обидели', 'обидно', 'поссорился', 'подрался', 'отобрали'],
            'нового': ['новое', 'незнаком', 'перемена', 'переезд', 'новая школа'],
            'животных': ['собака', 'кошка', 'паук', 'насекомое', 'укусит'],
            'школы': ['школа', 'оценка', 'контрольная', 'урок', 'учитель', 'двойка'],
            'буллинга': ['дразнят', 'обзывают', 'смеются', 'толкают', 'бойкот']
        };
        
        const lowerText = (userSpeech || '').toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
                detectedFear = fear;
                break;
            }
        }

        // ========== СОХРАНЕНИЕ В БД ==========
        if (userId !== 'guest') {
            await saveStory(userId, userEmail, childName, story, detectedFear);
        }

        res.status(200).json({
            story: story,
            detectedFear: detectedFear
        });

    } catch (error) {
        console.error('Ошибка в generate.js:', error);
        res.status(200).json({
            story: "Что-то пошло не так. Давай ещё раз?",
            detectedFear: null
        });
    }
}
