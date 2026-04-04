// api/generate.js — без "мур-р-р" в ответах
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { childName, userSpeech, history = [] } = req.body;

        let historyText = '';
        for (const msg of history.slice(-6)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }

        const systemPrompt = `Ты — Люцик, добрый волшебный лев. Ты друг ребёнка ${childName}. Будь добрым, поддерживай разговор. Если ребёнок говорит о страхе — сочини короткую сказку (3-5 предложений).`;

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
                temperature: 0.85,
                max_tokens: 350
            })
        });

        const data = await response.json();
        const story = data.choices[0].message.content;

        // Возвращаем только текст (голос системный)
        res.status(200).json({ 
            story: story,
            audio: null
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ 
            story: "🦁 Давай ещё раз? Я не расслышал!",
            audio: null
        });
    }
}
