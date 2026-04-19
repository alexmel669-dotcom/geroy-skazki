const badWords = ['мат', 'дурак', 'идиот', 'тупой', 'заткнись', 'пошёл', 'уйди', 'убирайся', 'хрен', 'фиг', 'блин', 'черт'];

function containsBadWords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return badWords.some(word => lowerText.includes(word));
}

function withTimeout(promise, ms, timeoutError = new Error('Request timed out')) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(timeoutError), ms);
        promise.then(
            (result) => {
                clearTimeout(timeoutId);
                resolve(result);
            },
            (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        );
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    try {
        const { childName, childAge, userSpeech, history = [], isLong = false } = req.body;
        
        if (containsBadWords(userSpeech)) {
            return res.status(200).json({ story: "Мяу! Давай говорить добрые слова. Расскажи мне что-нибудь хорошее!" });
        }
        
        const ageNum = parseInt(childAge) || 5;
        const schoolType = ageNum <= 6 ? 'садике' : 'школе';
        
        // Упрощённый промпт
        let systemPrompt = `Ты — Люцик, добрый кот-друг для ребёнка ${childName} (${ageNum} лет). 

Твои правила:
1. Отвечай кратко, 1-2 предложения.
2. Говори тепло и с юмором.
3. Если ребёнок говорит о страхе — поддержись: "Я понимаю, это нормально. Расскажи подробнее?"
4. Не спрашивай прямо "чего ты боишься".
5. Начинай разговор с вопроса: "Как прошёл день в ${schoolType}?"

Будь мягким, заботливым другом.`;

        if (isLong) {
            systemPrompt = `Сочини короткую, уютную сказку на ночь для ребёнка ${childName} (${ageNum} лет). 
Сказка должна быть доброй, спокойной, с хорошим концом. Длина: 2-3 минуты чтения.`;
        }
        
        // Формируем историю
        let historyText = '';
        for (const msg of (history || []).slice(-6)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }
        
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: historyText },
            { role: 'user', content: `${childName} сказал: "${userSpeech}"` }
        ];
        
        const deepseekPromise = fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: isLong ? 0.7 : 0.85,
                max_tokens: isLong ? 800 : 200
            })
        });
        
        let data;
        try {
            const response = await withTimeout(deepseekPromise, 45000);
            data = await response.json();
        } catch (timeoutError) {
            console.error('DeepSeek timeout after 45s');
            return res.status(200).json({ 
                story: "Мурр... Я немного задумался. Расскажи ещё раз, я внимательно слушаю!" 
            });
        }
        
        const story = data.choices?.[0]?.message?.content || "Мяу! Давай ещё раз?";
        
        // Определяем страх
        let detectedFear = null;
        const fearKeywords = {
            темноты: ['темнот', 'ночь', 'монстр', 'страшн', 'спать'],
            врачей: ['укол', 'врач', 'больниц', 'болит', 'доктор'],
            одиночества: ['один', 'без мам', 'без пап', 'одна', 'никого'],
            нового: ['новый', 'первый раз', 'незнаком'],
            животных: ['собака', 'кошка', 'паук', 'змея', 'боюсь']
        };
        
        const lowerSpeech = userSpeech.toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(k => lowerSpeech.includes(k))) {
                detectedFear = fear;
                break;
            }
        }
        
        res.status(200).json({ story, detectedFear });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(200).json({ story: "Мяу... Давай ещё раз? Я не расслышал!" });
    }
}
