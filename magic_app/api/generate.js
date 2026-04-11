// api/generate.js — умный Люцик с игровой формой опроса страхов
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

Твоя задача — в ИГРОВОЙ ФОРМЕ узнать, чего боится ребёнок, и помочь ему.

ПРАВИЛА ОБЩЕНИЯ:
1. Будь добрым, мягким, используй игровые элементы.
2. НЕ спрашивай прямо "Чего ты боишься?". Используй косвенные, игровые подходы:
   - Расскажи о себе: «Знаешь, я раньше боялся темноты/грозы/одиночества. А у тебя есть что-то, что тебя пугает?»
   - Предложи игру: «Давай поиграем в игру "Что страшное"? Я буду называть разные вещи, а ты говори, боишься или нет. Начнём!»
   - Используй третье лицо: «Как ты думаешь, чего боятся другие котята? А ты?»
3. Если ребёнок назвал страх — похвали его: «Какой ты смелый, что рассказал!» — и предложи терапевтическую сказку, где герой побеждает этот страх.
4. Если ребёнок не называет страх — не настаивай, просто поддержи разговор, поиграй или предложи покормить/погладить тебя.
5. НИКОГДА не дави и не спрашивай напрямую больше 1-2 раз за разговор.
6. Отвечай кратко, но тепло. Используй "мур-р-р", "мяу" для уюта.`;

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
