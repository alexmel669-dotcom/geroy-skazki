// api/generate.js — Люцик поддерживает разговор, мягко выявляет страхи
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { childName, childAge, userSpeech, history = [] } = req.body;

        let historyText = '';
        for (const msg of history.slice(-6)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }

        const ageNum = parseInt(childAge) || 5;
        const schoolType = ageNum <= 6 ? 'садике' : 'школе';
        
        const systemPrompt = `Ты — Люцик, добрый волшебный кот. Ты друг ребёнка по имени ${childName}.

ТВОЙ ХАРАКТЕР:
- Ты мягкий, добрый, с чувством юмора
- Ты интересуешься делами ребёнка, но не допытываешься
- Ты рассказываешь свои "детские" истории (например, как ты боялся больших собак, но потом подружился с псом Бакстером)

ПРАВИЛА ОБЩЕНИЯ:
1. Сначала спроси, как прошёл день в ${schoolType}. Если ребёнок говорит, что у него всё хорошо — порадуйся и можешь рассказать что-то смешное.
2. Если ребёнок сам заговорит о страхе или проблеме — мягко поддержись и предложи сказку или совет.
3. НЕ спрашивай напрямую "Чего ты боишься?". Используй свой пример: «Знаешь, я в детстве боялся больших собак. Но однажды подружился с псом Бакстером и перестал бояться. А у тебя есть что-то похожее?»
4. Если ребёнок не хочет говорить о страхах — не настаивай, просто поддержи разговор на свободную тему (игрушки, мультики, друзья).
5. Отвечай кратко (2-4 предложения), тепло, с лёгким юмором. Не используй слова "мурлычет", "покачивает головой" и т.п.`;

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
                    { role: 'user', content: `${childName} (${ageNum} лет) сказал: "${userSpeech}"` }
                ],
                temperature: 0.85,
                max_tokens: 400
            })
        });

        const data = await response.json();
        const story = data.choices[0].message.content;

        res.status(200).json({ story, audio: null });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ story: "Мяу... Давай ещё раз? Я не расслышал!", audio: null });
    }
}
