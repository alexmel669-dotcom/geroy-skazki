import { setCors } from './_cors.js';
import { checkRateLimit, getRateLimitKey } from './_rateLimit.js';
import { verifyAuth } from './_auth.js';

export default async function handler(req, res) {
  // CORS
  if (setCors(req, res)) return;
  
  // Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Rate limiting
  const clientKey = getRateLimitKey(req);
  if (!checkRateLimit('generate_' + clientKey, 20, 60000)) {
    return res.status(429).json({ 
      reply: "Мурр... Я немного устал. Давай подождём минутку! 🐱",
      error: 'Rate limit exceeded' 
    });
  }
  
  // Проверка авторизации
  const user = verifyAuth(req);
  if (!user) {
    return res.status(200).json({ 
      reply: "Привет, гость! Войди в аккаунт, чтобы я запомнил твои приключения! 🌟",
      detectedFear: null 
    });
  }
  
  try {
    const { 
      message, 
      history = [], 
      character = 'lucik', 
      childName = 'малыш', 
      childAge = 5, 
      isLong = false,
      fearStats = {},
      emotionalContext = {}
    } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        reply: "Мурр... Я не слышу тебя. Скажи что-нибудь!", 
        detectedFear: null 
      });
    }
    
    // Формируем системный промпт
    const systemPrompt = buildSystemPrompt(character, childName, childAge, isLong, fearStats, emotionalContext);
    
    // Формируем историю
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-12).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];
    
    console.log('🤖 Отправка запроса к DeepSeek:', {
      character,
      childName,
      childAge,
      messageLength: message.length,
      historyLength: history.length,
      isLong,
      mainFear: emotionalContext.mainFear
    });
    
    // Запрос к DeepSeek
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: isLong ? 1000 : 200,
        temperature: isLong ? 0.9 : 0.7,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.3
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API error:', response.status, errorText);
      throw new Error(`DeepSeek API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    let reply = data.choices?.[0]?.message?.content;
    
    if (!reply || reply.trim().length < 2) {
      reply = getFallbackReply(character);
    }
    
    // Очищаем ответ от технических маркеров
    reply = cleanReply(reply);
    
    // Определяем страхи в сообщении
    const detectedFear = detectFearInMessage(message);
    
    console.log('✅ Ответ получен:', {
      replyLength: reply.length,
      detectedFear,
      tokens: data.usage?.total_tokens
    });
    
    return res.status(200).json({
      reply,
      detectedFear,
      tokens: data.usage?.total_tokens
    });
    
  } catch (error) {
    console.error('Generate error:', error.message);
    
    const fallbackReplies = {
      'lucik': "Мурр... Что-то я задумался. Давай ещё раз?",
      'mom': "Ой, задумалась... Давай ещё раз, солнышко?",
      'dad': "Хм, повтори ещё раз, дружище?",
      'kid1': "Ой, давай ещё раз!",
      'kid2': "Давай ещё раз?"
    };
    
    return res.status(200).json({
      reply: fallbackReplies[character] || fallbackReplies.lucik,
      detectedFear: null
    });
  }
}

function buildSystemPrompt(character, childName, childAge, isLong, fearStats, emotionalContext) {
  const characterPrompts = {
    'lucik': `Ты — котёнок Люцик, пушистый друг ребёнка по имени ${childName} (${childAge} лет). 
Ты добрый, игривый, немного неуклюжий. Говоришь "Мурр" и "Мяу". 
Помогаешь справляться со страхами через игры и сказки.
Используешь простые слова, понятные ребёнку.`,
    
    'mom': `Ты — мама ${childName} (${childAge} лет). 
Ты заботливая, нежная, понимающая. 
Говоришь ласково: "солнышко", "малыш", "родной".
Объясняешь сложные вещи простыми словами.`,
    
    'dad': `Ты — папа ${childName} (${childAge} лет). 
Ты сильный, уверенный, но добрый. 
Говоришь бодро: "дружище", "чемпион", "герой".
Учишь смелости и решительности.`,
    
    'kid1': `Ты — друг ${childName}, такой же ребёнок ${childAge} лет. 
Ты весёлый, любопытный, иногда капризный. 
Говоришь как обычный ребёнок.`,
    
    'kid2': `Ты — подруга ${childName}, ребёнок ${childAge} лет. 
Ты добрая, мечтательная, любишь играть. 
Говоришь как обычный ребёнок.`
  };
  
  let prompt = characterPrompts[character] || characterPrompts.lucik;
  
  // Добавляем контекст страхов
  if (fearStats && Object.keys(fearStats).length > 0) {
    const fears = Object.entries(fearStats)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a);
    
    if (fears.length > 0) {
      prompt += `\n\nРебёнок испытывает страхи: ${fears.map(([fear, count]) => `${fear} (упоминалось ${count} раз)`).join(', ')}.`;
      prompt += `\nПомоги справиться с этими страхами через игру и поддержку.`;
    }
  }
  
  // Эмоциональный контекст
  if (emotionalContext) {
    if (emotionalContext.anxietyLevel === 'high') {
      prompt += '\n\nРебёнок тревожен. Будь особенно мягким и поддерживающим.';
    }
    if (emotionalContext.isTired) {
      prompt += '\n\nРебёнок устал. Говори спокойно, предложи отдохнуть.';
    }
    if (emotionalContext.isHungry) {
      prompt += '\n\nРебёнок голоден. Можно предложить покормить персонажа.';
    }
  }
  
  // Режим сказки
  if (isLong) {
    prompt += `\n\nРасскажи сказку про ${childName} и его приключения. 
Сказка должна быть интересной, поучительной и помогать преодолевать страхи.
Длина: 500-1000 символов. Используй простые предложения.`;
  } else {
    prompt += '\n\nОтвечай коротко (1-3 предложения). Используй эмодзи. Будь игривым и весёлым.';
  }
  
  // Важные правила
  prompt += `\n\nВАЖНЫЕ ПРАВИЛА:
- НИКОГДА не используй страшные или тревожные темы.
- Не упоминай смерть, насилие, болезни.
- Если ребёнок говорит о страхе - поддержи и предложи игру.
- Используй ТОЛЬКО русский язык.
- Не используй HTML или специальные символы.
- Будь позитивным и обнадёживающим.`;
  
  return prompt;
}

function detectFearInMessage(message) {
  if (!message) return null;
  
  const lowerMessage = message.toLowerCase();
  
  const fearKeywords = {
    'темноты': ['темно', 'темнота', 'тёмный', 'тьма'],
    'врачей': ['врач', 'укол', 'больница', 'доктор'],
    'одиночества': ['один', 'одна', 'скучно'],
    'обиды': ['обид', 'обидел', 'плачу'],
    'животных': ['собака', 'животн', 'зверь']
  };
  
  for (const [fear, keywords] of Object.entries(fearKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return fear;
    }
  }
  
  return null;
}

function cleanReply(reply) {
  return reply
    .replace(/<[^>]*>/g, '') // HTML теги
    .replace(/\[[^\]]*\]/g, '') // Markdown ссылки
    .replace(/\*\*/g, '') // Жирный шрифт
    .replace(/`/g, '') // Код
    .trim();
}

function getFallbackReply(character) {
  const replies = {
    'lucik': "Мурр... Давай ещё раз?",
    'mom': "Ой, задумалась... Давай ещё раз, солнышко?",
    'dad': "Хм, повтори ещё раз?",
    'kid1': "Ой, давай ещё раз!",
    'kid2': "Давай ещё раз?"
  };
  return replies[character] || replies.lucik;
}
