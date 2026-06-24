// ========================================
// audio.js — СИНТЕЗ РЕЧИ (Yandex + браузер)
// ========================================

import { playAudioFromUrl } from './mic.js';
import { setAvatarState } from './ui.js';

let currentUtterance = null;
let speechQueue = [];
let isSpeaking = false;

async function browserSpeech(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }

    if (currentUtterance) window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    utterance.onstart = () => {
      console.log('🔊 Speaking (browser):', text.substring(0, 50) + '...');
      isSpeaking = true;
    };
    utterance.onend = () => {
      isSpeaking = false;
      currentUtterance = null;
      resolve();
      processQueue();
    };
    utterance.onerror = () => {
      isSpeaking = false;
      currentUtterance = null;
      resolve();
      processQueue();
    };

    currentUtterance = utterance;
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    }, 100);
  });
}

export async function synthesizeSpeech(text, character = 'lucik') {
  if (!text || typeof text !== 'string') {
    console.warn('synthesizeSpeech: empty text');
    return;
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: character })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.audioUrl) {
        isSpeaking = true;
        setAvatarState('speaking');
        await playAudioFromUrl(data.audioUrl);
        isSpeaking = false;
        setAvatarState(null);
        processQueue();
        return;
      }
    } else {
      const data = await response.json().catch(() => ({}));
      console.warn('⚠️ TTS API error:', response.status, data.error || '');
    }
  } catch (err) {
    console.warn('⚠️ TTS API failed, using browser speech:', err);
  }

  await browserSpeech(text);
}

export function stopSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  currentUtterance = null;
  isSpeaking = false;
  speechQueue = [];
}

export function queueSpeech(text, character = 'lucik') {
  speechQueue.push({ text, character });
  if (!isSpeaking) processQueue();
}

async function processQueue() {
  if (speechQueue.length === 0 || isSpeaking) return;
  const next = speechQueue.shift();
  await synthesizeSpeech(next.text, next.character);
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
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
  return voices.find((voice) => voice.lang.includes('ru')) || null;
}

export function speak(text, character = 'lucik') {
  return synthesizeSpeech(text, character);
}

export default {
  synthesizeSpeech, speak, stopSpeech, queueSpeech, isSpeechSupported, getAvailableVoices, setRussianVoice
};
