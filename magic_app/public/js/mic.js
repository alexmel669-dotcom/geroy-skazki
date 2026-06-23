// ========================================
// mic.js — РАБОТА С МИКРОФОНОМ (+ VAD)
// ========================================

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
let recordingStartTime = 0;

const MIN_RECORD_MS = 400;
const CHUNK_MS = 250;

function cleanupStream() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

function cleanupAudioContext() {
  if (volumeFrame) cancelAnimationFrame(volumeFrame);
  volumeFrame = null;
  if (silenceTimer) clearTimeout(silenceTimer);
  silenceTimer = null;
  if (maxTimeTimer) clearTimeout(maxTimeTimer);
  maxTimeTimer = null;
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  analyser = null;
}

function getPreferredMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log('🎙️ Supported mime:', type);
      return type;
    }
  }
  console.warn('🎙️ No preferred mime, using browser default');
  return '';
}

function waitForRecorderStart(recorder, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    if (recorder.state === 'recording') {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('MediaRecorder start timeout'));
    }, timeoutMs);

    const onStart = () => {
      cleanup();
      resolve();
    };

    const onError = (event) => {
      cleanup();
      reject(event.error || new Error('MediaRecorder error'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      recorder.removeEventListener('start', onStart);
      recorder.removeEventListener('error', onError);
    };

    recorder.addEventListener('start', onStart, { once: true });
    recorder.addEventListener('error', onError, { once: true });
  });
}

function rmsToDb(rms) {
  if (rms <= 0.00001) return -100;
  return 20 * Math.log10(rms);
}

function monitorVolume() {
  if (!analyser || !isCurrentlyRecording) return;

  if (Date.now() - recordingStartTime < 2000) {
    volumeFrame = requestAnimationFrame(monitorVolume);
    return;
  }

  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  const db = rmsToDb(Math.sqrt(sum / data.length));
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
    console.log('🎙️ Requesting microphone...');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    recordingMimeType = getPreferredMimeType();
    const recorderOptions = recordingMimeType ? { mimeType: recordingMimeType } : {};
    mediaRecorder = new MediaRecorder(stream, recorderOptions);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      const size = event.data?.size || 0;
      console.log('🎙️ Chunk received:', size, 'bytes');
      if (event.data && size > 0) audioChunks.push(event.data);
    };

    audioContext = new AudioContext();
    await audioContext.resume().catch(() => {});
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    console.log('🎙️ Starting MediaRecorder, chunk interval:', CHUNK_MS, 'ms');
    mediaRecorder.start(CHUNK_MS);
    await waitForRecorderStart(mediaRecorder);

    recordingStartTime = Date.now();
    isCurrentlyRecording = true;
    onStateChangeCallback?.('recording');
    monitorVolume();

    console.log('🎙️ Recording started ✓ mime:', mediaRecorder.mimeType || recordingMimeType, 'state:', mediaRecorder.state);

    maxTimeTimer = setTimeout(() => {
      if (isCurrentlyRecording && onAutoStopCallback) onAutoStopCallback('max_time');
    }, CONFIG.MAX_RECORD_TIME ?? 60000);
  } catch (error) {
    cleanupAudioContext();
    cleanupStream();
    mediaRecorder = null;
    isCurrentlyRecording = false;
    console.error('🎙️ Failed to start recording:', error);
    throw new Error('Не удалось получить доступ к микрофону');
  }
}

export function getRecordingMimeType() {
  return recordingMimeType || mediaRecorder?.mimeType || 'audio/webm';
}

export async function stopRecording() {
  const elapsed = Date.now() - recordingStartTime;
  if (elapsed < MIN_RECORD_MS) {
    console.log('🎙️ Waiting min record time:', MIN_RECORD_MS - elapsed, 'ms');
    await new Promise((resolve) => setTimeout(resolve, MIN_RECORD_MS - elapsed));
  }

  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      reject(new Error('No active recording'));
      return;
    }

    onStateChangeCallback?.('processing');

    mediaRecorder.addEventListener('stop', () => {
      const totalChunks = audioChunks.length;
      const totalSize = audioChunks.reduce((sum, c) => sum + c.size, 0);
      console.log('🎙️ Stop event: chunks=', totalChunks, 'rawSize=', totalSize);

      const audioBlob = new Blob(audioChunks, { type: getRecordingMimeType() });
      audioChunks = [];
      isCurrentlyRecording = false;
      recordingStartTime = 0;
      cleanupAudioContext();
      cleanupStream();
      onAutoStopCallback = null;
      console.log('🎙️ Recording stopped, blob size:', audioBlob.size, 'type:', audioBlob.type);
      resolve(audioBlob);
    }, { once: true });

    try {
      if (mediaRecorder.state === 'recording' && typeof mediaRecorder.requestData === 'function') {
        console.log('🎙️ requestData() before stop');
        mediaRecorder.requestData();
      }
    } catch (err) {
      console.warn('🎙️ requestData failed:', err);
    }

    console.log('🎙️ Calling stop(), state:', mediaRecorder.state);
    mediaRecorder.stop();
  });
}

export function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.addEventListener('stop', () => {
      audioChunks = [];
      isCurrentlyRecording = false;
      recordingStartTime = 0;
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

export function browserSpeechRecognition(timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reject(new Error('Browser STT not supported'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { recognition.stop(); } catch { /* ignore */ }
      reject(new Error('Browser STT timeout'));
    }, timeoutMs);

    recognition.onresult = (event) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const text = event.results?.[0]?.[0]?.transcript || '';
      console.log('🎙️ Browser STT result:', text);
      resolve(text.trim());
    };

    recognition.onerror = (event) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      console.warn('🎙️ Browser STT error:', event.error);
      reject(new Error(event.error || 'Browser STT failed'));
    };

    recognition.onend = () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        reject(new Error('Browser STT empty'));
      }
    };

    console.log('🎙️ Starting browser SpeechRecognition...');
    try {
      recognition.start();
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

export async function requestMicrophonePermission() {
  try {
    const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    testStream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    return false;
  }
}

export function setMicStateCallback(cb) {
  onStateChangeCallback = cb;
}

export default {
  isRecording, startRecording, stopRecording, cancelRecording,
  getAudioBlob, playAudioFromUrl, getRecordingMimeType,
  isMicrophoneSupported, requestMicrophonePermission, setMicStateCallback,
  browserSpeechRecognition
};
