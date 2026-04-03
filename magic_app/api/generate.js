// api/generate.js — Люцик с голосом от Microsoft Edge (бесплатно)
export default async function handler(req, res) {
    // Разрешаем только POST-запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }

    try {
        const { childName, childFear, userSpeech, history = [] } = req.body;

        // Формируем историю для контекста
        let historyText = '';
        for (const msg of history.slice(-6)) {
            const role = msg.role === 'user' ? childName : 'Люцик';
            historyText += `${role}: ${msg.content}\n`;
        }

        const systemPrompt = `Ты — Люцик, добрый волшебный лев в стиле Pixar. Ты друг и помощник ребёнка по имени ${childName}.

Твоя задача:
1. Будь добрым, заботливым собеседником. Спрашивай, как дела, поддерживай разговор.
2. Если ребёнок рассказывает о страхе (особенно про ${childFear}), предложи помощь и сочини короткую терапевтическую сказку (3-5 предложений), где герой побеждает этот страх.
3. Если ребёнок просто делится новостями или говорит о чём-то весёлом — порадуйся вместе с ним, похвали, задай уточняющий вопрос.
4. Твоя речь должна быть тёплой, немного игривой. Используй иногда "мур-р-р" или "мяу".
5. Не будь роботом. Ты — друг.`;

        const userPrompt = `${childName} сказал: "${userSpeech}"`;

        // 1. Запрос к DeepSeek за сказкой
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
                max_tokens: 350
            })
        });

        const data = await response.json();
        const story = data.choices[0].message.content;

        // 2. Преобразуем текст в речь через бесплатный Edge TTS
        // Выбираем красивый русский голос
        const voiceName = 'ru-RU-SvetlanaNeural';  // мягкий женский голос
        // Альтернативные голоса: 
        // 'ru-RU-DariyaNeural' — энергичный женский
        // 'ru-RU-DmitryNeural' — спокойный мужской
        
        const ttsUrl = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list';
        
        // Формируем SSML-запрос
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ru-RU'>
                        <voice name='${voiceName}'>
                            <prosody rate='0.9' pitch='1.0'>
                                ${story}
                            </prosody>
                        </voice>
                      </speak>`;
        
        const audioResponse = await fetch('https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: ssml
        });
        
        let audioBase64 = null;
        if (audioResponse.ok) {
            const audioBuffer = await audioResponse.arrayBuffer();
            audioBase64 = Buffer.from(audioBuffer).toString('base64');
        }

        // Возвращаем и текст, и аудио
        res.status(200).json({ 
            story: story,
            audio: audioBase64,
            hasAudio: !!audioBase64
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ 
            story: "🦁 Мур-р-р, что-то пошло не так! Давай попробуем ещё раз?",
            audio: null,
            error: error.message 
        });
    }
}
