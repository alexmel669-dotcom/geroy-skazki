import { CONFIG } from './config.js';
import { 
  appState, getCurrentChild, loadChildData, saveChildData, 
  saveHistory, updateFear, updateChildNameLabel, updateStatsUI 
} from './core.js';
import { askDeepSeek } from './ai.js';
import { speak } from './audio.js';

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isProcessing = false;

if (SpeechRec) {
  try {
    recognition = new SpeechRec();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;
  } catch (e) {
    console.warn('Speech recognition not available:', e);
  }
}

export function initMic() {
  const micBtn = document.getElementById('micBtn');
  if (!micBtn || !recognition) {
    if (micBtn) micBtn.style.display = 'none';
    return;
  }

  micBtn.onclick = () => {
    if (isProcessing) {
      console.log('Already processing a request');
      return;
    }
    
    if (appState.isListening) {
      return;
    }
    
    startListening();
  };

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript.trim();
    if (!text) {
      stopListening();
      return;
    }
    
    stopListening();
    isProcessing = true;
    
    try {
      await processUserInput(text);
    } catch (error) {
      console.error('Error processing input:', error);
      speak("Ой, что-то пошло не так. Давай ещё раз!");
    } finally {
      isProcessing = false;
    }
  };

  recognition.onerror = (event) => {
    console.log('Speech recognition error:', event.error);
    stopListening();
    
    if (event.error === 'no-speech') {
      // Не говорим ничего, просто перестаем слушать
    } else if (event.error === 'aborted') {
      // Пользователь отменил
    } else {
      speak("Не расслышал, скажи ещё раз!");
    }
  };

  recognition.onend = () => {
    stopListening();
  };
}

async function processUserInput(text) {
  saveHistory('user', text);
  
  // Проверка гостевого режима
  if (appState.currentChildIndex === CONFIG.GUEST_INDEX) {
    const lowerText = text.toLowerCase();
    const foundIndex = appState.children.findIndex(child => 
      lowerText.includes(child.name.toLowerCase())
    );
    
    if (foundIndex >= 0) {
      // Сохраняем гостевые данные перед переключением
      const child = appState.children[foundIndex];
      appState.currentChildIndex = foundIndex;
      appState.childName = child.name;
      appState.childAge = child.age;
      
      localStorage.setItem('currentChildIndex', foundIndex.toString());
      loadChildData(foundIndex);
      updateChildNameLabel();
      updateStatsUI();
      
      const answer = `${child.name}! Привет! Как у тебя дела?`;
      saveHistory('assistant', answer);
      await speak(answer);
      return;
    }
  }
  
  // Определение страхов
  const lowerText = text.toLowerCase();
  const fearKeywords = {
    'темноты': ['темно', 'темнота', 'темный', 'тьма'],
    'врачей': ['врач', 'укол', 'больница', 'доктор'],
    'одиночества': ['один', 'одна', 'скучно', 'никого'],
    'обиды': ['обид', 'обидел', 'плачу'],
    'животных': ['собака', 'собаку', 'животн', 'зверь']
  };
  
  for (const [fear, keywords] of Object.entries(fearKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      updateFear(fear);
      break;
    }
  }
  
  // Получение ответа от ИИ
  const answer = await askDeepSeek(text, false);
  saveHistory('assistant', answer);
  await speak(answer);
}

function startListening() {
  if (isProcessing || appState.isListening) return;
  
  try {
    appState.isListening = true;
    const micBtn = document.getElementById('micBtn');
    const avatar = document.getElementById('avatar');
    
    if (micBtn) micBtn.classList.add('recording');
    if (avatar) avatar.classList.add('listening');
    
    recognition.start();
  } catch (error) {
    console.error('Failed to start recognition:', error);
    stopListening();
  }
}

function stopListening() {
  appState.isListening = false;
  const micBtn = document.getElementById('micBtn');
  const avatar = document.getElementById('avatar');
  
  if (micBtn) micBtn.classList.remove('recording');
  if (avatar) avatar.classList.remove('listening');
  
  try {
    recognition.stop();
  } catch (e) {
    // Игнорируем ошибки остановки
  }
}
