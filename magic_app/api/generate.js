// api/generate.js
export default async function handler(req, res) {
    // Только POST запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { 
            childName, 
            childAge, 
            userSpeech, 
            isLong, 
            history = [], 
            weeklyMemory,
            systemPrompt 
        } = req.body;

        // Проверка авторизации (опционально, если нужен JWT)
        const token = req.headers.authorization?.split(' ')[1];
        let userEmail = null;
        
        if (token) {
            try {
                const jwt = await import('jsonwebtoken');
                const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
                userEmail = decoded.email;
            } catch (e) {
                // Гостевой режим — продолжаем без email
            }
        }

        // Формируем промпт для DeepSeek
        const baseSystemPrompt = systemPrompt || `Ты Люцик — дружелюбный волшебный котик. Ты помогаешь ребёнку ${childName}, ${childAge} лет, чувствовать себя смелее.`;
        
        const fullPrompt = `${baseSystemPrompt}
        
Ребёнок сказал: "${userSpeech}"

${isLong ? 'Расскажи длинную, спокойную сказку на ночь (примерно 300-500 слов).' : 'Ответь кратко, по-доброму, 1-3 предложения. Используй имя ребёнка.'}

${history.length > 0 ? 'Предыдущий диалог:\n' + history.map(m => `${m.role}: ${m.content}`).join('\n') : ''}`;

        // Вызов DeepSeek API
        const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: baseSystemPrompt },
                    ...history,
                    { role: 'user', content: userSpeech }
                ],
                max_tokens: isLong ? 800 : 150,
                temperature: 0.7
            })
        });

        if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            console.error('DeepSeek API error:', deepseekResponse.status, errorText);
            throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
        }

        const data = await deepseekResponse.json();
        const story = data.choices[0]?.message?.content || 'Мурр... Я задумался. Давай ещё раз?';

        // Определение страха из текста
        let detectedFear = null;
        const lowerSpeech = userSpeech.toLowerCase();
        const lowerStory = story.toLowerCase();
        
        const fearKeywords = {
            'темноты': ['темно', 'темнота', 'боюсь темно'],
            'врачей': ['врач', 'укол', 'больница', 'доктор'],
            'одиночества': ['один', 'скучно', 'никого'],
            'нового': ['новое', 'незнаком', 'первый раз'],
            'обиды': ['обид', 'грустно', 'плакать'],
            'животных': ['собака', 'кошка', 'животн', 'монстр']
        };

        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(kw => lowerSpeech.includes(kw) || lowerStory.includes(kw))) {
                detectedFear = fear;
                break;
            }
        }

        // Сохраняем аналитику в БД (если есть подключение)
        if (userEmail && process.env.POSTGRES_URL) {
            try {
                const { sql } = await import('@vercel/postgres');
                await sql`
                    INSERT INTO analytics (event_type, user_email, child_name, child_age, event_data)
                    VALUES ('story_generated', ${userEmail}, ${childName}, ${childAge}, ${JSON.stringify({
                        fear: detectedFear,
                        speechLength: userSpeech.length,
                        storyLength: story.length,
                        isLong
                    })})
                `;
            } catch (dbError) {
                console.error('DB error (non-critical):', dbError);
            }
        }

        return res.status(200).json({
            story,
            detectedFear,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Generate API error:', error);
        return res.status(500).json({ 
            error: 'Ошибка генерации',
            story: 'Мурр... Что-то пошло не так. Давай попробуем ещё раз?',
            detectedFear: null
        });
    }
}
