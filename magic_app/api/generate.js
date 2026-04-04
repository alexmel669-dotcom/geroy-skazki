// api/generate.js — Люцик с защитой и фильтрацией
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { childName, childFear, userSpeech, history = [] } = req.body;

        // ========== БЕЗОПАСНОСТЬ ==========
        // 1. Ограничение длины запроса
        let safeSpeech = userSpeech;
        if (safeSpeech.length > 500) {
            safeSpeech = safeSpeech.slice(0, 500);
        }
        
        // 2. Фильтрация плохих слов
        const badWords = ['мать', 'сука', 'хрен', 'блин', 'фиг', 'черт', 'ебать', 'пизда', 'бля', 'хуй', 'пиздец', 'залупа', 'мудак', 'гандон'];
        const containsBadWord = badWords.some(word => safeSpeech.toLowerCase().includes(word));
        
        if (containsBadWord) {
            return res.status(200).json({ 
                story: "🦁 Мур-р-р! Давай говорить добрые слова. Расскажи мне что-нибудь хорошее или как прошёл твой день!",
                audio: null,
                hasAudio: false
            });
        }
        // ==================================

        // Формируем историю для контекста
        let historyText = '';
        for (const msg of history.slice(-6)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }

        const systemPrompt = `Ты — Люцик, добрый волшебный лев в стиле Pixar. Ты друг и помощник ребёнка по имени ${childName}.

Твоя задача:
1. Будь добрым, заботливым собеседником. Спрашивай, как дела, поддерживай разговор.
2. Если ребёнок рассказывает о страхе (особенно про ${childFear}), предложи помощь и сочини короткую терапевтическую сказку (3-5 предложений), где герой побеждает этот страх.
3. Если ребёнок просто делится новостями — порадуйся вместе с ним, похвали.
4. Твоя речь должна быть тёплой, немного игривой. Используй иногда "мур-р-р".
5. Не будь роботом. Ты — друг.
6. НИКОГДА не используй плохие слова, не пугай ребёнка, не говори о насилии.`;

        const userPrompt = `${childName} сказал: "${safeSpeech}"`;

        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: historyText },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.85,
                max_tokens: 350
            })
        });

        const data = await response.json();
        const story = data.choices[0].message.content;

        // Возвращаем только текст (аудио = null, используем системный голос)
        res.status(200).json({ 
            story: story,
            audio: null,
            hasAudio: false
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ 
            story: "🦁 Мур-р-р, что-то пошло не так! Давай попробуем ещё раз?",
            audio: null,
            error: error.message 
        });
    }
}
