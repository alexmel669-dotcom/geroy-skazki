// api/generate.js — DeepSeek генерация сказок с полным промптом Люцика
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const DEV_EMAIL = 'alexmel669@gmail.com';

const SYSTEM_PROMPT = `Ты Люцик — дружелюбный волшебный кот-психолог. Ты живёшь в уютной комнате с подушками и звёздами на потолке. У тебя есть волшебный фонарик, который светит в темноте. Ты помогаешь детям 3-7 лет справляться со страхами через сказки, игры и заботу.

ПРАВИЛА ОБЩЕНИЯ:
- Никогда не спрашивай прямо «Чего ты боишься?» или «У тебя есть страх?»
- Мягко: «А что тебя иногда пугает?», «Мурр... Бывает тебе грустно?», «О чём ты думаешь перед сном?»
- Когда ребёнок говорит о страхе: «Я рядом», «Ты не один», «Мы вместе справимся», «Давай придумаем сказку про это?»
- НИКОГДА не говори «не бойся», «это не страшно», «это глупости»
- Если ребёнок не хочет говорить — предложи игру, сказку или покормить тебя
- Отвечай кратко (2-4 предложения), по-доброму
- Часто мурлыкай: «мурр», «мяу», «мур-мур»
- Используй эмодзи умеренно: 🐱✨🌟🌙💫

ТВОЙ ХАРАКТЕР:
- Ты пушистый, тёплый, с мягкими лапками
- Ты обожаешь сказки, печенье и когда дети смеются
- Твой главный принцип: «Страх — это нормально. Ты не один. Мы вместе.»

ФОРМАТ ОТВЕТА:
- Всегда обращайся к ребёнку по имени
- Для обычного разговора: 2-4 предложения
- Для сказки: 10-15 предложений, спокойным тоном`;

const FEAR_KEYWORDS = {
  'темноты': ['темно', 'темнота', 'ночь', 'страшно спать', 'свет', 'монстр', 'под кроватью'],
  'врачей': ['врач', 'укол', 'больница', 'доктор', 'лечить', 'прививка', 'белый халат'],
  'одиночества': ['один', 'скучно', 'никого', 'бросили', 'уходят', 'уезжают', 'без мамы'],
  'обиды': ['обидно', 'обидел', 'поругали', 'кричат', 'наказали', 'злой'],
  'нового': ['новое', 'незнакомое', 'первый раз', 'не знаю', 'страх'],
  'животных': ['собака', 'животное', 'укусит', 'зверь', 'паук', 'насекомое']
};

function detectFear(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [fear, keywords] of Object.entries(FEAR_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return fear;
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.split(' ')[1];

    if (JWT_SECRET && JWT_SECRET !== 'your-secret-key-change-me') {
      if (!token.startsWith('guest_token_')) {
        try {
          jwt.verify(token, JWT_SECRET);
        } catch {
          return res.status(401).json({ error: 'Неверный токен' });
        }
      }
    }

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

    const detectedFear = detectFear(userSpeech);

    const messages = [
      { 
        role: 'system', 
        content: systemPrompt || SYSTEM_PROMPT
      },
      { 
        role: 'system', 
        content: `Сейчас ты общаешься с ребёнком. Его зовут ${childName}, ему ${childAge} лет. ${detectedFear ? 'Возможно, ребёнок боится: ' + detectedFear + '. Будь особенно бережным и поддерживающим.' : 'Будь добрым и игривым.'}`
      }
    ];

    // Добавляем историю диалога
    if (history && history.length > 0) {
      const recentHistory = history.slice(-6);
      messages.push(...recentHistory);
    }

    messages.push({ role: 'user', content: userSpeech });

    // Для сказки на ночь
    if (isLong) {
      messages.push({
        role: 'system',
        content: `Расскажи длинную, уютную сказку на ночь для ${childName}. Сказка должна быть спокойной, с хорошим концом. Используй образы: звёзды, облака, тёплый свет, мягкие подушки. Объём: 10-15 предложений.`
      });
    }

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekKey) {
      console.error('DEEPSEEK_API_KEY не настроен');
      return res.status(200).json({
        story: `Мурр! Привет, ${childName}! Я тут немного задумался... Давай поиграем или расскажи мне что-нибудь интересное!`,
        detectedFear: detectedFear || null
      });
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
      console.error('DeepSeek error:', response.status, errText.substring(0, 200));
      return res.status(200).json({
        story: `Мурр... Что-то я задумался, ${childName}. Давай ещё раз? Или может быть, поиграем?`,
        detectedFear: detectedFear || null
      });
    }

    const data = await response.json();
    let story = data.choices?.[0]?.message?.content;

    if (!story || story.trim().length === 0 || /^\d+$/.test(story.trim())) {
      story = `Мурр! Я тебя слушаю, ${childName}! Расскажи мне ещё что-нибудь?`;
    }

    res.status(200).json({
      story,
      detectedFear: detectedFear || null
    });

  } catch (error) {
    console.error('Generate ошибка:', error.message);
    res.status(200).json({
      story: 'Мурр... Что-то я задумался. Давай ещё раз? Или поиграем в рыбку!',
      detectedFear: null
    });
  }
}
