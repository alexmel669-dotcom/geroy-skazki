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

        const systemPrompt = `Ты — Люцик, добрый волшебный лев. Ты друг ребёнка ${childName}. Будь добрым, поддерживай разговор. Если ребёнок говорит о страхе — сочини короткую сказку (3-5 предложений). Используй иногда "мур-р-р".`;

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
                max_tokens: 350
            })
        });

        const data = await response.json();
        const story = data.choices[0].message.content;

        const voiceName = 'ru-RU-SvetlanaNeural';
        const ssml = `<speak version='1.0'><voice name='${voiceName}'><prosody rate='0.9'>${story}</prosody></voice></speak>`;

        const audioResponse = await fetch('https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
            },
            body: ssml
        });

        let audioBase64 = null;
        if (audioResponse.ok) {
            const audioBuffer = await audioResponse.arrayBuffer();
            audioBase64 = Buffer.from(audioBuffer).toString('base64');
        }

        res.status(200).json({ story, audio: audioBase64 });
    } catch (error) {
        res.status(500).json({ story: "🦁 Ошибка, давай ещё раз!" });
    }
}
