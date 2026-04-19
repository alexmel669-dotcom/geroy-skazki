// ========== НАДЁЖНОЕ ВОСПРОИЗВЕДЕНИЕ АУДИО ==========
let currentAudio = null;
let isAudioPlaying = false;

async function playAudioBlob(blob) {
    // Полностью останавливаем текущее аудио
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio.load();
        currentAudio = null;
    }
    
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    
    return new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => {
            audio.play()
                .then(() => {
                    isAudioPlaying = true;
                    document.getElementById('avatar').classList.add('talking');
                    resolve();
                })
                .catch(reject);
        };
        audio.onended = () => {
            isAudioPlaying = false;
            document.getElementById('avatar').classList.remove('talking');
            URL.revokeObjectURL(audioUrl);
            if (currentAudio === audio) currentAudio = null;
            resolve();
        };
        audio.onerror = (e) => {
            console.error('Audio error:', e);
            reject(new Error('Playback failed'));
        };
        audio.load();
    });
}

async function speakWithYandex(text, voice = 'ermil', emotion = 'good') {
    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice, emotion, speed: 1.0 })
        });
        
        if (!response.ok) throw new Error(`TTS error: ${response.status}`);
        
        const audioBlob = await response.blob();
        if (audioBlob.size < 100) throw new Error('Audio too small');
        
        await playAudioBlob(audioBlob);
    } catch (error) {
        console.error('Yandex TTS error:', error);
        if (!currentAudio || currentAudio.paused) {
            fallbackSpeak(text);
        }
    }
}

function fallbackSpeak(text) {
    const cleanText = text.replace(/[\*\_\#]/g, '');
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'ru-RU';
    utter.rate = 0.9;
    utter.onstart = () => document.getElementById('avatar').classList.add('talking');
    utter.onend = () => document.getElementById('avatar').classList.remove('talking');
    window.speechSynthesis.speak(utter);
}

async function speak(text) {
    const cleanText = text.replace(/[\*\_\#]/g, '');
    try {
        await speakWithYandex(cleanText, 'ermil', 'good');
    } catch (e) {
        fallbackSpeak(cleanText);
    }
}
