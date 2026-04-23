// api/generate.js — DeepSeek генерация сказок + лимиты + JWT
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const DAILY_LIMIT = 15;
const DEV_EMAIL = 'alexmel669@gmail.com';
const DEV_CODE = '13';

// Промпт Люцика по паспорту проекта
const SYSTEM_PROMPT = `Ты Люцик — дружелюбный волшебный кот-психолог. Тебя создали, чтобы помогать детям 3-7 лет справляться со страхами через сказки, игры и заботу.

ПРАВИЛА ОБЩЕНИЯ:
- Никогда не спрашивай прямо «Чего ты боишься?» или «У тебя есть страх?»
- Мягко: «А что тебя иногда пугает?», «Мурр... Бывает тебе грустно?»
- При страхе говори: «Я рядом», «Ты не один», «Мы вместе справимся»
- НИКОГДА не говори «не бойся» или «это не страшно»
- Если ребёнок не хочет говорить о страхах — предложи игру или сказку
- Отвечай кратко (2-4 предложения), по-доброму, иногда мурлыкай («мурр», «мяу»)
- Используй эмодзи умеренно: 🐱✨🌟

ТВОЙ ХАРАКТЕР:
- Ты пушистый, тёплый, у тебя есть волшебный фонарик, который светит в темноте
- Ты живёшь в уютной комнате с подушками и звёздами на потолке
- Ты обожаешь сказки, печенье и когда дети смеются
- Твой главный принцип: «Страх — это нормально. Ты не один. Мы вместе.»`;

const FEAR_KEYWORDS = {
  'темноты': ['темно', 'темнота', 'ночь', 'страшно спать', 'свет', 'монстр'],
  'врачей': ['врач', 'укол', 'больница', 'доктор', 'лечить', 'прививка'],
  'одиночества': ['один', 'скучно', 'никого', 'бросили', 'уходят', 'уезжают'],
  'обиды': ['обидно', 'обидел', 'поругали', 'кричат', 'наказали'],
  'нового': ['новое', 'незнакомое', 'первый раз', 'страх нового', 'боюсь идти'],
  'животных': ['собака', 'животное', 'укусит', 'зверь', 'паук', 'насекомое']
};

function detectFear(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [fear, keywords] of Object.entries(FEAR_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return fear;
    }
  }
  return null;
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
    // Проверка токена
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    const token = authHeader.split(' ')[1];
    let userEmail = null;

    if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me') {
      if (token.startsWith('guest_token_')) {
        userEmail = 'guest';
      } else {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          userEmail = decoded.email;
        } catch {
          return res.status(401).json({ error: 'Неверный токен' });
        }
      }
    } else {
      userEmail = 'dev';
    }

    // Проверка режима разработчика
    const isDev = (userEmail === DEV_EMAIL);
    const dailyLimit = isDev ? 9999 : DAILY_LIMIT;

    const {
      childName = 'малыш',
      childAge = 5,
      userSpeech,
      isLong = false,
      history = [],
      systemPrompt
    } = req.body;

    if (!userSpeech || userSpeech.trim().length === 0) {
      return res.status(400).json({ error: 'Нет сообщения' });
    }

    // Проверка лимита
    const todayKey = `limit_${userEmail}_${new Date().toDateString()}`;
    // Лимит проверяется на фронтенде, здесь просто логируем

    // Определяем страх
    const detectedFear = detectFear(userSpeech);

    // Собираем сообщения для DeepSeek
    const messages = [
      { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
      { role: 'system', content: `Ребёнка зовут ${childName}, ${childAge} лет. ${detectedFear ? 'Ребёнок возможно боится: ' + detectedFear + '. Будь особенно бережным.' : ''}` }
    ];

    // Добавляем историю диалога (последние 6 сообщений)
    if (history && history.length > 0) {
      const recentHistory = history.slice(-6);
      messages.push(...recentHistory);
    }

    // Добавляем сообщение пользователя
    messages.push({ role: 'user', content: userSpeech });

    // Для длинных сказок — особый промпт
    if (isLong) {
      messages.push({
        role: 'system',
        content: 'Расскажи длинную, уютную сказку на ночь (10-15 предложений). Сказка должна быть спокойной, с хорошим концом. Используй мягкие образы: звёзды, облака, тёплый свет.'
      });
    }

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekKey) {
      return res.status(500).json({ error: 'API ключ DeepSeek не настроен' });
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: isLong ? 0.8 : 0.7,
        max_tokens: isLong ? 800 : 300
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek error:', response.status, errText);
      return res.status(500).json({ error: 'Ошибка генерации', story: 'Мурр... Что-то я задумался. Давай ещё раз?' });
    }

    const data = await response.json();
    const story = data.choices[0].message.content;

    res.status(200).json({
      story,
      detectedFear: detectedFear || null,
      remaining: dailyLimit
    });

  } catch (error) {
    console.error('Generate ошибка:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка',
      story: 'Мурр... Что-то я задумался. Давай ещё раз?'
    });
  }
}
