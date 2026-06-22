// ========================================
// mic.js — РАБОТА С МИКРОФОНОМ
// ========================================

let mediaRecorder = null;
let audioChunks = [];
let isCurrentlyRecording = false;
let stream = null;
let recordingMimeType = 'audio/webm';

function cleanupStream() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

function getPreferredMimeType() {
    const types = [
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
        'audio/webm'
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
}

export function isRecording() {
    return isCurrentlyRecording;
}

export async function startRecording() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordingMimeType = getPreferredMimeType();
        const options = recordingMimeType ? { mimeType: recordingMimeType } : {};
        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.start(100);
        isCurrentlyRecording = true;
    } catch (error) {
        cleanupStream();
        throw new Error('Не удалось получить доступ к микрофону');
    }
}

export function getRecordingMimeType() {
    return recordingMimeType || mediaRecorder?.mimeType || 'audio/webm';
}

export async function stopRecording() {
    return new Promise((resolve, reject) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            reject(new Error('No active recording'));
            return;
        }

        mediaRecorder.addEventListener('stop', () => {
            const mime = getRecordingMimeType();
            const audioBlob = new Blob(audioChunks, { type: mime });
            audioChunks = [];
            isCurrentlyRecording = false;
            cleanupStream();
            resolve(audioBlob);
        }, { once: true });

        mediaRecorder.stop();
    });
}

export function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.addEventListener('stop', () => {
            audioChunks = [];
            isCurrentlyRecording = false;
            cleanupStream();
        }, { once: true });
        mediaRecorder.stop();
    }
}

export function getAudioBlob() {
    if (!audioChunks.length) return null;
    return new Blob(audioChunks, { type: getRecordingMimeType() });
}

export function playAudioFromUrl(url) {
    return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Audio playback failed'));
        audio.play().catch(reject);
    });
}

export function isMicrophoneSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export default {
    isRecording, startRecording, stopRecording, cancelRecording,
    getAudioBlob, playAudioFromUrl, getRecordingMimeType, isMicrophoneSupported
};
