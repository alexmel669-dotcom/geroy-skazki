import { appState } from './core.js';
import { CONFIG } from './config.js';
import { showAchievementToast } from './ui.js';

// Определение всех достижений
export const ACHIEVEMENTS = {
  'first_talk': {
    name: '🎤 Первый разговор',
    description: 'Первый раз поговорил с Люциком',
    icon: '🎤',
    earned: false
  },
  'brave_kid': {
    name: '🦁 Храбрый малыш',
    description: 'Победил свой страх',
    icon: '🦁',
    earned: false
  },
  'story_lover': {
    name: '🌙 Сказочник',
    description: 'Послушал 10 сказок',
    icon: '🌙',
    earned: false,
    progress: 0,
    target: 10
  },
  'game_master': {
    name: '🎮 Игроман',
    description: 'Поиграл во все игры',
    icon: '🎮',
    earned: false,
    progress: 0,
    target: 5
  },
  'fish_catcher': {
    name: '🐟 Рыболов',
    description: 'Поймал 30 рыбок',
    icon: '🐟',
    earned: false,
    progress: 0,
    target: 30
  },
  'memory_champion': {
    name: '🧠 Чемпион памяти',
    description: 'Собрал все пары в Мемори',
    icon: '🧠',
    earned: false
  },
  'puzzle_solver': {
    name: '🧩 Мастер пазлов',
    description: 'Собрал пазл',
    icon: '🧩',
    earned: false
  },
  'artist': {
    name: '🎨 Художник',
    description: 'Раскрасил картинку',
    icon: '🎨',
    earned: false
  },
  'emotion_master': {
    name: '😊 Знаток эмоций',
    description: 'Угадал все эмоции',
    icon: '😊',
    earned: false
  },
  'bravery_100': {
    name: '💪 Супергерой',
    description: 'Достиг 100% храбрости',
    icon: '💪',
    earned: false
  },
  'fish_king': {
    name: '👑 Король рыбалки',
    description: 'Поймал 100 рыбок',
    icon: '👑',
    earned: false,
    progress: 0,
    target: 100
  }
};

// Получение ключа для localStorage
function getAchievementKey() {
  return `achievements_${appState.currentChildIndex === CONFIG.GUEST_INDEX ? 'guest' : appState.currentChildIndex}`;
}

// Инициализация достижений
export function initAchievements() {
  const key = getAchievementKey();
  
  if (!localStorage.getItem(key)) {
    const initial = {};
    Object.entries(ACHIEVEMENTS).forEach(([id, achievement]) => {
      initial[id] = { ...achievement };
    });
    localStorage.setItem(key, JSON.stringify(initial));
    console.log('✅ Достижения инициализированы');
  } else {
    // Проверяем и добавляем новые достижения
    const existing = JSON.parse(localStorage.getItem(key));
    let updated = false;
    
    Object.entries(ACHIEVEMENTS).forEach(([id, achievement]) => {
      if (!existing[id]) {
        existing[id] = { ...achievement };
        updated = true;
      }
    });
    
    if (updated) {
      localStorage.setItem(key, JSON.stringify(existing));
      console.log('✅ Добавлены новые достижения');
    }
  }
}

// Обновление прогресса достижения
export function updateAchievement(id, progress = null) {
  if (appState.currentChildIndex === CONFIG.GUEST_INDEX) return;
  
  const key = getAchievementKey();
  const achievements = JSON.parse(localStorage.getItem(key));
  
  if (!achievements || !achievements[id]) {
    console.warn(`Achievement ${id} not found`);
    return;
  }
  
  const achievement = achievements[id];
  
  // Если уже получено, не обновляем
  if (achievement.earned) return;
  
  if (progress !== null) {
    // Прогрессивное достижение
    achievement.progress = (achievement.progress || 0) + progress;
    
    if (achievement.progress >= achievement.target) {
      achievement.earned = true;
      achievement.earnedDate = new Date().toISOString();
      showAchievementToast(achievement.name);
      
      // Звуковое оповещение
      playAchievementSound();
      
      console.log(`🏆 Достижение получено: ${achievement.name}`);
    }
  } else {
    // Одноразовое достижение
    achievement.earned = true;
    achievement.earnedDate = new Date().toISOString();
    showAchievementToast(achievement.name);
    playAchievementSound();
    
    console.log(`🏆 Достижение получено: ${achievement.name}`);
  }
  
  localStorage.setItem(key, JSON.stringify(achievements));
}

// Звук получения достижения
function playAchievementSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    // Игнорируем ошибки аудио
  }
}

// Получение всех достижений
export function getAllAchievements() {
  const key = getAchievementKey();
  return JSON.parse(localStorage.getItem(key) || '{}');
}

// Получение статистики достижений
export function getAchievementStats() {
  const achievements = getAllAchievements();
  const total = Object.keys(achievements).length;
  const earned = Object.values(achievements).filter(a => a.earned).length;
  
  return {
    total,
    earned,
    percentage: total > 0 ? Math.round((earned / total) * 100) : 0
  };
}

// Проверка специальных условий
export function checkSpecialAchievements() {
  // Проверка храбрости
  if (appState.bravery >= 100) {
    updateAchievement('bravery_100');
  }
  
  // Проверка всех игр
  const achievements = getAllAchievements();
  const gameAchievements = ['memory_champion', 'puzzle_solver', 'artist', 'emotion_master', 'fish_catcher'];
  const allGamesPlayed = gameAchievements.every(id => achievements[id]?.earned);
  
  if (allGamesPlayed) {
    updateAchievement('game_master');
  }
}
