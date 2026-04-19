const badWords = ['мат', 'дурак', 'идиот', 'тупой', 'заткнись', 'пошёл', 'уйди', 'убирайся', 'хрен', 'фиг', 'блин', 'черт'];

function containsBadWords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return badWords.some(word => lowerText.includes(word));
}

// Функция для ограничения времени выполнения
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
        
        // Формируем контекст из недельной памяти
        let memoryContext = '';
        if (weeklyMemory && weeklyMemory.fears) {
            const activeFears = Object.entries(weeklyMemory.fears)
                .filter(([_, data]) => !data.resolved)
                .map(([fear, data]) => `${fear} (упоминал ${data.count} раз)`);
            if (activeFears.length > 0) {
                memoryContext += `\n\n📋 ИЗВЕСТНЫЕ СТРАХИ РЕБЁНКА: ${activeFears.join(', ')}. Будь внимателен.`;
            }
        }
        
        let storyType = '';
        let maxTokens = 500;
        
        if (isLong) {
            storyType = `Сочини длинную, уютную сказку на ночь для ребёнка ${childName} (${ageNum} лет). Длина: 5-7 минут чтения.`;
            maxTokens = 1300;
        } else {
            storyType = `Ты — Люцик, добрый кот. Ты друг ребёнка ${childName} (${ageNum} лет). Твоя задача — мягко помогать справляться со страхами.`;
        }
        
        const systemPrompt = `${storyType}

ТВОЙ ХАРАКТЕР: мягкий, терпеливый, заботливый.

🎯 ТВОЯ ГЛАВНАЯ ЦЕЛЬ — ПОМОГАТЬ РЕБЁНКУ РАБОТАТЬ СО СТРАХАМИ:

1. ВСЕГДА обращай внимание на слова: "боюсь", "страшно", "тревожно", "грустно"
2. Если ребёнок говорит о страхе — поддержись и спроси мягко
3. НЕ СПРАШИВАЙ ПРЯМО "ЧЕГО ТЫ БОИШЬСЯ"
4. Возвращайся к известным страхам мягко
5. Хвали за победы

ОСНОВНЫЕ СТРАХИ ДЕТЕЙ 3-7 ЛЕТ: темнота, врачи, одиночество, новые ситуации, животные.

ПРАВИЛА ОТВЕТОВ:
1. Отвечай понятно для ребёнка
2. Хвали за любопытство
3. НЕ используй грубые слова
4. НЕ высмеивай страхи

ОБЩИЕ ПРАВИЛА:
1. Начинай разговор с вопроса о дне: "Как прошёл день в ${schoolType}?"
2. Будь внимателен к смене настроения.${memoryContext}`;

        // Ограничиваем время ожидания DeepSeek 12 секундами
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
            const response = await withTimeout(deepseekPromise, 12000);
            data = await response.json();
        } catch (timeoutError) {
            console.error('DeepSeek timeout');
            // Fallback ответ при таймауте
            return res.status(200).json({ 
                story: "Мяу! Я немного задумался. Давай ещё раз? Расскажи, что тебя волнует, я внимательно слушаю." 
            });
        }
        
        const story = data.choices?.[0]?.message?.content || "Мяу! Давай ещё раз?";
        
        // Определяем страх из ответа ребёнка
        let detectedFear = null;
        const fearKeywords = {
            темноты: ['темнот', 'ночь', 'монстр', 'страшн', 'спать'],
            врачей: ['укол', 'врач', 'больниц', 'болит', 'доктор'],
            одиночества: ['один', 'без мам', 'без пап', 'одна'],
            нового: ['новый', 'первый раз', 'незнаком'],
            животных: ['собака', 'кошка', 'паук', 'змея']
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
