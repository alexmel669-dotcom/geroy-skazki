// ========================================
// audio.js — TTSEngine (Yandex + браузер)
// ========================================

import { playAudioFromUrl } from './mic.js';
import { setAvatarState } from './ui.js';

const VOICE_PITCH = { lucik: 1.2, mom: 1.4, dad: 0.8, kid1: 1.6, kid2: 1.5 };

class TTSEngine {
  constructor() {
    this.unlocked = false;
    this.queue = [];
    this.isSpeaking = false;
    this.hintEl = null;
    this._boundUnlock = this.initBrowserTTS.bind(this);
  }

  initBrowserTTS() {
    if (this.unlocked) return;
    this.unlocked = true;
    document.removeEventListener('click', this._boundUnlock, true);
    document.removeEventListener('touchstart', this._boundUnlock, true);
    document.removeEventListener('keydown', this._boundUnlock, true);
    this._hideHint();
    this._flushQueue();
  }

  _ensureUnlockListeners() {
    if (this.unlocked) return;
    document.addEventListener('click', this._boundUnlock, true);
    document.addEventListener('touchstart', this._boundUnlock, true);
    document.addEventListener('keydown', this._boundUnlock, true);
  }

  _showHint() {
    if (this.hintEl) return;
    this.hintEl = document.createElement('div');
    this.hintEl.className = 'tts-unlock-hint';
    this.hintEl.textContent = '🔊 Нажмите на экран для звука';
    document.body.appendChild(this.hintEl);
    requestAnimationFrame(() => this.hintEl?.classList.add('visible'));
  }

  _hideHint() {
    if (!this.hintEl) return;
    this.hintEl.classList.remove('visible');
    setTimeout(() => { this.hintEl?.remove(); this.hintEl = null; }, 300);
  }

  async speak(text, characterId = 'lucik') {
    if (!text || typeof text !== 'string') return;

    if (!this.unlocked) {
      this.queue.push({ text, characterId });
      this._ensureUnlockListeners();
      this._showHint();
      return;
    }

    if (this.isSpeaking) {
      this.queue.push({ text, characterId });
      return;
    }

    this.isSpeaking = true;
    try {
      const yandexOk = await this._speakYandex(text, characterId);
      if (!yandexOk) await this._speakBrowser(text, characterId);
    } finally {
      this.isSpeaking = false;
      setAvatarState(null);
      this._flushQueue();
    }
  }

  async _flushQueue() {
    if (!this.unlocked || this.isSpeaking || !this.queue.length) return;
    const next = this.queue.shift();
    await this.speak(next.text, next.characterId);
  }

  async _speakYandex(text, characterId) {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('userToken') : null;
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ text, voice: characterId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioUrl) {
          setAvatarState('speaking');
          await playAudioFromUrl(data.audioUrl);
          return true;
        }
      } else {
        const data = await response.json().catch(() => ({}));
        console.warn('⚠️ Yandex TTS failed, using browser:', response.status, data.error || '');
      }
    } catch (err) {
      console.warn('⚠️ Yandex TTS failed, using browser:', err.message);
    }
    return false;
  }

  _speakBrowser(text, characterId) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = 0.9;
      utterance.pitch = VOICE_PITCH[characterId] ?? 1.1;
      utterance.volume = 1;

      utterance.onstart = () => {
        setAvatarState('speaking');
        console.log('🔊 Speaking (browser):', text.slice(0, 50));
      };
      utterance.onend = () => resolve();
      utterance.onerror = () => {
        console.warn('⚠️ Browser TTS failed');
        resolve();
      };

      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          resolve();
        }
      }, 50);
    });
  }

  stop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this.queue = [];
    this.isSpeaking = false;
    setAvatarState(null);
  }
}

export const ttsEngine = new TTSEngine();

if (typeof window !== 'undefined') {
  window.ttsEngine = ttsEngine;
  ttsEngine._ensureUnlockListeners();
}

export async function synthesizeSpeech(text, character = 'lucik') {
  return ttsEngine.speak(text, character);
}

export function stopSpeech() {
  ttsEngine.stop();
}

export function queueSpeech(text, character = 'lucik') {
  ttsEngine.queue.push({ text, character });
  if (!ttsEngine.isSpeaking) ttsEngine.speak(text, character).catch(() => {});
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
    if (voices.length) resolve(voices);
    else {
      window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
      setTimeout(() => resolve([]), 1000);
    }
  });
}

export async function setRussianVoice() {
  const voices = await getAvailableVoices();
  return voices.find((v) => v.lang.includes('ru')) || null;
}

export function speak(text, character = 'lucik') {
  return ttsEngine.speak(text, character);
}

export default {
  ttsEngine, synthesizeSpeech, speak, stopSpeech, queueSpeech, isSpeechSupported, getAvailableVoices, setRussianVoice
};
