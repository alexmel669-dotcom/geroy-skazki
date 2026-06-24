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
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
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
    const onStart = () => { cleanup(); resolve(); };
    const onError = (e) => { cleanup(); reject(e.error || new Error('MediaRecorder error')); };
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
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    recordingMimeType = getPreferredMimeType();
    const recorderOptions = recordingMimeType ? { mimeType: recordingMimeType } : {};
    mediaRecorder = new MediaRecorder(stream, recorderOptions);
    audioChunks = [];
    mediaRecorder.ondataavailable = (event) => {
      const size = event.data?.size || 0;
      console.log('🎙️ Chunk:', size, 'bytes');
      if (event.data && size > 0) audioChunks.push(event.data);
    };
    audioContext = new AudioContext();
    await audioContext.resume().catch(() => {});
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    console.log('🎙️ mediaRecorder.start(', CHUNK_MS, 'ms), mime:', recordingMimeType || 'default');
    mediaRecorder.start(CHUNK_MS);
    await waitForRecorderStart(mediaRecorder);
    recordingStartTime = Date.now();
    isCurrentlyRecording = true;
    onStateChangeCallback?.('recording');
    monitorVolume();
    console.log('🎙️ Recording started ✓ state:', mediaRecorder.state);
    maxTimeTimer = setTimeout(() => {
      if (isCurrentlyRecording && onAutoStopCallback) onAutoStopCallback('max_time');
    }, CONFIG.MAX_RECORD_TIME ?? 60000);
  } catch (error) {
    cleanupAudioContext();
    cleanupStream();
    mediaRecorder = null;
    isCurrentlyRecording = false;
    console.error('🎙️ Start failed:', error);
    throw new Error('Не удалось получить доступ к микрофону');
  }
}

export function getRecordingMimeType() {
  return recordingMimeType || mediaRecorder?.mimeType || 'audio/webm';
}

export async function stopRecording() {
  const elapsed = Date.now() - recordingStartTime;
  if (elapsed < MIN_RECORD_MS) {
    await new Promise((r) => setTimeout(r, MIN_RECORD_MS - elapsed));
  }
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      reject(new Error('No active recording'));
      return;
    }
    onStateChangeCallback?.('processing');
    mediaRecorder.addEventListener('stop', () => {
      const rawSize = audioChunks.reduce((s, c) => s + c.size, 0);
      console.log('🎙️ Stop: chunks=', audioChunks.length, 'rawSize=', rawSize);
      const audioBlob = new Blob(audioChunks, { type: getRecordingMimeType() });
      audioChunks = [];
      isCurrentlyRecording = false;
      recordingStartTime = 0;
      cleanupAudioContext();
      cleanupStream();
      onAutoStopCallback = null;
      console.log('🎙️ Recording stopped, blob size:', audioBlob.size);
      resolve(audioBlob);
    }, { once: true });
    try {
      if (mediaRecorder.state === 'recording' && typeof mediaRecorder.requestData === 'function') {
        console.log('🎙️ requestData()');
        mediaRecorder.requestData();
      }
    } catch (e) {
      console.warn('🎙️ requestData error:', e);
    }
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

/** Fallback STT через Web Speech API (экспортируется также из main.js) */
export function browserSpeechRecognition(timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      reject(new Error('Browser STT not supported'));
      return;
    }
    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { rec.stop(); } catch { /* ignore */ }
      reject(new Error('Browser STT timeout'));
    }, timeoutMs);
    rec.onresult = (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const text = e.results?.[0]?.[0]?.transcript || '';
      console.log('🎙️ Browser STT:', text);
      resolve(text.trim());
    };
    rec.onerror = (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error(e.error || 'Browser STT failed'));
    };
    rec.onend = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(new Error('Browser STT empty'));
      }
    };
    console.log('🎙️ Starting browser SpeechRecognition...');
    try { rec.start(); } catch (err) { clearTimeout(timer); reject(err); }
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
