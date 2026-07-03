// ========================================
// mic.js — РАБОТА С МИКРОФОНОМ (+ VAD)
// ========================================

import { CONFIG } from './config.js';

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true
};

const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

export { isAndroid };

let micSttFailCount = 0;
let lastInterimText = '';
let browserSttDisabled = false;

if (typeof window !== 'undefined') {
  window.lastRecognizedText = null;
  console.log('🎙️ STT supported langs:', SpeechRecognitionAPI ? 'OK' : 'NO');
  if (SpeechRecognitionAPI) {
    try {
      const testRecognition = new SpeechRecognitionAPI();
      console.log('🎙️ Available languages:', testRecognition.recognitionLanguages || 'unknown');
    } catch (e) {
      console.warn('🎙️ STT lang probe failed:', e.message);
    }
  }
}

export function isBrowserSttEnabled() {
  return !isAndroid && !browserSttDisabled && !!SpeechRecognitionAPI;
}

export function disableBrowserSttOnly() {
  browserSttDisabled = true;
  abortLiveBrowserStt();
  console.log('🎙️ Falling back to server STT only');
}

export function abortLiveBrowserStt() {
  liveSttActive = false;
  if (!liveRecognition) return;
  try {
    liveRecognition.abort();
  } catch {
    try { liveRecognition.stop(); } catch { /* ignore */ }
  }
  liveRecognition = null;
}

export function incrementMicFailCount() {
  micSttFailCount += 1;
  return micSttFailCount;
}

export function resetMicFailCount() {
  micSttFailCount = 0;
}

export function checkMicFailFallback() {
  window.ttsEngine?.speak('Я не расслышал. Попробуй сказать громче и чётче.');
  return true;
}

function attachSttLifecycleHandlers(recognition) {
  recognition.onstart = () => {
    console.log('🎙️ STT recognition STARTED ✓');
  };
  recognition.onerror = (event) => {
    console.error('🎙️ STT error:', event.error, event.message || '');
    if (event.error === 'language-not-supported') {
      window.ttsEngine?.speak('Твой телефон не поддерживает русский язык для голоса. Попробуй сказать громче и чётче.');
    }
  };
  recognition.onnomatch = () => {
    console.warn('🎙️ STT: no match');
  };
  recognition.onspeechend = () => {
    console.log('🎙️ STT: speech ended');
  };
}

function configureRussianRecognition(recognition, options = {}) {
  if (isAndroid) {
    recognition.lang = navigator.language || 'ru-RU';
    console.log('🎙️ Android STT lang:', recognition.lang);
  } else {
    recognition.lang = 'ru-RU';
  }

  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;
  recognition.maxAlternatives = 1;
  attachSttLifecycleHandlers(recognition);
}

async function requestMicStream() {
  return navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
}

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
let liveSttActive = false;

/** Микрофон только по нажатию кнопки — без автоперезапуска */
let manualMicOnly = true;
let userInitiatedRecording = false;

export function armRecordingFromUser() {
  userInitiatedRecording = true;
}

export function disarmRecordingFromUser() {
  userInitiatedRecording = false;
}

function clearAutoStopTimers() {
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = null;
  }
  if (maxTimeTimer) {
    clearTimeout(maxTimeTimer);
    maxTimeTimer = null;
  }
  onAutoStopCallback = null;
}

const CHUNK_MS = 250;

function setupVolumeMonitor() {
  if (!stream || !isCurrentlyRecording) return;
  try {
    audioContext = new AudioContext();
    audioContext.resume().catch(() => {});
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    monitorVolume();
  } catch (vadErr) {
    console.warn('🎙️ VAD setup failed:', vadErr);
  }
}

function cleanupStream() {
  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    });
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
  if (isAndroid) {
    if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/ogg')) return 'audio/ogg';
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  return '';
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
  if (!manualMicOnly && db < threshold) {
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
  if (manualMicOnly && !userInitiatedRecording) {
    console.warn('🎙️ Blocked: recording not user-initiated');
    return false;
  }
  if (micState !== 'idle' || processingLock) {
    console.warn('🎙️ Mic busy:', micState);
    return false;
  }

  userInitiatedRecording = false;

  onAutoStopCallback = options.onAutoStop || null;
  onStateChangeCallback = options.onStateChange || null;
  try {
    console.log('🎙️ Requesting microphone...');
    stream = await requestMicStream();
    recordingMimeType = getPreferredMimeType();
    const recorderOptions = recordingMimeType ? { mimeType: recordingMimeType } : {};
    mediaRecorder = new MediaRecorder(stream, recorderOptions);
    audioChunks = [];
    mediaRecorder.ondataavailable = (event) => {
      const size = event.data?.size || 0;
      console.log('🎙️ Chunk:', size, 'bytes');
      if (event.data && size > 0) audioChunks.push(event.data);
    };

    console.log('🎙️ mediaRecorder.start(', CHUNK_MS, 'ms), mime:', recordingMimeType || 'default');
    mediaRecorder.start(CHUNK_MS);
    recordingStartTime = Date.now();
    isCurrentlyRecording = true;
    setMicState('recording');
    onStateChangeCallback?.('recording');
    console.log('🎙️ Recording started ✓ state:', mediaRecorder.state);

    setupVolumeMonitor();
    startLiveStt();
    maxTimeTimer = setTimeout(() => {
      if (isCurrentlyRecording && onAutoStopCallback) onAutoStopCallback('max_time');
    }, CONFIG.MAX_RECORD_TIME ?? 60000);
    return true;
  } catch (error) {
    cleanupAudioContext();
    cleanupStream();
    mediaRecorder = null;
    isCurrentlyRecording = false;
    console.error('🎙️ Start failed:', error);
    releaseMicrophone();
    setMicState('idle');
    return false;
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

function normalizePeak(samples, target = 0.95) {
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

function applySttResult(event) {
  let interim = '';
  let finalText = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const part = (result[0]?.transcript || '').trim();
    if (!part) continue;
    if (result.isFinal) {
      finalText += part;
      liveSttParts.push(part);
    } else {
      interim += part;
    }
  }
  if (interim.trim()) {
    lastInterimText = interim.trim();
    liveSttInterim = lastInterimText;
  }
  if (finalText.trim()) {
    window.lastRecognizedText = finalText.trim();
    lastInterimText = '';
    liveSttInterim = '';
  }
}

function startLiveStt() {
  if (isAndroid) {
    console.log('🎙️ Android: skipping browser STT, using Yandex only');
    return;
  }
  if (!SpeechRecognitionAPI || browserSttDisabled) {
    if (browserSttDisabled) console.log('🎙️ Browser STT disabled — using server STT only');
    return;
  }
  liveSttParts = [];
  liveSttActive = true;
  lastInterimText = '';
  liveRecognition = new SpeechRecognitionAPI();
  configureRussianRecognition(liveRecognition, { continuous: true, interimResults: true });
  liveRecognition.onresult = applySttResult;
  liveRecognition.onend = () => {
    if (liveSttActive && isCurrentlyRecording && liveRecognition) {
      try { liveRecognition.start(); } catch { /* ignore */ }
    }
  };
  try {
    liveRecognition.start();
    console.log('🎙️ Live browser STT started, lang:', liveRecognition.lang);
  } catch (e) {
    console.warn('🎙️ Live STT start failed:', e.message);
    liveRecognition = null;
  }
}

function stopLiveStt() {
  return new Promise((resolve) => {
    liveSttActive = false;
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
  return window.lastRecognizedText || finalText || lastInterimText || liveSttInterim.trim();
}

export function clearLiveSttText() {
  liveSttParts = [];
  liveSttInterim = '';
  lastInterimText = '';
  if (typeof window !== 'undefined') window.lastRecognizedText = null;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Конвертация WebM/OGG/MP4 → PCM 16-bit signed, 16 kHz, mono */
async function convertToPCM(audioBlob) {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(await audioBlob.arrayBuffer());
    const mono = decoded.numberOfChannels > 1 ? mixToMono(decoded) : decoded.getChannelData(0);
    const resampled = resampleFloat32(mono, decoded.sampleRate, 16000);
    const normalized = normalizePeak(resampled);
    return floatTo16BitPCM(normalized).buffer;
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Подготовка аудио для Yandex STT: всегда LPCM 16 kHz mono */
export async function prepareAudioForStt(blob) {
  const pcmBuffer = await convertToPCM(blob);
  const bytes = new Uint8Array(pcmBuffer);
  console.log('🎙️ PCM for STT:', bytes.length, 'bytes,', Math.round(bytes.length / 32), 'ms');
  return {
    base64: bytesToBase64(bytes),
    contentType: 'application/octet-stream',
    format: 'lpcm',
    sampleRateHertz: 16000
  };
}

export function releaseMicrophone() {
  if (volumeFrame) cancelAnimationFrame(volumeFrame);
  volumeFrame = null;
  liveSttActive = false;
  clearAutoStopTimers();

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      if (typeof mediaRecorder.requestData === 'function') mediaRecorder.requestData();
    } catch { /* ignore */ }
    try { mediaRecorder.stop(); } catch { /* ignore */ }
  }

  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    });
    stream = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close().then(() => {
      audioContext = null;
    }).catch(() => {
      audioContext = null;
    });
  } else {
    audioContext = null;
  }
  analyser = null;

  if (navigator.mediaDevices?.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: false, video: false })
      .then((s) => s.getTracks().forEach((t) => t.stop()))
      .catch(() => {});
  }

  console.log('🎙️ Recording stopped, all tracks released');
}

export function onMicError(error) {
  console.error('Mic error:', error);
  releaseMicrophone();
  isCurrentlyRecording = false;
  recordingStartTime = 0;
  setMicState('idle');
}

export async function stopRecording() {
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

    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    cleanupAudioContext();
    cleanupStream();
  });
}

export function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.addEventListener('stop', async () => {
      audioChunks = [];
      isCurrentlyRecording = false;
      onAutoStopCallback = null;
      await stopLiveStt();
      clearLiveSttText();
      onStateChangeCallback?.('idle');
    }, { once: true });
    releaseMicrophone();
  } else {
    releaseMicrophone();
    stopLiveStt().then(() => clearLiveSttText());
    onStateChangeCallback?.('idle');
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
    if (!SpeechRecognitionAPI || browserSttDisabled) {
      reject(new Error('Browser STT not supported or disabled'));
      return;
    }
    const rec = new SpeechRecognitionAPI();
    configureRussianRecognition(rec, { continuous: false, interimResults: true });
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
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0]?.transcript || '';
      }
      text = text.trim();
      if (text) window.lastRecognizedText = text;
      console.log('🎙️ Browser STT:', text);
      resolve(text);
    };
    const baseOnError = rec.onerror;
    rec.onerror = (e) => {
      baseOnError?.(e);
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
    console.log('🎙️ Starting browser SpeechRecognition, lang:', rec.lang);
    try { rec.start(); } catch (err) { clearTimeout(timer); reject(err); }
  });
}

export async function requestMicrophonePermission() {
  try {
    const testStream = await requestMicStream();
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
  return true;
}

export function finishMicSession() {
  if (micState !== 'recording') return;
  setMicState('processing');
}

export function onMicProcessingDone() {
  disarmRecordingFromUser();
  clearAutoStopTimers();
  processingLock = false;
  setMicState('idle');
}

export const onProcessingDone = onMicProcessingDone;

export default {
  isRecording, startRecording, stopRecording, cancelRecording, releaseMicrophone, onMicError,
  getAudioBlob, playAudioFromUrl, getRecordingMimeType, prepareAudioForStt,
  isMicrophoneSupported, requestMicrophonePermission, setMicStateCallback,
  browserSpeechRecognition, getLiveSttText, clearLiveSttText,
  getMicState, setMicState, startMicSession, finishMicSession, onMicProcessingDone,
  onProcessingDone, isProcessingLocked, armRecordingFromUser, disarmRecordingFromUser,
  incrementMicFailCount, resetMicFailCount, checkMicFailFallback,
  isBrowserSttEnabled, disableBrowserSttOnly, abortLiveBrowserStt, isAndroid
};

function initMicPermissionPrompt() {
  const micButton = document.getElementById('micButton') || document.getElementById('mic-button');
  if (!micButton || !navigator.mediaDevices?.getUserMedia) return;

  micButton.setAttribute('autoplay', '');
  micButton.addEventListener('click', async () => {
    try {
      const permStream = await requestMicStream();
      permStream.getTracks().forEach((t) => t.stop());
      console.log('✅ Microphone permission granted');
    } catch (e) {
      console.error('Microphone denied:', e);
      window.ttsEngine?.speak('Нужно разрешить доступ к микрофону в настройках телефона.');
    }
  }, { once: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMicPermissionPrompt);
  } else {
    initMicPermissionPrompt();
  }
}
