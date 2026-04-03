// api/generate.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { childName, childFear, userSpeech } = req.body;

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
                        content: `Ты — Лёва, добрый лев в стиле Pixar. Ты помогаешь детям 3-7 лет справляться со страхами. Ребёнка зовут ${childName}. Его страх: ${childFear}. Сочини короткую терапевтическую сказку (3-5 предложений), где герой побеждает этот страх. Тон: добрый, поддерживающий. Закончи вопросом или ободрением.`
                    },
                    { role: 'user', content: `Ребёнок сказал: "${userSpeech}"` }
                ],
                temperature: 0.8,
                max_tokens: 350
            })
        });

        const data = await response.json();
        const story = data.choices[0].message.content;

        res.status(200).json({ story });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: 'Ошибка' });
    }
}
