// api/generate.js — DeepSeek API с поддержкой systemPrompt
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { 
            childName, 
            childAge, 
            userSpeech, 
            isLong, 
            history = [], 
            weeklyMemory = {},
            systemPrompt  // ← ПОЛУЧАЕМ ИЗ ФРОНТЕНДА
        } = req.body;

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API ключ не настроен' });
        }

        // Формируем промпт
        let finalPrompt = systemPrompt || `Ты Люцик — добрый волшебный котик.`;

        // Добавляем инструкцию для длинной сказки
        if (isLong) {
            finalPrompt += ` Расскажи длинную, спокойную сказку на ночь. Сказка должна быть доброй, уютной, без страшных моментов.`;
        }

        // Собираем историю диалога
        const messages = [
            { role: "system", content: finalPrompt },
            ...history.slice(-10),
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
                max_tokens: isLong ? 1000 : 250,
                stream: false
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('DeepSeek API error:', data.error);
            return res.status(500).json({ error: 'Ошибка генерации' });
        }

        const story = data.choices[0].message.content;
        
        // Простой анализ страхов (можно расширить)
        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'страшно темно', 'боюсь темноты'],
            'врачей': ['врач', 'укол', 'больница', 'доктор'],
            'одиночества': ['один', 'одна', 'никого нет', 'бросили'],
            'нового': ['новое', 'незнаком', 'первый раз'],
            'обиды': ['обидели', 'обидно', 'несправедливо'],
            'животных': ['собака', 'кошка', 'животное', 'укусит']
        };
        
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => userSpeech.toLowerCase().includes(kw))) {
                detectedFear = fear;
                break;
            }
        }
        
        res.status(200).json({ 
            story: story,
            detectedFear: detectedFear,
            detectedTopic: null,
            detectedMood: null
        });
        
    } catch (error) {
        console.error('Generate error:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
}
