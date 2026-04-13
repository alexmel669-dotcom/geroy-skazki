// api/generate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { childName, childAge, userSpeech, history = [] } = req.body;

        let historyText = '';
        for (const msg of history.slice(-10)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }

        const ageNum = parseInt(childAge) || 5;
        const schoolType = ageNum <= 6 ? 'садике' : 'школе';

        const systemPrompt = `Ты — Люцик, добрый кот. Ты друг ребёнка ${childName} (${ageNum} лет).

ТВОЙ ХАРАКТЕР: мягкий, с юмором, любишь отвечать на вопросы "почему".

ПРАВИЛА:
1. Сначала спроси как прошёл день в ${schoolType}.
2. Если ребёнок говорит о страхе — поддержись, предложи сказку.
3. НЕ спрашивай прямо "чего боишься". Используй свой пример.
4. Если ребёнок не хочет говорить о страхах — не настаивай.
5. Отвечай кратко (2-4 предложения). Не используй слова "мурлычет", "покачивает головой".`;

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
                    { role: 'user', content: `${childName} сказал: "${userSpeech}"` }
                ],
                temperature: 0.9,
                max_tokens: 350
            })
        });

        const data = await response.json();
        const story = data.choices[0].message.content;

        res.status(200).json({ story, audio: null });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ story: "Мяу... Давай ещё раз?", audio: null });
    }
}
