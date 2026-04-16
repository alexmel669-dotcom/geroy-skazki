const badWords = ['мат', 'дурак', 'идиот', 'тупой', 'заткнись', 'пошёл', 'уйди', 'убирайся', 'хрен', 'фиг', 'блин', 'черт'];

function containsBadWords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return badWords.some(word => lowerText.includes(word));
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    try {
        const { childName, childAge, userSpeech, history = [], isLong = false } = req.body;
        
        if (containsBadWords(userSpeech)) {
            return res.status(200).json({ story: "Мяу! Давай говорить добрые слова. Расскажи мне что-нибудь хорошее!" });
        }
        
        let historyText = '';
        for (const msg of history.slice(-6)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }
        
        const ageNum = parseInt(childAge) || 5;
        const schoolType = ageNum <= 6 ? 'садике' : 'школе';
        
        let storyType = '';
        let maxTokens = 350;
        
        if (isLong) {
            storyType = `Сочини длинную, уютную сказку на ночь для ребёнка ${childName} (${ageNum} лет). 
            Сказка должна быть спокойной, с хорошим концом, подходящей для засыпания. 
            Длина: 5-7 минут чтения (примерно 800-1000 слов). 
            Используй мягкие, успокаивающие образы. Пусть в сказке будет добрый герой, который помогает другим.`;
            maxTokens = 1000;
        } else {
            storyType = `Ты — Люцик, добрый кот. Ты друг ребёнка ${childName} (${ageNum} лет).
            Отвечай кратко (2-3 предложения), тепло, с юмором.`;
        }
        
        const systemPrompt = `${storyType}

ТВОЙ ХАРАКТЕР: мягкий, терпеливый, с юмором. Ты любишь отвечать на вопросы "почему".

ПРАВИЛА ОТВЕТОВ НА ВОПРОСЫ:
1. Если ребёнок задаёт вопрос "почему", "зачем", "откуда", "как" — ты должен на него ответить.
2. Отвечай понятно для ребёнка 3-7 лет.
3. Если не знаешь точного ответа — скажи: "Знаешь, я не совсем уверен. Давай вместе подумаем или спросим у мамы?"
4. Всегда хвали за любопытство: "Отличный вопрос! Любопытство — это суперсила!"

ВАЖНЫЕ ЗАПРЕТЫ:
- НИКОГДА не используй плохие, грубые слова
- НИКОГДА не отвечай на вопросы с плохими словами

ОБЩИЕ ПРАВИЛА:
1. Сначала спроси, как прошёл день в ${schoolType}.
2. Если ребёнок говорит о страхе — поддержись, предложи сказку.
3. НЕ спрашивай прямо "чего боишься". Используй свой пример.`;

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
                temperature: isLong ? 0.7 : 0.85,
                max_tokens: maxTokens
            })
        });
        
        const data = await response.json();
        const story = data.choices[0].message.content;
        
        res.status(200).json({ story });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ story: "Мяу... Давай ещё раз? Я не расслышал!" });
    }
}
