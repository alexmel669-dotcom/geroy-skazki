// api/parent-advice.js — Советы психолога через DeepSeek V4 Pro
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

        const { fear, childAge, childName } = req.body;
        
        if (!fear || fear.trim() === '') {
            return res.status(400).json({ error: 'Укажите страх ребёнка' });
        }
        
        const age = parseInt(childAge) || 5;
        const name = childName || 'малыш';
        
        const prompt = `Ты — детский психолог. Родитель ребёнка ${name} (${age} лет) обращается за помощью. Ребёнок боится: "${fear}".

Дай родителю практический, тёплый ответ. Используй структуру:

1. КАК НАЧАТЬ РАЗГОВОР: (2-3 мягкие фразы)
2. ЧЕГО НЕЛЬЗЯ ГОВОРИТЬ: (2-3 фразы)
3. ИГРЫ И УПРАЖНЕНИЯ: (2-3 конкретных задания)
4. КОГДА НУЖЕН СПЕЦИАЛИСТ: (чёткие признаки)

Отвечай тёплым тоном. Пиши на русском.`;

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                // ИСПРАВЛЕНО: новое имя модели
                model: 'deepseek-v4-flash',
                messages: [
                    { role: 'system', content: 'Ты — добрый детский психолог. Отвечай структурированно, тепло.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 800
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
            error: 'Сервер временно недоступен',
            advice: '🌙 Попробуйте обнять ребёнка и сказать: "Я рядом, мы справимся вместе".'
        });
    }
}
