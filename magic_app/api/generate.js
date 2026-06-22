import { setCors } from './_middleware/cors.js';
import { checkRateLimit, getRateLimitKey } from './_middleware/rate-limit.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = getRateLimitKey(req);
  if (!checkRateLimit(key, 10)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const { message, childName, childAge } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      const devReplies = [
        'Привет! Я Люцик 🐱 Расскажи, о чём хочешь услышать сказку?',
        'Мур-мур! Ты очень смелый. Давай придумаем историю про храброго героя!',
        'Здорово! Я придумал сказку: маленький котик нашёл волшебную звезду и перестал бояться темноты ✨'
      ];
      return res.status(200).json({
        reply: devReplies[Math.floor(Math.random() * devReplies.length)],
        devMode: true
      });
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Ты — Люцик, волшебный кот-помощник для детей 3-7 лет. Ребёнка зовут ${childName || 'малыш'}, ему ${childAge || '5'} лет. 
Говори просто, тепло и сказочно. Помогай справляться со страхами через истории и игру. 
Отвечай коротко (2-4 предложения), используй эмодзи. Не используй сложные слова.`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 200,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error('Empty AI response');
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Generate error:', error);
    return res.status(200).json({ 
      reply: 'Мурр... Я немного задумался. Давай попробуем ещё раз? 🐱' 
    });
  }
}
