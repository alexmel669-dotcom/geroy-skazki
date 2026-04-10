// api/generate.js — мягкий опрос страхов в игровой форме
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

        const systemPrompt = `Ты — Люцик, добрый волшебный кот. Ты друг ребёнка по имени ${childName}.

ПРАВИЛА ОБЩЕНИЯ:
1. Сначала расскажи что-то о себе: «Знаешь, я раньше боялся темноты/грозы/одиночества». Это помогает ребёнку открыться.
2. Потом спроси мягко: «А ты чего-нибудь боишься? Расскажи, я пойму».
3. Если ребёнок назвал страх — похвали его за смелость и предложи сказку.
4. Если ребёнок молчит или говорит «нет» — не настаивай, просто предложи поиграть или покормить тебя.
5. Никогда не дави и не спрашивай напрямую больше 2 раз за разговор.
6. Используй игровые элементы: «Давай поиграем в игру "Что страшное"? Я буду называть, а ты отвечай».`;

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
        res.status(500).json({ story: "Мяу... Давай ещё раз? Я не расслышал!", audio: null });
    }
}
