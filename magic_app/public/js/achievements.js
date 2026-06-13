// ========================================
// achievements.js — СИСТЕМА ДОСТИЖЕНИЙ
// ========================================

// Список достижений
const ACHIEVEMENTS = {
  first_story: {
    id: 'first_story',
    title: '📖 Первая сказка',
    description: 'Послушать первую сказку',
    condition: (stats) => stats.totalStories >= 1,
    icon: '🌟'
  },
  story_master: {
    id: 'story_master',
    title: '🎭 Мастер сказок',
    description: 'Послушать 10 сказок',
    condition: (stats) => stats.totalStories >= 10,
    icon: '👑'
  },
  fish_master: {
    id: 'fish_master',
    title: '🎣 Мастер рыбалки',
    description: 'Поймать 10 рыб в игре',
    condition: (stats) => false, // Проверяется отдельно в игре
    icon: '🐟'
  },
  brave_child: {
    id: 'brave_child',
    title: '🦁 Храбрый ребенок',
    description: 'Победить 5 страхов',
    condition: (stats) => {
      const fears = stats.fearStats || {};
      let totalFears = 0;
      for (let key in fears) {
        totalFears += fears[key];
      }
      return totalFears >= 5;
    },
    icon: '🦁'
  },
  game_master: {
    id: 'game_master',
    title: '🎮 Любитель игр',
    description: 'Сыграть в 5 игр',
    condition: (stats) => stats.totalGames >= 5,
    icon: '🎮'
  },
  active_child: {
    id: 'active_child',
    title: '⚡ Активный ребенок',
    description: 'Провести 7 дней с приложением',
    condition: (stats) => {
      const activeDays = Math.ceil((Date.now() - (stats.lastActive || Date.now())) / (1000 * 60 * 60 * 24));
      return activeDays >= 7;
    },
    icon: '⚡'
  }
};

// Полученные достижения
let unlockedAchievements = new Set();

// Инициализация загруженных достижений
function loadAchievements() {
  try {
    const saved = localStorage.getItem('unlockedAchievements');
    if (saved) {
      const arr = JSON.parse(saved);
      unlockedAchievements = new Set(arr);
    }
  } catch (e) {
    console.warn('Failed to load achievements', e);
  }
}

// Сохранение достижений
function saveAchievements() {
  try {
    const arr = Array.from(unlockedAchievements);
    localStorage.setItem('unlockedAchievements', JSON.stringify(arr));
  } catch (e) {
    console.warn('Failed to save achievements', e);
  }
}

// Показать уведомление о достижении
export function showAchievement(achievementId, customMessage = null) {
  // Проверяем, не получено ли уже
  if (unlockedAchievements.has(achievementId)) return;
  
  // Получаем данные о достижении
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement && !customMessage) return;
  
  // Добавляем в полученные
  unlockedAchievements.add(achievementId);
  saveAchievements();
  
  // Создаем уведомление
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.5s ease;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: inherit;
    max-width: 300px;
  `;
  
  const icon = achievement?.icon || '🏆';
  const title = customMessage || achievement?.title || 'Достижение получено!';
  const desc = achievement?.description || '';
  
  notification.innerHTML = `
    <span style="font-size: 32px;">${icon}</span>
    <div>
      <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
      ${desc ? `<div style="font-size: 12px; opacity: 0.9;">${desc}</div>` : ''}
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Анимация появления
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Удаляем через 3 секунды
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.5s ease reverse';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
  
  // Сохраняем в историю
  try {
    const history = JSON.parse(localStorage.getItem('achievementsHistory') || '[]');
    history.push({
      id: achievementId,
      title: title,
      timestamp: Date.now()
    });
    localStorage.setItem('achievementsHistory', JSON.stringify(history.slice(-50)));
  } catch (e) {}
}

// Проверить все достижения
export function checkAchievements() {
  try {
    const stats = JSON.parse(localStorage.getItem('stats_guest') || '{}');
    
    // Проверяем каждое достижение
    for (let id in ACHIEVEMENTS) {
      const achievement = ACHIEVEMENTS[id];
      
      // Пропускаем уже полученные
      if (unlockedAchievements.has(id)) continue;
      
      // Проверяем условие
      if (achievement.condition && achievement.condition(stats)) {
        showAchievement(id);
      }
    }
  } catch (e) {
    console.warn('Failed to check achievements', e);
  }
}

// Получить все достижения
export function getAllAchievements() {
  const all = [];
  for (let id in ACHIEVEMENTS) {
    all.push({
      ...ACHIEVEMENTS[id],
      unlocked: unlockedAchievements.has(id)
    });
  }
  return all;
}

// Получить статистику достижений
export function getAchievementStats() {
  const total = Object.keys(ACHIEVEMENTS).length;
  const unlocked = unlockedAchievements.size;
  return {
    total,
    unlocked,
    percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0
  };
}

// Инициализация
loadAchievements();

// Добавляем стили глобально
if (typeof document !== 'undefined') {
  if (!document.querySelector('#achievements-styles')) {
    const style = document.createElement('style');
    style.id = 'achievements-styles';
    style.textContent = `
      .achievement-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.5s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: inherit;
        max-width: 300px;
      }
      
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
