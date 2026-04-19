export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { text, voice = 'alexander' } = req.body;
    
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Текст обязателен' });
    }
    
    const API_KEY = process.env.YANDEX_API_KEY;
    
    if (!API_KEY) {
        return res.status(500).json({ error: 'Yandex Cloud не настроен' });
    }
    
    try {
        // Старый добрый API v1 (совместимый формат)
        const url = `https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize?format=lpcm&sampleRateHertz=48000&voice=${voice}&emotion=good&speed=1.0`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `text=${encodeURIComponent(text.slice(0, 500))}`
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Yandex TTS error:', errorText);
            return res.status(response.status).json({ error: 'Ошибка синтеза' });
        }
        
        const audioBuffer = await response.arrayBuffer();
        
        // Конвертируем LPCM в WAV
        const wavBuffer = pcmToWav(audioBuffer, 48000, 1);
        
        res.setHeader('Content-Type', 'audio/wav');
        res.send(Buffer.from(wavBuffer));
        
    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}

function pcmToWav(pcmData, sampleRate, numChannels) {
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.byteLength;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    const pcmView = new Uint8Array(pcmData);
    const wavView = new Uint8Array(buffer);
    wavView.set(pcmView, headerSize);
    
    return buffer;
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
