export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Метод не поддерживается' });
    }
    
    const { text, voice = 'alexander', emotion = 'good', speed = 1.0 } = req.body;
    
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
        // Используем формат LPCM (raw audio) с частотой 48000
        const requestBody = {
            text: text.slice(0, 500),
            hints: [
                { voice: voice },
                { role: emotion },
                { speed: speed }
            ],
            outputAudioSpec: {
                rawAudio: {
                    audioEncoding: 'LINEAR16_PCM',
                    sampleRateHertz: 48000
                }
            }
        };
        
        console.log('Sending request to Yandex TTS...');
        
        const response = await fetch('https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis', {
            method: 'POST',
            headers: {
                'Authorization': `Api-Key ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Yandex TTS error:', response.status, errorText);
            return res.status(response.status).json({ error: 'Ошибка синтеза речи' });
        }
        
        const audioBuffer = await response.arrayBuffer();
        console.log('Audio received, size:', audioBuffer.byteLength);
        
        // Конвертируем LINEAR16 PCM в WAV (правильный заголовок)
        const wavBuffer = pcmToWav(audioBuffer, 48000, 1);
        
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).send(Buffer.from(wavBuffer));
        
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
    
    // RIFF chunk
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(view, 8, 'WAVE');
    
    // fmt subchunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);      // Subchunk size (16 for PCM)
    view.setUint16(20, 1, true);       // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    
    // data subchunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Copy PCM data
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
