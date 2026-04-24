// api/generate.js — DeepSeek генерация сказок (с логами для отладки)
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

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
    if (keywords.some(kw => lower.includes(kw))) return fear;
  }
  return null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://geroy-skazki.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  try {
    const {
      childName = 'малыш',
      childAge = 5,
      userSpeech,
      isLong = false,
      history = [],
      systemPrompt = ''
    } = req.body;

    if (!userSpeech || userSpeech.trim().length === 0) {
      return res.status(400).json({ error: 'Нет сообщения' });
    }

    console.log('=== GENERATE START ===');
    console.log('userSpeech:', userSpeech.substring(0, 100));
    console.log('isLong:', isLong);
    console.log('history length:', history.length);

    const detectedFear = detectFear(userSpeech);
    if (detectedFear) {
      console.log('detectedFear:', detectedFear);
    }

    // Промпт Люцика
    const defaultPrompt = `Ты Люцик — дружелюбный волшебный кот-психолог. Ты помогаешь детям 3-7 лет справляться со страхами через сказки, игры и заботу.

ПРАВИЛА ОБЩЕНИЯ:
- Никогда не спрашивай прямо «Чего ты боишься?» или «У тебя есть страх?»
- Мягко: «А что тебя иногда пугает?», «Мурр... Бывает тебе грустно?»
- При страхе говори: «Я рядом», «Ты не один», «Мы вместе справимся»
- НИКОГДА не говори «не бойся» или «это не страшно»
- Если ребёнок не хочет говорить о страхах — предложи игру или сказку
- Отвечай кратко (2-4 предложения), по-доброму, иногда мурлыкай («мурр», «мяу»)

Ребёнка зовут ${childName}, ${childAge} лет.`;

    const fullSystemPrompt = systemPrompt || defaultPrompt;

    const messages = [
      { role: 'system', content: fullSystemPrompt }
    ];

    // Добавляем историю диалога (последние 6 сообщений)
    if (history && history.length > 0) {
      const recentHistory = history.slice(-6);
      messages.push(...recentHistory);
    }

    // Сообщение пользователя
    messages.push({ role: 'user', content: userSpeech });

    // Для длинных сказок
    if (isLong) {
      messages.push({
        role: 'system',
        content: 'Расскажи длинную, уютную сказку на ночь (10-15 предложений). Сказка должна быть спокойной, с хорошим концом. Используй мягкие образы: звёзды, облака, тёплый свет.'
      });
    }

    console.log('Messages count:', messages.length);

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    
    if (!deepseekKey) {
      console.error('DEEPSEEK_API_KEY NOT FOUND in environment!');
      return res.status(500).json({
        story: 'Мурр... Ключик потерялся! Нужно настроить DEEPSEEK_API_KEY.',
        detectedFear: null
      });
    }

    console.log('DEEPSEEK_API_KEY found, length:', deepseekKey.length);
    console.log('Calling DeepSeek API...');

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

    console.log('DeepSeek response status:', response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek ERROR:', response.status, errText.substring(0, 300));
      return res.status(500).json({
        story: 'Мурр... Что-то я задумался. Давай ещё раз?',
        detectedFear: null
      });
    }

    const data = await response.json();
    console.log('DeepSeek response received, choices:', data.choices?.length);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('DeepSeek empty response:', JSON.stringify(data).substring(0, 200));
      return res.status(500).json({
        story: 'Мурр... Я запутался в мыслях. Скажи ещё раз?',
        detectedFear: null
      });
    }

    const story = data.choices[0].message.content;
    console.log('Story generated, length:', story.length);
    console.log('=== GENERATE END ===');

    return res.status(200).json({
      story,
      detectedFear: detectedFear || null
    });

  } catch (error) {
    console.error('Generate CRASH:', error.message);
    console.error('Stack:', error.stack?.substring(0, 200));
    return res.status(500).json({
      story: 'Мурр... Что-то сломалось. Давай попробуем позже?',
      detectedFear: null
    });
  }
}
