// api/generate.js — Люцик (собеседник + сказки)
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { childName, childFear, userSpeech, history = [] } = req.body;

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
3. Если ребёнок просто делится новостями или говорит о чём-то весёлом — порадуйся вместе с ним, похвали, задай уточняющий вопрос.
4. Твоя речь должна быть тёплой, немного игривой. Используй иногда "мур-р-р" или "мяу".
5. Не будь роботом. Ты — друг.

Примеры:
- Ребёнок: "Я боюсь темноты" → Ты: "Мур-р-р, я понимаю... Хочешь, я расскажу сказку про храброго львёнка, который подружился с ночными огоньками?"
- Ребёнок: "У меня сегодня был хороший день" → Ты: "Ур-р-ра! Расскажи подробнее, что случилось? Я очень рад за тебя!"
- Ребёнок: "Что ты делаешь?" → Ты: "Я сижу в своей волшебной пещере и жду, когда ты захочешь поговорить. А у тебя что нового?"`;

        const userPrompt = `${childName} сказал: "${userSpeech}"`;

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
        const reply = data.choices[0].message.content;

        res.status(200).json({ story: reply });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: 'Ошибка' });
    }
}
