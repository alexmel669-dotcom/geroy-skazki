export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    try {
        const { childName, childAge, userSpeech, history = [] } = req.body;
        let historyText = '';
        for (const msg of history.slice(-6)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }
        const ageNum = parseInt(childAge) || 5;
        const schoolType = ageNum <= 6 ? 'садике' : 'школе';
        const systemPrompt = `Ты — Люцик, добрый кот. Друг ребёнка ${childName} (${ageNum} лет). Будь мягким, с юмором. Сначала спроси, как прошёл день в ${schoolType}. Если ребёнок говорит о страхе — поддержись, предложи сказку. НЕ спрашивай прямо "чего боишься". Отвечай кратко (2-3 предложения).`;
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: historyText },
                    { role: 'user', content: `${childName} сказал: "${userSpeech}"` }
                ],
                temperature: 0.85,
                max_tokens: 300
            })
        });
        const data = await response.json();
        res.status(200).json({ story: data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ story: "Мяу... Давай ещё раз?" });
    }
}
