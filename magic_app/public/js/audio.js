// ========================================
// audio.js — СИНТЕЗ РЕЧИ (TTS)
// ========================================

let currentUtterance = null;
let speechQueue = [];
let isSpeaking = false;

/**
 * Синтез речи (озвучивание текста)
 * @param {string} text - Текст для озвучивания
 * @param {string} character - Персонаж (не используется, но оставлен для совместимости)
 * @returns {Promise<void>}
 */
export async function synthesizeSpeech(text, character = 'lucik') {
    if (!text || typeof text !== 'string') {
        console.warn('synthesizeSpeech: empty text');
        return;
    }
    
    // Останавливаем текущую речь
    stopSpeech();
    
    return new Promise((resolve) => {
        // Проверка поддержки Speech Synthesis
        if (!window.speechSynthesis) {
            console.warn('Speech synthesis not supported');
            resolve();
            return;
        }
        
        // Создаем utterance
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.95;  // Немного медленнее для детей
        utterance.pitch = 1.1;   // Чуть выше для дружелюбности
        utterance.volume = 1;
        
        // Обработчики событий
        utterance.onstart = () => {
            console.log('🔊 Speaking:', text.substring(0, 50) + '...');
            isSpeaking = true;
        };
        
        utterance.onend = () => {
            console.log('🔊 Speaking finished');
            isSpeaking = false;
            currentUtterance = null;
            resolve();
            
            // Воспроизводим следующее из очереди
            processQueue();
        };
        
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            isSpeaking = false;
            currentUtterance = null;
            resolve();
            
            // Пробуем следующее из очереди
            processQueue();
        };
        
        currentUtterance = utterance;
        
        // Небольшая задержка перед воспроизведением для стабильности
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

/**
 * Остановка текущей речи
 */
export function stopSpeech() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    if (currentUtterance) {
        currentUtterance = null;
    }
    
    isSpeaking = false;
    speechQueue = [];
    console.log('Speech stopped');
}

/**
 * Добавление в очередь воспроизведения
 * @param {string} text 
 * @param {string} character 
 */
export function queueSpeech(text, character = 'lucik') {
    speechQueue.push({ text, character });
    
    if (!isSpeaking) {
        processQueue();
    }
}

/**
 * Обработка очереди воспроизведения
 */
async function processQueue() {
    if (speechQueue.length === 0) return;
    if (isSpeaking) return;
    
    const next = speechQueue.shift();
    await synthesizeSpeech(next.text, next.character);
}

/**
 * Проверка поддержки синтеза речи
 * @returns {boolean}
 */
export function isSpeechSupported() {
    return typeof window !== 'undefined' && 
           window.speechSynthesis && 
           window.SpeechSynthesisUtterance;
}

/**
 * Получение доступных голосов
 * @returns {Promise<Array>}
 */
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

/**
 * Установка голоса по умолчанию (русский)
 */
export async function setRussianVoice() {
    const voices = await getAvailableVoices();
    const russianVoice = voices.find(voice => 
        voice.lang.includes('ru') || 
        voice.lang.includes('RU')
    );
    
    return russianVoice || null;
}

// Экспорт по умолчанию для совместимости
export default {
    synthesizeSpeech,
    stopSpeech,
    queueSpeech,
    isSpeechSupported,
    getAvailableVoices,
    setRussianVoice
};
