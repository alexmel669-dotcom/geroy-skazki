import { appState } from './core.js';
import { CONFIG } from './config.js';

let currentAudio = null;
let audioUnlocked = false;
let audioContext = null;
let pendingSpeakPromise = null;

// Разблокировка аудио
export function unlockAudio() {
  if (audioUnlocked) return;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    
    audioContext.resume().then(() => {
      audioUnlocked = true;
      console.log('🔊 Аудио разблокировано');
    }).catch(() => {
      audioUnlocked = true;
    });
  } catch (error) {
    console.warn('Audio context creation failed:', error);
    audioUnlocked = true;
  }
}

// Fallback через Web Speech API
function fallbackSpeak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not available');
      resolve();
      return;
    }
    
    // Не отменяем предыдущую речь, даём доиграть
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    utterance.pitch = 1.0;
    
    const avatar = document.getElementById('avatar');
    let timeoutId;
    let resolved = false;
    
    function finish() {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      if (avatar) avatar.classList.remove('talking');
      resolve();
    }
    
    timeoutId = setTimeout(() => {
      console.warn('Speech synthesis timeout');
      finish();
    }, CONFIG.AUDIO_TIMEOUT);
    
    utterance.onstart = () => {
      console.log('🔊 Speaking (fallback):', text.substring(0, 50));
      if (avatar) avatar.classList.add('talking');
    };
    
    utterance.onend = () => {
      console.log('✅ Speech completed');
      finish();
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      finish();
    };
    
    window.speechSynthesis.speak(utterance);
  });
}

// Конвертация base64 в Blob
function base64ToBlob(base64, mimeType = 'audio/mp3') {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Основная функция TTS через Яндекс
export async function speakWithYandex(text, voice = 'alena') {
  if (pendingSpeakPromise) {
    await pendingSpeakPromise;
  }
  
  pendingSpeakPromise = new Promise(async (resolve) => {
    try {
      if (!audioUnlocked || !navigator.onLine) {
        await fallbackSpeak(text);
        resolve();
        return;
      }
      
      // Останавливаем предыдущее аудио
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        URL.revokeObjectURL(currentAudio.src);
        currentAudio = null;
      }
      
      console.log('🎤 Requesting TTS:', text.substring(0, 50));
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          voice, 
          emotion: 'good', 
          speed: 1.0 
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn('TTS API error:', response.status);
        await fallbackSpeak(text);
        resolve();
        return;
      }
      
      // Парсим JSON ответ
      const data = await response.json();
      
      if (!data.audioUrl) {
        console.warn('TTS returned empty audio');
        await fallbackSpeak(text);
        resolve();
        return;
      }
      
      // Извлекаем base64 из data URL и создаём Blob URL
      const base64 = data.audioUrl.split(',')[1];
      const blob = base64ToBlob(base64);
      const blobUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(blobUrl);
      currentAudio = audio;
      
      const avatar = document.getElementById('avatar');
      
      await new Promise((audioResolve, audioReject) => {
        let audioResolved = false;
        
        function cleanup() {
          if (audioResolved) return;
          audioResolved = true;
          clearTimeout(audioTimeout);
          URL.revokeObjectURL(blobUrl);
          currentAudio = null;
          if (avatar) avatar.classList.remove('talking');
        }
        
        const audioTimeout = setTimeout(() => {
          console.warn('Audio playback timeout');
          cleanup();
          audioReject(new Error('Playback timeout'));
        }, CONFIG.AUDIO_TIMEOUT);
        
        audio.oncanplaythrough = () => {
          console.log('▶️ Audio ready, playing...');
          if (avatar) avatar.classList.add('talking');
          audio.play().catch(err => {
            console.error('Audio play failed:', err);
            cleanup();
            audioReject(err);
          });
        };
        
        audio.onended = () => {
          console.log('✅ Audio completed');
          cleanup();
          audioResolve();
        };
        
        audio.onerror = (e) => {
          console.error('Audio error:', e.target?.error?.message || 'Unknown error');
          cleanup();
          audioReject(e);
        };
        
        // Начинаем загрузку
        audio.load();
      });
      
      resolve();
      
    } catch (error) {
      console.error('Yandex TTS error:', error.message);
      
      if (currentAudio) {
        currentAudio.pause();
        URL.revokeObjectURL(currentAudio.src);
        currentAudio = null;
      }
      
      const avatar = document.getElementById('avatar');
      if (avatar) avatar.classList.remove('talking');
      
      await fallbackSpeak(text);
      resolve();
    }
  });
  
  await pendingSpeakPromise;
  pendingSpeakPromise = null;
}

export function speak(text) {
  if (!text) return Promise.resolve();
  return speakWithYandex(text, appState?.currentChar || 'alena');
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    URL.revokeObjectURL(currentAudio.src);
    currentAudio = null;
  }
  
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  const avatar = document.getElementById('avatar');
  if (avatar) avatar.classList.remove('talking');
  
  pendingSpeakPromise = null;
}

export function isAudioUnlocked() {
  return audioUnlocked;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    stopSpeaking();
  });
  
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
}
