import { appState } from './core.js';
import { CONFIG } from './config.js';

let currentAudio = null;
let audioUnlocked = false;
let audioContext = null;
let pendingSpeakPromise = null;

// Разблокировка аудио (должна вызываться при взаимодействии пользователя)
export function unlockAudio() {
  if (audioUnlocked) return;
  
  try {
    // Создаем AudioContext
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Воспроизводим тишину для разблокировки
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    
    audioContext.resume().then(() => {
      audioUnlocked = true;
      console.log('🔊 Аудио разблокировано');
    }).catch(error => {
      console.warn('Audio context resume failed:', error);
      audioUnlocked = true; // Все равно разрешаем попытки
    });
  } catch (error) {
    console.warn('Audio context creation failed:', error);
    audioUnlocked = true; // Fallback
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
    
    // Отменяем предыдущую речь
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    utterance.pitch = 1.0;
    
    const avatar = document.getElementById('avatar');
    let timeoutId;
    
    // Таймаут на случай зависания
    timeoutId = setTimeout(() => {
      console.warn('Speech synthesis timeout');
      if (avatar) avatar.classList.remove('talking');
      window.speechSynthesis.cancel();
      resolve();
    }, CONFIG.AUDIO_TIMEOUT);
    
    utterance.onstart = () => {
      console.log('🔊 Speaking (fallback):', text.substring(0, 50));
      if (avatar) avatar.classList.add('talking');
    };
    
    utterance.onend = () => {
      clearTimeout(timeoutId);
      if (avatar) avatar.classList.remove('talking');
      console.log('✅ Speech completed');
      resolve();
    };
    
    utterance.onerror = (event) => {
      clearTimeout(timeoutId);
      console.error('Speech synthesis error:', event.error);
      if (avatar) avatar.classList.remove('talking');
      resolve(); // Все равно резолвим, чтобы не блокировать UI
    };
    
    utterance.onpause = () => {
      console.log('Speech paused');
    };
    
    utterance.onresume = () => {
      console.log('Speech resumed');
    };
    
    window.speechSynthesis.speak(utterance);
  });
}

// Основная функция TTS через Яндекс
export async function speakWithYandex(text, voice = 'lucik') {
  // Если уже есть активный промис, ждем его
  if (pendingSpeakPromise) {
    await pendingSpeakPromise;
  }
  
  pendingSpeakPromise = new Promise(async (resolve) => {
    try {
      // Если аудио не разблокировано или нет сети, используем fallback
      if (!audioUnlocked || !navigator.onLine) {
        await fallbackSpeak(text);
        resolve();
        return;
      }
      
      // Останавливаем предыдущее аудио
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }
      
      console.log('🎤 Requesting TTS:', text.substring(0, 50));
      
      // Запрос к API с таймаутом
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
      
      const blob = await response.blob();
      
      if (!blob || blob.size < 100) {
        console.warn('TTS returned empty audio');
        await fallbackSpeak(text);
        resolve();
        return;
      }
      
      // Создаем и воспроизводим аудио
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      
      const avatar = document.getElementById('avatar');
      
      await new Promise((audioResolve, audioReject) => {
        const audioTimeout = setTimeout(() => {
          console.warn('Audio playback timeout');
          cleanup();
          audioReject(new Error('Playback timeout'));
        }, CONFIG.AUDIO_TIMEOUT);
        
        function cleanup() {
          clearTimeout(audioTimeout);
          URL.revokeObjectURL(url);
          currentAudio = null;
          if (avatar) avatar.classList.remove('talking');
        }
        
        audio.onplay = () => {
          console.log('▶️ Playing audio');
          if (avatar) avatar.classList.add('talking');
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
        
        audio.onpause = () => {
          if (audio.currentTime < audio.duration - 0.1) {
            console.log('⏸️ Audio paused');
          }
        };
        
        audio.play().catch(error => {
          console.error('Audio play failed:', error);
          cleanup();
          audioReject(error);
        });
      });
      
      resolve();
      
    } catch (error) {
      console.error('Yandex TTS error:', error.message);
      
      // Очищаем состояние
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      
      const avatar = document.getElementById('avatar');
      if (avatar) avatar.classList.remove('talking');
      
      // Используем fallback
      await fallbackSpeak(text);
      resolve();
    }
  });
  
  await pendingSpeakPromise;
  pendingSpeakPromise = null;
}

// Упрощенный интерфейс
export function speak(text) {
  if (!text) return Promise.resolve();
  return speakWithYandex(text, appState?.currentChar || 'lucik');
}

// Остановка воспроизведения
export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  const avatar = document.getElementById('avatar');
  if (avatar) avatar.classList.remove('talking');
  
  pendingSpeakPromise = null;
}

// Проверка статуса аудио
export function isAudioUnlocked() {
  return audioUnlocked;
}

// Очистка при уходе
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    stopSpeaking();
  });
  
  // Разблокируем аудио при первом взаимодействии
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
}
