import { appState } from './core.js';

let currentAudio = null;
let audioUnlocked = false;
let audioContext = null;

export function unlockAudio() {
  if (audioUnlocked) return;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().then(() => {
      audioUnlocked = true;
    }).catch(() => {
      console.warn('Audio context resume failed');
    });
  } catch (error) {
    console.warn('Audio context creation failed:', error);
    audioUnlocked = true; // Fallback
  }
}

function fallbackSpeak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    
    const avatar = document.getElementById('avatar');
    
    utterance.onstart = () => {
      if (avatar) avatar.classList.add('talking');
    };
    
    utterance.onend = () => {
      if (avatar) avatar.classList.remove('talking');
      resolve();
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      if (avatar) avatar.classList.remove('talking');
      resolve(); // Все равно резолвим, чтобы не блокировать
    };
    
    window.speechSynthesis.speak(utterance);
  });
}

export async function speakWithYandex(text, voice = 'lucik') {
  return new Promise(async (resolve) => {
    // Фолбек на Web Speech API если аудио не разблокировано
    if (!audioUnlocked) {
      await fallbackSpeak(text);
      resolve();
      return;
    }
    
    try {
      // Останавливаем предыдущее аудио
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          voice, 
          emotion: 'good', 
          speed: 1.0 
        })
      });
      
      if (!response.ok) {
        await fallbackSpeak(text);
        resolve();
        return;
      }
      
      const blob = await response.blob();
      
      if (!blob || blob.size < 100) {
        await fallbackSpeak(text);
        resolve();
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      
      const avatar = document.getElementById('avatar');
      
      // Оборачиваем play() в try-catch
      try {
        await new Promise((playResolve, playReject) => {
          audio.onplay = () => {
            if (avatar) avatar.classList.add('talking');
            playResolve();
          };
          
          audio.onended = () => {
            if (avatar) avatar.classList.remove('talking');
            URL.revokeObjectURL(url);
            currentAudio = null;
            playResolve();
            resolve();
          };
          
          audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            if (avatar) avatar.classList.remove('talking');
            URL.revokeObjectURL(url);
            currentAudio = null;
            playReject(e);
          };
          
          audio.play().catch(playReject);
        });
      } catch (playError) {
        // Если play() не удался, используем fallback
        if (avatar) avatar.classList.remove('talking');
        URL.revokeObjectURL(url);
        currentAudio = null;
        await fallbackSpeak(text);
        resolve();
      }
    } catch (error) {
      console.error('Yandex TTS error:', error);
      await fallbackSpeak(text);
      resolve();
    }
  });
}

export function speak(text) {
  return speakWithYandex(text, appState?.currentChar || 'lucik')
    .catch(() => fallbackSpeak(text));
}

// Очистка при уходе со страницы
window.addEventListener('beforeunload', () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
});
