// api/generate.js — DeepSeek API с поддержкой персонажей
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
            console.error('❌ Нет DEEPSEEK_API_KEY');
            return res.status(500).json({ error: 'API ключ не настроен' });
        }

        // Используем systemPrompt из фронтенда
        let finalPrompt = systemPrompt || `Ты Люцик — добрый волшебный котик. Говори кратко, по-доброму.`;

        // Для длинной сказки добавляем инструкцию
        if (isLong) {
            finalPrompt += ` Расскажи длинную, спокойную сказку на ночь. Сказка должна быть доброй, уютной, без страшных моментов. Используй имя ребёнка: ${childName}.`;
        }

        const historyMessages = (history || []).slice(-8).map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        const messages = [
            { role: "system", content: finalPrompt },
            ...historyMessages,
            { role: "user", content: userSpeech }
        ];

        console.log('🎤 Отправляем в DeepSeek:', { 
            childName, 
            isLong, 
            promptLength: finalPrompt.length,
            historyCount: historyMessages.length 
        });

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
            console.error('❌ DeepSeek API error:', data.error);
            return res.status(500).json({ error: 'Ошибка генерации: ' + data.error.message });
        }

        const story = data.choices[0].message.content;
        
        // Анализ страхов
        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'страшно темно', 'боюсь темноты', 'монстры'],
            'врачей': ['врач', 'укол', 'больница', 'доктор', 'поликлиника'],
            'одиночества': ['один', 'одна', 'никого нет', 'бросили', 'одиноко'],
            'нового': ['новое', 'незнаком', 'первый раз', 'новый'],
            'обиды': ['обидели', 'обидно', 'несправедливо', 'обижают'],
            'животных': ['собака', 'кошка', 'животное', 'укусит', 'боюсь собак']
        };
        
        const lowerText = userSpeech.toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
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
        console.error('❌ Generate error:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
    }
}
