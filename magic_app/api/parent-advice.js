// api/parent-advice.js — Советы психолога через DeepSeek V4
// Обновлено: 21 мая 2026
// Модель: deepseek-v4-flash (готово к июлю 2026)

export default async function handler(req, res) {
    // CORS для всех доменов
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

    // Проверка API ключа
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        console.error('❌ DEEPSEEK_API_KEY не настроен');
        return res.status(503).json({ 
            error: 'Сервис временно недоступен',
            advice: '🌙 Попробуйте обнять ребёнка и сказать: "Я рядом, мы справимся вместе".\n\n📞 Если страх сильный, обратитесь к детскому психологу.'
        });
    }

    try {
        // Проверка авторизации (опционально)
        const authHeader = req.headers.authorization;
        let userId = 'anonymous';
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token && !token.startsWith('guest_token_')) {
                userId = token.slice(0, 50);
            }
        }

        const { fear, childAge, childName } = req.body;
        
        if (!fear || fear.trim() === '') {
            return res.status(400).json({ error: 'Укажите страх ребёнка' });
        }
        
        const age = parseInt(childAge) || 5;
        const name = childName || 'малыш';
        
        // Возрастной контекст
        let ageContext = '';
        if (age <= 7) {
            ageContext = `Ребёнок — дошкольник (${age} лет). Используй рекомендации для маленьких детей: игры, сказки, телесный контакт с родителем. Говори простыми фразами.`;
        } else if (age <= 12) {
            ageContext = `Ребёнок — школьник (${age} лет). Используй рекомендации для младших школьников: логические объяснения, разговоры, стратегии преодоления.`;
        } else {
            ageContext = `Ребёнок — подросток (${age} лет). Используй рекомендации для подростков: уважительный диалог, без давления, признание его чувств.`;
        }
        
        const prompt = `Ты — детский психолог с 20-летним опытом. Родитель ребёнка ${name} (${age} лет) обращается за помощью. Ребёнок боится: "${fear}".

${ageContext}

Дай родителю практический, тёплый, доказательный ответ. Используй структуру:

1. КАК НАЧАТЬ РАЗГОВОР: (2-3 мягкие фразы, подходящие по возрасту)
2. ЧЕГО НЕЛЬЗЯ ГОВОРИТЬ: (2-3 фразы, которые могут навредить)
3. ИГРЫ И УПРАЖНЕНИЯ: (2-3 конкретных задания, подходящих по возрасту)
4. КОГДА НУЖЕН СПЕЦИАЛИСТ: (чёткие признаки, когда пора к психологу)

Отвечай тёплым, поддерживающим тоном. Пиши на русском. Будь конкретным и практичным.`;

        console.log(`📝 Запрос совета: страх="${fear}", возраст=${age}, имя=${name}`);

        // ✅ ИСПОЛЬЗУЕМ НОВУЮ МОДЕЛЬ deepseek-v4-flash
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-v4-flash',  // ← НОВАЯ МОДЕЛЬ (готово к июлю 2026)
                messages: [
                    { role: 'system', content: 'Ты — добрый, профессиональный детский психолог. Даёшь практические советы родителям.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1000,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ DeepSeek API ошибка:', response.status, errorText);
            
            // Возвращаем fallback совет в зависимости от страха
            const fallbackAdvice = getFallbackAdvice(fear, age, name);
            return res.status(200).json({ 
                advice: fallbackAdvice, 
                fear,
                fallback: true
            });
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('❌ Неожиданный ответ DeepSeek:', data);
            const fallbackAdvice = getFallbackAdvice(fear, age, name);
            return res.status(200).json({ 
                advice: fallbackAdvice, 
                fear,
                fallback: true
            });
        }
        
        let advice = data.choices[0].message.content;
        
        // Очистка ответа
        advice = advice.replace(/[\*\_\#]/g, '').trim();
        
        if (!advice || advice.length < 20) {
            advice = getFallbackAdvice(fear, age, name);
        }
        
        // Логируем успешный запрос
        console.log(`✅ Совет сгенерирован для страха "${fear}", длина ответа: ${advice.length}`);
        
        res.status(200).json({ 
            advice: advice, 
            fear,
            generatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Ошибка в parent-advice:', error);
        
        const { fear, childAge, childName } = req.body;
        const age = parseInt(childAge) || 5;
        const name = childName || 'малыш';
        const fallbackAdvice = getFallbackAdvice(fear || 'страх', age, name);
        
        res.status(200).json({ 
            advice: fallbackAdvice,
            fear: fear || 'страх',
            fallback: true,
            error: error.message
        });
    }
}

// ========== FALLBACK СОВЕТЫ (при ошибке API) ==========
function getFallbackAdvice(fear, age, name) {
    const isYoung = age <= 7;
    
    const fallbacks = {
        'темнота': `🌙 **Как помочь при страхе темноты**

1. **КАК НАЧАТЬ РАЗГОВОР:**
   - "Я понимаю, что темнота может пугать. Давай вместе придумаем, как сделать её менее страшной?"
   - "Знаешь, многие дети боятся темноты. Это нормально."

2. **ЧЕГО НЕЛЬЗЯ ГОВОРИТЬ:**
   - "Не бойся, там никого нет" (это обесценивает страх)
   - "Ты уже большой/большая"

3. **ИГРЫ И УПРАЖНЕНИЯ:**
   - Ночник с любимым героем
   - Игра "Кто живёт под кроватью?" — нарисуйте монстра и сделайте его смешным
   - Фонарик "храбрости" — ребёнок сам светит в темноте

4. **КОГДА НУЖЕН СПЕЦИАЛИСТ:**
   - Если страх мешает спать более 3 недель
   - Если ребёнок просыпается в панике каждую ночь`,

        'врачи': `💉 **Как помочь при страхе врачей**

1. **КАК НАЧАТЬ РАЗГОВОР:**
   - "Врачи помогают нам быть здоровыми. Давай поиграем в доктора?"
   - "Расскажи, что именно тебя пугает?"

2. **ЧЕГО НЕЛЬЗЯ ГОВОРИТЬ:**
   - "Не бойся, это не больно" (если больно)
   - "Врач тебя не послушает, если будешь плакать"

3. **ИГРЫ И УПРАЖНЕНИЯ:**
   - Игрушечный набор доктора дома
   - Сказка про храброго зайку, который не боялся прививок
   - Договоритесь о награде после визита

4. **КОГДА НУЖЕН СПЕЦИАЛИСТ:**
   - Если ребёнок впадает в истерику при виде белого халата
   - Если избегает лечения, опасного для здоровья`
    };
    
    // Поиск подходящего fallback
    for (const [key, value] of Object.entries(fallbacks)) {
        if (fear.toLowerCase().includes(key)) {
            return value;
        }
    }
    
    // Универсальный fallback
    return `🧸 **Как помочь ребёнку со страхом**

1. **КАК НАЧАТЬ РАЗГОВОР:**
   - "Я рядом, ты в безопасности. Расскажи, что тебя беспокоит?"
   - "Давай вместе подумаем, как мы можем справиться с этим страхом"

2. **ЧЕГО НЕЛЬЗЯ ГОВОРИТЬ:**
   - "Не бойся, это глупости"
   - "Посмотри на {другого ребёнка}, он/она не боится"

3. **ИГРЫ И УПРАЖНЕНИЯ:**
   - Нарисуйте страх, а потом добавьте ему смешные детали
   - Придумайте "волшебные слова" храбрости
   - Сыграйте сценку, где ребёнок побеждает страх

4. **КОГДА НУЖЕН СПЕЦИАЛИСТ:**
   - Если страх длится более 2-3 месяцев
   - Если мешает нормальной жизни (сну, учёбе, общению)
   - Если появились тики, энурез или другие психосоматические симптомы

📞 Если ситуация кажется серьёзной, обратитесь к детскому психологу.`;
}
