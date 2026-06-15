// ========================================
// mic.js — РАБОТА С МИКРОФОНОМ
// ========================================

let mediaRecorder = null;
let audioChunks = [];
let isCurrentlyRecording = false;
let stream = null;

/**
 * Проверка, идет ли запись
 * @returns {boolean}
 */
export function isRecording() {
    return isCurrentlyRecording;
}

/**
 * Начать запись с микрофона
 * @returns {Promise<void>}
 */
export async function startRecording() {
    try {
        // Запрашиваем доступ к микрофону
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            // Останавливаем все треки
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
        };
        
        mediaRecorder.start(100); // Собираем данные каждые 100мс
        isCurrentlyRecording = true;
        
        console.log('🎙️ Recording started');
        
    } catch (error) {
        console.error('Failed to start recording:', error);
        throw new Error('Не удалось получить доступ к микрофону');
    }
}

/**
 * Остановить запись и получить аудио
 * @returns {Promise<Blob>}
 */
export async function stopRecording() {
    return new Promise((resolve, reject) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            reject(new Error('No active recording'));
            return;
        }
        
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioChunks = [];
            isCurrentlyRecording = false;
            
            // Останавливаем треки
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
            
            console.log('🎙️ Recording stopped, size:', audioBlob.size);
            resolve(audioBlob);
        };
        
        mediaRecorder.stop();
    });
}

/**
 * Отменить запись (без сохранения)
 */
export function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = () => {
            audioChunks = [];
            isCurrentlyRecording = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
        };
        mediaRecorder.stop();
    }
}

/**
 * Проверка поддержки микрофона в браузере
 * @returns {boolean}
 */
export function isMicrophoneSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Запрос разрешения на микрофон
 * @returns {Promise<boolean>}
 */
export async function requestMicrophonePermission() {
    try {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        console.error('Microphone permission denied:', error);
        return false;
    }
}

// Экспорт по умолчанию
export default {
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
    isMicrophoneSupported,
    requestMicrophonePermission
};
