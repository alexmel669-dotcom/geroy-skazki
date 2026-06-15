// ========================================
// audio.js — СИНТЕЗ РЕЧИ
// ========================================

let currentUtterance = null;
let speechQueue = [];
let isSpeaking = false;

export async function synthesizeSpeech(text, character = 'lucik') {
    if (!text || typeof text !== 'string') {
        console.warn('synthesizeSpeech: empty text');
        return;
    }
    
    if (currentUtterance) {
        window.speechSynthesis.cancel();
    }
    
    return new Promise((resolve) => {
        if (!window.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            resolve();
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.95;
        utterance.pitch = 1.1;
        utterance.volume = 1;
        
        utterance.onstart = () => {
            console.log('🔊 Speaking:', text.substring(0, 50) + '...');
            isSpeaking = true;
        };
        
        utterance.onend = () => {
            console.log('🔊 Speaking finished');
            isSpeaking = false;
            currentUtterance = null;
            resolve();
            processQueue();
        };
        
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            isSpeaking = false;
            currentUtterance = null;
            resolve();
            processQueue();
        };
        
        currentUtterance = utterance;
        
        setTimeout(() => {
            try {
                window.speechSynthesis.speak(utterance);
            } catch (error) {
                console.error('Failed to speak:', error);
                resolve();
            }
        }, 100);
    });
}

export function stopSpeech() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null;
    isSpeaking = false;
    speechQueue = [];
    console.log('Speech stopped');
}

export function queueSpeech(text, character = 'lucik') {
    speechQueue.push({ text, character });
    if (!isSpeaking) {
        processQueue();
    }
}

async function processQueue() {
    if (speechQueue.length === 0) return;
    if (isSpeaking) return;
    const next = speechQueue.shift();
    await synthesizeSpeech(next.text, next.character);
}

export function isSpeechSupported() {
    return typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance;
}

export async function getAvailableVoices() {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) {
            resolve([]);
            return;
        }
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve(voices);
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                resolve(window.speechSynthesis.getVoices());
            };
            setTimeout(() => resolve([]), 1000);
        }
    });
}

export async function setRussianVoice() {
    const voices = await getAvailableVoices();
    return voices.find(voice => voice.lang.includes('ru')) || null;
}

export default { synthesizeSpeech, stopSpeech, queueSpeech, isSpeechSupported, getAvailableVoices, setRussianVoice };
