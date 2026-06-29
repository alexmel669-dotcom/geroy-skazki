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
let liveRecognition = null;
let liveSttParts = [];

const MIN_RECORD_MS = 600;
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
    startLiveStt();
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

function mixToMono(audioBuffer) {
  const len = audioBuffer.length;
  const out = new Float32Array(len);
  const n = audioBuffer.numberOfChannels;
  for (let ch = 0; ch < n; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += data[i] / n;
  }
  return out;
}

function resampleFloat32(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx] ?? 0;
    const b = input[idx + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

function normalizePeak(samples, target = 0.9) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak < 1e-6) return samples;
  const gain = target / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-1, Math.min(1, samples[i] * gain));
  }
  return out;
}

function floatTo16BitPCM(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

let liveSttInterim = '';

function startLiveStt() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  liveSttParts = [];
  liveRecognition = new SR();
  liveRecognition.lang = 'ru-RU';
  liveRecognition.continuous = true;
  liveRecognition.interimResults = true;
  liveRecognition.onresult = (event) => {
    liveSttInterim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const part = (result[0]?.transcript || '').trim();
      if (!part) continue;
      if (result.isFinal) {
        liveSttParts.push(part);
      } else {
        liveSttInterim = part;
      }
    }
  };
  liveRecognition.onerror = (e) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      console.warn('🎙️ Live STT error:', e.error);
    }
  };
  liveRecognition.onend = () => {
    if (isCurrentlyRecording && liveRecognition) {
      try { liveRecognition.start(); } catch { /* ignore */ }
    }
  };
  try {
    liveRecognition.start();
    console.log('🎙️ Live browser STT started');
  } catch (e) {
    console.warn('🎙️ Live STT start failed:', e.message);
    liveRecognition = null;
  }
}

function stopLiveStt() {
  return new Promise((resolve) => {
    const text = getLiveSttText();
    if (!liveRecognition) {
      resolve(text);
      return;
    }
    const rec = liveRecognition;
    liveRecognition = null;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(getLiveSttText());
    };
    rec.onend = finish;
    try { rec.stop(); } catch { finish(); return; }
    setTimeout(finish, 400);
  });
}

export function getLiveSttText() {
  const finalText = liveSttParts.filter(Boolean).join(' ').trim();
  return finalText || liveSttInterim.trim();
}

export function clearLiveSttText() {
  liveSttParts = [];
  liveSttInterim = '';
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Подготовка аудио для Yandex STT: OGG как есть, WebM/MP4 → LPCM 16 kHz mono */
export async function prepareAudioForStt(blob) {
  const mime = (blob.type || getRecordingMimeType() || '').toLowerCase();
  if (mime.includes('ogg')) {
    const buf = await blob.arrayBuffer();
    return {
      base64: bytesToBase64(new Uint8Array(buf)),
      contentType: mime.includes('codecs') ? mime : 'audio/ogg;codecs=opus',
      format: 'oggopus'
    };
  }

  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const mono = decoded.numberOfChannels > 1 ? mixToMono(decoded) : decoded.getChannelData(0);
    const resampled = resampleFloat32(mono, decoded.sampleRate, 16000);
    const normalized = normalizePeak(resampled);
    const pcm = floatTo16BitPCM(normalized);
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    console.log('🎙️ PCM for STT:', bytes.length, 'bytes,', Math.round(bytes.length / 32), 'ms');
    return {
      base64: bytesToBase64(bytes),
      contentType: 'audio/x-pcm;bit=16;rate=16000',
      format: 'lpcm',
      sampleRateHz: 16000
    };
  } finally {
    await ctx.close().catch(() => {});
  }
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
    mediaRecorder.addEventListener('stop', async () => {
      const rawSize = audioChunks.reduce((s, c) => s + c.size, 0);
      console.log('🎙️ Stop: chunks=', audioChunks.length, 'rawSize=', rawSize);
      const audioBlob = new Blob(audioChunks, { type: getRecordingMimeType() });
      audioChunks = [];
      isCurrentlyRecording = false;
      recordingStartTime = 0;
      cleanupAudioContext();
      cleanupStream();
      onAutoStopCallback = null;
      const liveText = await stopLiveStt();
      if (liveText) console.log('🎙️ Live STT result:', liveText);
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
    mediaRecorder.addEventListener('stop', async () => {
      audioChunks = [];
      isCurrentlyRecording = false;
      cleanupAudioContext();
      cleanupStream();
      onAutoStopCallback = null;
      await stopLiveStt();
      clearLiveSttText();
      onStateChangeCallback?.('idle');
    }, { once: true });
    mediaRecorder.stop();
  } else {
    stopLiveStt().then(() => clearLiveSttText());
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

let micState = 'idle';
let processingLock = false;

export function getMicState() {
  return micState;
}

export function isProcessingLocked() {
  return processingLock;
}

export function setMicState(state) {
  micState = state;
  const btn = document.getElementById('micButton') || document.getElementById('mic-button');
  if (!btn) return;
  btn.classList.remove('mic-recording', 'mic-processing', 'mic-idle', 'mic-bedtime-armed', 'recording', 'processing');
  btn.className = 'mic-btn mic-' + state;
  if (state === 'recording') btn.classList.add('recording');

  if (state === 'processing') {
    btn.disabled = true;
    btn.classList.add('processing');
    processingLock = true;
  } else if (state === 'idle') {
    btn.disabled = false;
    processingLock = false;
  } else if (state === 'recording') {
    btn.disabled = false;
  }
}

export function startMicSession() {
  if (micState !== 'idle' || processingLock) {
    console.warn('🎙️ Mic busy:', micState);
    return false;
  }
  setMicState('recording');
  return true;
}

export function finishMicSession() {
  if (micState !== 'recording') return;
  setMicState('processing');
}

export function onMicProcessingDone() {
  processingLock = false;
  setMicState('idle');
}

export const onProcessingDone = onMicProcessingDone;

export default {
  isRecording, startRecording, stopRecording, cancelRecording,
  getAudioBlob, playAudioFromUrl, getRecordingMimeType, prepareAudioForStt,
  isMicrophoneSupported, requestMicrophonePermission, setMicStateCallback,
  browserSpeechRecognition, getLiveSttText, clearLiveSttText,
  getMicState, setMicState, startMicSession, finishMicSession, onMicProcessingDone,
  onProcessingDone, isProcessingLocked
};
