export default async function handler(req, res) {
    // Только POST запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { fear, childAge, childName } = req.body;
        
        // Валидация
        if (!fear || fear.trim() === '') {
            return res.status(400).json({ error: 'Укажите страх ребёнка' });
        }
        
        const age = parseInt(childAge) || 5;
        const name = childName || 'малыш';
        
        const prompt = `Ты — детский психолог с большим опытом. Родитель ребёнка ${name} (${age} лет) обращается за помощью. Ребёнок боится: "${fear}".

Дай родителю практический, тёплый и поддерживающий ответ. Используй ТОЧНО такую структуру:

1. КАК НАЧАТЬ РАЗГОВОР:
(2-3 мягкие фразы, которые родитель может сказать ребёнку прямо сейчас)

2. ЧЕГО НЕЛЬЗЯ ГОВОРИТЬ:
(2-3 фразы, которые могут навредить или усилить страх)

3. ИГРЫ И УПРАЖНЕНИЯ ДЛЯ ДОМА:
(2-3 простых, конкретных игры или задания, которые помогут победить страх)

4. КОГДА НУЖЕН СПЕЦИАЛИСТ:
(Чёткие признаки, что пора обратиться к психологу)

Отвечай тёплым, заботливым тоном. Без воды, без общих фраз. Пиши на русском языке.`;

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
                        content: 'Ты — добрый, мудрый детский психолог. Твои советы помогают родителям и детям. Отвечай структурированно, тепло и по делу.' 
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('DeepSeek API error:', data);
            return res.status(500).json({ error: 'Ошибка генерации совета' });
        }
        
        const advice = data.choices[0].message.content;
        
        res.status(200).json({ advice, fear });
        
    } catch (error) {
        console.error('Ошибка в parent-advice:', error);
        res.status(500).json({ 
            error: 'Сервер временно недоступен. Попробуйте позже.',
            advice: '🌙 Попробуйте обнять ребёнка и сказать: "Я рядом, мы справимся вместе". А завтра я подготовлю для вас подробный совет.'
        });
    }
}
