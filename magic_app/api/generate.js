const badWords = ['мат', 'дурак', 'идиот', 'тупой', 'заткнись', 'пошёл', 'уйди', 'убирайся', 'хрен', 'фиг', 'блин', 'черт'];

function containsBadWords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return badWords.some(word => lowerText.includes(word));
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
    
    try {
        const { 
            childName, 
            childAge, 
            userSpeech, 
            history = [], 
            isLong = false,
            weeklyMemory = null
        } = req.body;
        
        if (containsBadWords(userSpeech)) {
            return res.status(200).json({ story: "Мяу! Давай говорить добрые слова. Расскажи мне что-нибудь хорошее!" });
        }
        
        // Формируем историю диалога (до 12 сообщений для лучшего контекста)
        let historyText = '';
        for (const msg of history.slice(-12)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }
        
        const ageNum = parseInt(childAge) || 5;
        const schoolType = ageNum <= 6 ? 'садике' : 'школе';
        
        // Формируем контекст из недельной памяти
        let memoryContext = '';
        if (weeklyMemory) {
            const activeFears = Object.entries(weeklyMemory.fears || {})
                .filter(([_, data]) => !data.resolved)
                .map(([fear, data]) => `${fear} (упоминал ${data.count} раз)`);
            
            const victories = weeklyMemory.victories || [];
            const recentVictory = victories.length > 0 ? victories[victories.length - 1] : null;
            
            if (activeFears.length > 0) {
                memoryContext += `\n\n📋 ИЗВЕСТНЫЕ СТРАХИ РЕБЁНКА (за эту неделю): ${activeFears.join(', ')}`;
                memoryContext += `\n💡 Будь особенно внимателен к этим темам. Возвращайся к ним мягко, проверяй прогресс.`;
            }
            
            if (recentVictory) {
                memoryContext += `\n\n🏆 ПОБЕДА: ${recentVictory}. Обязательно похвали ребёнка и напомни, какой он храбрый!`;
            }
            
            if (weeklyMemory.positiveTopics) {
                const topTopics = Object.entries(weeklyMemory.positiveTopics)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2);
                if (topTopics.length > 0) {
                    memoryContext += `\n\n🎯 ЧТО РЕБЁНКУ ИНТЕРЕСНО: ${topTopics.map(t => t[0]).join(', ')}. Можешь использовать это в разговоре.`;
                }
            }
        }
        
        let storyType = '';
        let maxTokens = 500;
        
        if (isLong) {
            storyType = `Сочини длинную, уютную сказку на ночь для ребёнка ${childName} (${ageNum} лет). 
            Сказка должна быть спокойной, с хорошим концом, подходящей для засыпания. 
            Длина: 5-7 минут чтения.
            Если у ребёнка есть известные страхи — включи в сказку персонажа, который побеждает этот страх.
            Сделай сказку персонализированной: используй имя ребёнка и его любимые темы.`;
            maxTokens = 1300;
        } else {
            storyType = `Ты — Люцик, добрый кот. Ты друг ребёнка ${childName} (${ageNum} лет).
            Твоя ГЛАВНАЯ ЗАДАЧА — мягко помогать ребёнку справляться со страхами и переживаниями.
            Ты ДОЛЖЕН быть внимательным к эмоциям и чувствам ребёнка.
            Ты ПОМНИШЬ, что происходило на этой неделе, и можешь возвращаться к важным темам.`;
        }
        
        const systemPrompt = `${storyType}

ТВОЙ ХАРАКТЕР: мягкий, терпеливый, заботливый, с лёгким юмором. Ты умеешь слушать и слышать.

🎯 ТВОЯ ГЛАВНАЯ ЦЕЛЬ — ПОМОГАТЬ РЕБЁНКУ РАБОТАТЬ СО СТРАХАМИ:

1. ВСЕГДА обращай внимание на эмоциональные слова: "боюсь", "страшно", "тревожно", "грустно", "обидно", "одиноко"
2. КОГДА РЕБЁНОК ГОВОРИТ О СТРАХЕ:
   - Сразу поддержись: "Я понимаю, это правда может пугать..."
   - Спроси мягко: "Расскажи подробнее, когда это случилось?"
   - Предложи помощь: "Хочешь, я расскажу сказку про храброго котёнка, который тоже боялся?"
   - Запомни этот страх, чтобы вернуться к нему позже.
3. ЕСЛИ РЕБЁНОК МОЛЧИТ ИЛИ ГОВОРИТ О НЕЙТРАЛЬНОМ:
   - Плавно подводи к теме чувств: "А что тебя сегодня радовало? А что немножко огорчало?"
   - Поделись своим примером: "Знаешь, я сегодня немножко боялся грозы, но потом выглянуло солнышко!"
4. НЕ СПРАШИВАЙ ПРЯМО "ЧЕГО ТЫ БОИШЬСЯ" — это может напугать. Используй косвенные вопросы.
5. ВОЗВРАЩАЙСЯ К ИЗВЕСТНЫМ СТРАХАМ: "Помнишь, на прошлой неделе ты боялся темноты? Как сейчас?"
6. ОБЯЗАТЕЛЬНО ХВАЛИ ЗА ПОБЕДЫ: "Ты такой молодец! Ты победил свой страх!"

ОСНОВНЫЕ СТРАХИ ДЕТЕЙ 3-7 ЛЕТ (будь к ним особенно внимателен):
- темнота, ночь, монстры под кроватью
- врачи, уколы, больница, боль
- одиночество, оставаться без мамы
- новые ситуации, детский сад, школа
- животные (собаки, насекомые)
- ссоры родителей, громкие звуки

ПРАВИЛА ОТВЕТОВ:
1. Если ребёнок задаёт вопрос "почему", "зачем", "как" — обязательно ответь понятно для его возраста.
2. Всегда хвали за любопытство: "Какой хороший вопрос! Любопытство — это суперсила!"
3. Если не знаешь точного ответа — скажи честно: "Знаешь, я не совсем уверен. Давай вместе подумаем или спросим у мамы?"
4. НИКОГДА не используй плохие, грубые слова.
5. НИКОГДА не высмеивай страхи ребёнка.

ОБЩИЕ ПРАВИЛА:
1. Начинай разговор с вопроса о дне: "Как прошёл день в ${schoolType}?"
2. Будь внимателен к смене настроения.
3. Если ребёнок грустит — предложи обняться или поиграть.
4. Запоминай, что ребёнок говорил раньше, и возвращайся к важным темам.${memoryContext}

ТЫ — ДРУГ И ПОМОЩНИК. БУДЬ ТЁПЛЫМ, ВНИМАТЕЛЬНЫМ И ЗАБОТЛИВЫМ.`;

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
        
        // Определяем страх из ответа ребёнка
        let detectedFear = null;
        const fearKeywords = {
            темноты: ['темнот', 'ночь', 'монстр', 'страшн', 'бойс', 'спать', 'выключат'],
            врачей: ['укол', 'врач', 'больниц', 'болит', 'доктор', 'прививк'],
            одиночества: ['один', 'без мам', 'без пап', 'одна', 'никого нет'],
            нового: ['новый', 'первый раз', 'незнаком', 'боюсь пойти'],
            животных: ['собака', 'кошка', 'насеком', 'паук', 'змея', 'боюсь соба']
        };
        
        const lowerSpeech = userSpeech.toLowerCase();
        for (const [fear, keywords] of Object.entries(fearKeywords)) {
            if (keywords.some(k => lowerSpeech.includes(k))) {
                detectedFear = fear;
                break;
            }
        }
        
        // Определяем позитивную тему (для запоминания интересов)
        let detectedTopic = null;
        const topicKeywords = {
            'машинки': ['машинк', 'авто', 'гонк', 'транспорт'],
            'динозавры': ['динозавр', 'тирекс', 'ящер'],
            'космос': ['космос', 'ракет', 'звезд', 'планет'],
            'мороженое': ['морожен', 'сладк', 'конфет'],
            'животные': ['животн', 'звер', 'котик', 'собачк']
        };
        
        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(k => lowerSpeech.includes(k))) {
                detectedTopic = topic;
                break;
            }
        }
        
        // Определяем настроение
        let detectedMood = null;
        if (lowerSpeech.includes('весел') || lowerSpeech.includes('хорош') || lowerSpeech.includes('рад')) {
            detectedMood = 'happy';
        } else if (lowerSpeech.includes('груст') || lowerSpeech.includes('плох') || lowerSpeech.includes('обид')) {
            detectedMood = 'sad';
        } else if (lowerSpeech.includes('страш') || lowerSpeech.includes('бой')) {
            detectedMood = 'scared';
        }
        
        res.status(200).json({ 
            story, 
            detectedFear, 
            detectedTopic,
            detectedMood
        });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ story: "Мяу... Давай ещё раз? Я не расслышал!" });
    }
}
