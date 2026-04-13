// api/generate.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { childName, childAge, userEmail, userSpeech, history = [] } = req.body;

        // Сохраняем сообщение ребёнка
        if (userEmail) {
            await sql`
                INSERT INTO conversation_history (user_email, role, content)
                VALUES (${userEmail}, 'user', ${userSpeech})
            `;
        }

        // Загружаем историю за последние 7 дней
        let historyText = '';
        if (userEmail) {
            const result = await sql`
                SELECT role, content FROM conversation_history 
                WHERE user_email = ${userEmail}
                    AND created_at > NOW() - INTERVAL '7 days'
                ORDER BY created_at DESC
                LIMIT 30
            `;
            const recentMessages = result.rows.reverse();
            for (const msg of recentMessages) {
                const role = msg.role === 'user' ? childName : 'Люцик';
                historyText += `${role}: ${msg.content}\n`;
            }
        } else {
            for (const msg of history.slice(-10)) {
                const role = msg.role === 'user' ? childName : 'Люцик';
                historyText += `${role}: ${msg.content}\n`;
            }
        }

        const ageNum = parseInt(childAge) || 5;
        const schoolType = ageNum <= 6 ? 'садике' : 'школе';

        // ========== УМНЫЙ ПРОМПТ С ОТВЕТАМИ НА «ПОЧЕМУ» ==========
        const systemPrompt = `Ты — Люцик, добрый кот. Ты друг ребёнка ${childName} (${ageNum} лет).

ТВОЙ ХАРАКТЕР: мягкий, терпеливый, с юмором. Ты любишь отвечать на вопросы "почему".

КАК ОТВЕЧАТЬ НА "ПОЧЕМУ":
- "Почему небо голубое?" → "Потому что солнечный свет рассеивается в воздухе, а синий цвет самый короткий, вот его мы и видим!"
- "Почему трава зелёная?" → "В траве есть хлорофилл — это такое вещество, которое помогает растениям питаться солнечным светом. Оно и делает траву зелёной!"
- "Почему собаки лают?" → "Собаки лают, чтобы общаться: позвать хозяина, предупредить об опасности или просто от радости!"
- "Почему я должен есть овощи?" → "Овощи дают тебе силу и энергию, чтобы расти здоровым и сильным!"
- "Почему ночью темно?" → "Потому что Земля поворачивается к Солнцу то одной стороной, то другой. Когда к Солнцу повёрнута та сторона, где мы живём — у нас день. А когда нет — наступает ночь!"
- Если не знаешь ответа — честно скажи: "Знаешь, я не совсем уверен. Давай вместе подумаем или спросим у мамы?"

ОБЩИЕ ПРАВИЛА:
1. Сначала спроси, как прошёл день в ${schoolType}.
2. Если ребёнок говорит о страхе — поддержись, предложи сказку.
3. Всегда хвали за любопытство: "Отличный вопрос! Любопытство — это суперсила!"
4. Отвечай кратко (2-3 предложения), тепло, с юмором.`;

        const userPrompt = `${childName} сказал: "${userSpeech}"`;

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
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.85,
                max_tokens: 400
            })
        });

        const data = await response.json();
        const story = data.choices[0].message.content;

        // Сохраняем ответ Люцика
        if (userEmail) {
            await sql`
                INSERT INTO conversation_history (user_email, role, content)
                VALUES (${userEmail}, 'assistant', ${story})
            `;
        }

        // Очистка старых сообщений
        await sql`
            DELETE FROM conversation_history 
            WHERE created_at < NOW() - INTERVAL '7 days'
        `;

        res.status(200).json({ story, audio: null });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ story: "Мяу... Давай ещё раз? Я не расслышал!", audio: null });
    }
}
