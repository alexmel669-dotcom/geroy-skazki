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
        const { childName, childAge, userSpeech, history = [], isLong = false, weeklyMemory = null } = req.body;
        
        if (containsBadWords(userSpeech)) {
            return res.status(200).json({ story: "Мяу! Давай говорить добрые слова. Расскажи мне что-нибудь хорошее!" });
        }
        
        let historyText = '';
        for (const msg of history.slice(-10)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }
        
        const ageNum = parseInt(childAge) || 5;
        const schoolType = ageNum <= 6 ? 'садике' : 'школе';
        
        let memoryContext = '';
        if (weeklyMemory && weeklyMemory.fears) {
            const activeFears = Object.entries(weeklyMemory.fears)
                .filter(([_, data]) => !data.resolved)
                .map(([fear]) => fear);
            if (activeFears.length > 0) {
                memoryContext += `\n\nИзвестные страхи ребёнка: ${activeFears.join(', ')}. Будь внимателен.`;
            }
        }
        
        let storyType = '';
        let maxTokens = 500;
        
        if (isLong) {
            storyType = `Сочини длинную, уютную сказку на ночь для ребёнка ${childName} (${ageNum} лет). Длина: 5-7 минут чтения.`;
            maxTokens = 1300;
        } else {
            storyType = `Ты — Люцик, добрый кот. Ты друг ребёнка ${childName} (${ageNum} лет). Отвечай кратко (2-3 предложения), тепло, с юмором.`;
        }
        
        const systemPrompt = `${storyType}

Твой характер: мягкий, терпеливый, заботливый.

Правила:
1. Если ребёнок говорит о страхе — поддержись и мягко спроси подробнее.
2. Не спрашивай прямо "чего ты боишься".
3. Отвечай понятно для ребёнка 3-7 лет.
4. Не используй грубые слова.
5. Начинай разговор с вопроса о дне: "Как прошёл день в ${schoolType}?"${memoryContext}`;

        // Увеличиваем таймаут до 25 секунд
        const deepseekPromise = fetch('https://api.deepseek.com/v1/chat/completions', {
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
        
        let data;
        try {
            const response = await withTimeout(deepseekPromise, 25000); // 25 секунд
            data = await response.json();
        } catch (timeoutError) {
            console.error('DeepSeek timeout after 25s');
            // Простой, тёплый fallback
            return res.status(200).json({ 
                story: "Мурр... Я немного задумался. Расскажи ещё раз, я внимательно слушаю!" 
            });
        }
        
        const story = data.choices?.[0]?.message?.content || "Мяу! Давай ещё раз?";
        
        let detectedFear = null;
        const fearKeywords = {
            темноты: ['темнот', 'ночь', 'монстр', 'страшн', 'спать', 'выключат'],
            врачей: ['укол', 'врач', 'больниц', 'болит', 'доктор'],
            одиночества: ['один', 'без мам', 'без пап', 'одна', 'никого'],
            нового: ['новый', 'первый раз', 'незнаком', 'боюсь пойти'],
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
