export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { text, voice = 'alice' } = req.body;
    
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Текст обязателен' });
    }
    
    const API_KEY = process.env.YANDEX_API_KEY;
    const FOLDER_ID = process.env.YANDEX_FOLDER_ID;
    
    if (!API_KEY || !FOLDER_ID) {
        console.error('Yandex Cloud не настроен');
        return res.status(500).json({ error: 'Сервис временно недоступен' });
    }
    
    try {
        // API v1 — самый стабильный, голос alice
        const url = `https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize?folderId=${FOLDER_ID}`;
        
        const formData = new URLSearchParams();
        formData.append('text', text.slice(0, 500));
        formData.append('voice', voice);      // alice
        formData.append('emotion', 'good');
        formData.append('speed', '1.0');
        formData.append('format', 'lpcm');
        formData.append('sampleRateHertz', '48000');
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Yandex TTS error:', response.status, errorText);
            return res.status(response.status).json({ error: 'Ошибка синтеза речи' });
        }
        
        const pcmBuffer = await response.arrayBuffer();
        
        // Конвертируем PCM в WAV
        const wavBuffer = pcmToWav(pcmBuffer, 48000, 1);
        
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(wavBuffer));
        
    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
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
