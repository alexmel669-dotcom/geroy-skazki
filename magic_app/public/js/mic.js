import { CONFIG } from './config.js';

let mediaRecorder = null;
let audioChunks = [];
let isCurrentlyRecording = false;
let stream = null;
let recordingMimeType = 'audio/webm';
let audioContext = null;
let analyser = null;
let volumeFrame = null;
let silenceTimer = null;
let maxTimeTimer = null;
let onAutoStopCallback = null;
let onStateChangeCallback = null;
let recordingStartedAt = 0;

function cleanupStream() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

function cleanupAudioContext() {
  if (volumeFrame) {
    cancelAnimationFrame(volumeFrame);
    volumeFrame = null;
  }
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (maxTimeTimer) {
    clearTimeout(maxTimeTimer);
    maxTimeTimer = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  analyser = null;
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

function rmsToDb(rms) {
  if (rms <= 0.00001) return -100;
  return 20 * Math.log10(rms);
}

function monitorVolume() {
  if (!analyser || !isCurrentlyRecording) return;

  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / data.length);
  const db = rmsToDb(rms);
  const threshold = CONFIG.SILENCE_THRESHOLD ?? -45;
  const silenceTimeout = CONFIG.SILENCE_TIMEOUT ?? 5000;

  if (db < threshold) {
    if (!silenceTimer) {
      silenceTimer = setTimeout(() => {
        silenceTimer = null;
        if (isCurrentlyRecording && onAutoStopCallback) onAutoStopCallback('silence');
      }, silenceTimeout);
    }
  } else if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }

  volumeFrame = requestAnimationFrame(monitorVolume);
}

export function isRecording() {
  return isCurrentlyRecording;
}

export async function startRecording(options = {}) {
  onAutoStopCallback = options.onAutoStop || null;
  onStateChangeCallback = options.onStateChange || null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingMimeType = getPreferredMimeType();
    const recorderOptions = recordingMimeType ? { mimeType: recordingMimeType } : {};
    mediaRecorder = new MediaRecorder(stream, recorderOptions);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    mediaRecorder.start(100);
    isCurrentlyRecording = true;
    recordingStartedAt = Date.now();
    onStateChangeCallback?.('recording');
    monitorVolume();

    maxTimeTimer = setTimeout(() => {
      if (isCurrentlyRecording && onAutoStopCallback) onAutoStopCallback('max_time');
    }, CONFIG.MAX_RECORD_TIME ?? 60000);
  } catch (error) {
    cleanupAudioContext();
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

    onStateChangeCallback?.('processing');

    mediaRecorder.addEventListener('stop', () => {
      const mime = getRecordingMimeType();
      const audioBlob = new Blob(audioChunks, { type: mime });
      audioChunks = [];
      isCurrentlyRecording = false;
      cleanupAudioContext();
      cleanupStream();
      onAutoStopCallback = null;
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
      cleanupAudioContext();
      cleanupStream();
      onAutoStopCallback = null;
      onStateChangeCallback?.('idle');
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

export function setMicStateCallback(cb) {
  onStateChangeCallback = cb;
}

export default {
  isRecording, startRecording, stopRecording, cancelRecording,
  getAudioBlob, playAudioFromUrl, getRecordingMimeType, isMicrophoneSupported, setMicStateCallback
};
