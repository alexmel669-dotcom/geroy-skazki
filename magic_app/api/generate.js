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
            systemPrompt
        } = req.body;

        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            console.error('❌ Нет DEEPSEEK_API_KEY');
            return res.status(200).json({ 
                story: "Мурр... Что-то я задумался. Давай ещё раз?",
                detectedFear: null
            });
        }

        let finalPrompt = systemPrompt || `Ты Люцик — добрый волшебный котик. Говори кратко, по-доброму.`;

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
            return res.status(200).json({ 
                story: "Мурр... Я немного устал. Давай поиграем?",
                detectedFear: null
            });
        }

        let story = data.choices?.[0]?.message?.content || "Мурр... Я тебя слушаю!";
        
        // Убираем цифры из начала ответа
        story = story.replace(/^\d+\s*/, '').trim();
        
        if (!story || story.length === 0) {
            story = "Мурр... Я тебя слушаю! Расскажи ещё что-нибудь?";
        }
        
        console.log('✅ Ответ:', story.substring(0, 100));

        // Анализ страхов
        let detectedFear = null;
        const fearKeywords = {
            'темноты': ['темнот', 'боюсь темноты', 'монстры', 'страшно темно'],
            'врачей': ['врач', 'укол', 'больница', 'доктор'],
            'одиночества': ['один', 'одна', 'никого нет', 'бросили'],
            'обиды': ['обидели', 'обидно', 'несправедливо'],
            'нового': ['новое', 'незнаком', 'первый раз'],
            'животных': ['собака', 'кошка', 'боюсь собак', 'укусит']
        };
        
        const lowerText = (userSpeech || '').toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerText.includes(kw))) {
                detectedFear = fear;
                break;
            }
        }
        
        res.status(200).json({ 
            story: story,
            detectedFear: detectedFear
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        res.status(200).json({ 
            story: "Мурр... Что-то пошло не так. Давай ещё раз?",
            detectedFear: null
        });
    }
}
