import { CONFIG, CHARACTERS } from './config.js';

export const appState = {
  children: [],
  currentChildIndex: 0,
  childName: 'малыш',
  childAge: 5,
  mood: 70,
  hunger: 60,
  energy: 50,
  bravery: 0,
  fishScore: 0,
  storyCount: 0,
  fearStats: { ...CONFIG.DEFAULT_FEAR_STATS },
  conversationHistory: [],
  currentChar: 'lucik',
  isPremium: false,
  isListening: false,
  isWaiting: false,
  gameActive: false,
  gameInterval: null,
  gameTimerInterval: null,
  memoryCards: [],
  memoryFlipped: [],
  memoryLocked: false,
  memoryMatches: 0,
  appVersion: CONFIG.APP_VERSION
};

// Инициализация состояния
function initializeState() {
  try {
    // Загружаем детей
    const savedChildren = localStorage.getItem('children');
    if (savedChildren) {
      const parsed = JSON.parse(savedChildren);
      if (Array.isArray(parsed) && parsed.length > 0) {
        appState.children = parsed;
      }
    }

    // Загружаем индекс текущего ребенка
    const savedIndex = localStorage.getItem('currentChildIndex');
    if (savedIndex !== null) {
      appState.currentChildIndex = parseInt(savedIndex, 10);
      if (isNaN(appState.currentChildIndex) || 
          appState.currentChildIndex >= appState.children.length) {
        appState.currentChildIndex = 0;
      }
    }

    // Если детей нет, создаем дефолтного
    if (appState.children.length === 0) {
      const oldName = localStorage.getItem('childName') || 'малыш';
      const oldAge = parseInt(localStorage.getItem('childAge') || '5', 10);
      appState.children = [{ 
        name: oldName, 
        age: oldAge, 
        gender: 'boy',
        created: new Date().toISOString()
      }];
      appState.currentChildIndex = 0;
      saveChildrenToStorage();
    }

    // Загружаем премиум статус
    appState.isPremium = localStorage.getItem('isPremium') === 'true';

    // Загружаем выбранного персонажа
    const savedChar = localStorage.getItem('currentCharacter');
    if (savedChar && CHARACTERS[savedChar]) {
      appState.currentChar = savedChar;
    }

    // Проверяем размер localStorage
    checkStorageSize();

  } catch (error) {
    console.error('Failed to initialize state:', error);
    // Сбрасываем к дефолтным значениям
    appState.children = [{ name: 'малыш', age: 5, gender: 'boy', created: new Date().toISOString() }];
    appState.currentChildIndex = 0;
    saveChildrenToStorage();
  }
}

function saveChildrenToStorage() {
  try {
    localStorage.setItem('children', JSON.stringify(appState.children));
    localStorage.setItem('currentChildIndex', appState.currentChildIndex.toString());
  } catch (error) {
    console.error('Failed to save children:', error);
  }
}

function checkStorageSize() {
  try {
    const size = new Blob(Object.values(localStorage)).size;
    if (size > CONFIG.MAX_LOCAL_STORAGE_SIZE) {
      console.warn('LocalStorage near capacity, cleaning old data...');
      cleanOldData();
    }
  } catch (e) {
    console.warn('Cannot check storage size');
  }
}

function cleanOldData() {
  try {
    // Оставляем только последние 5 записей истории для каждого ребенка
    appState.children.forEach((child, index) => {
      const historyKey = `storyHistory_${index}`;
      try {
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        if (history.length > 5) {
          localStorage.setItem(historyKey, JSON.stringify(history.slice(-5)));
        }
      } catch (e) {
        localStorage.removeItem(historyKey);
      }
    });
  } catch (error) {
    console.error('Failed to clean storage:', error);
  }
}

export function getCurrentChild() {
  if (appState.currentChildIndex === CONFIG.GUEST_INDEX) {
    return { name: 'гость', age: 5, gender: 'unknown', isGuest: true };
  }
  
  if (appState.currentChildIndex >= appState.children.length) {
    appState.currentChildIndex = 0;
  }
  
  return appState.children[appState.currentChildIndex] || 
         { name: 'малыш', age: 5, gender: 'boy' };
}

export function loadChildData(index) {
  const idx = index === CONFIG.GUEST_INDEX ? CONFIG.GUEST_INDEX : (index || 0);
  
  if (idx === CONFIG.GUEST_INDEX) {
    // Гостевой режим - чистые данные
    appState.fearStats = { ...CONFIG.DEFAULT_FEAR_STATS };
    appState.conversationHistory = [];
    appState.mood = 70;
    appState.hunger = 60;
    appState.energy = 50;
    appState.bravery = 0;
    appState.fishScore = 0;
    appState.storyCount = 0;
    return;
  }

  try {
    // Загружаем страхи
    const fearData = localStorage.getItem(`fearStats_${idx}`);
    appState.fearStats = fearData ? 
      { ...CONFIG.DEFAULT_FEAR_STATS, ...JSON.parse(fearData) } : 
      { ...CONFIG.DEFAULT_FEAR_STATS };

    // Загружаем историю с миграцией старого формата
    const rawHistory = localStorage.getItem(`storyHistory_${idx}`);
    if (rawHistory) {
      try {
        const parsed = JSON.parse(rawHistory);
        
        // Миграция со старого формата (массив строк)
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          appState.conversationHistory = parsed.map(item => {
            const colonIndex = item.indexOf(':');
            if (colonIndex > 0) {
              const prefix = item.substring(0, colonIndex);
              const content = item.substring(colonIndex + 1).trim();
              return {
                role: prefix.includes('👶') ? 'user' : 'assistant',
                content: content
              };
            }
            return { role: 'user', content: item };
          });
          // Сохраняем в новом формате
          localStorage.setItem(`storyHistory_${idx}`, JSON.stringify(appState.conversationHistory));
        } else {
          appState.conversationHistory = parsed;
        }
      } catch (parseError) {
        console.error('Failed to parse history:', parseError);
        appState.conversationHistory = [];
        localStorage.setItem(`storyHistory_${idx}`, '[]');
      }
    } else {
      appState.conversationHistory = [];
    }

    // Загружаем статы
    appState.mood = parseInt(localStorage.getItem(`lucik_mood_${idx}`) || '70', 10);
    appState.hunger = parseInt(localStorage.getItem(`lucik_hunger_${idx}`) || '60', 10);
    appState.energy = parseInt(localStorage.getItem(`lucik_energy_${idx}`) || '50', 10);
    appState.bravery = parseInt(localStorage.getItem(`lucik_bravery_${idx}`) || '0', 10);
    appState.fishScore = parseInt(localStorage.getItem(`fishScore_${idx}`) || '0', 10);
    appState.storyCount = parseInt(localStorage.getItem(`storyCount_${idx}`) || '0', 10);

    // Валидация значений
    appState.mood = Math.min(100, Math.max(0, appState.mood));
    appState.hunger = Math.min(100, Math.max(0, appState.hunger));
    appState.energy = Math.min(100, Math.max(0, appState.energy));
    appState.bravery = Math.min(100, Math.max(0, appState.bravery));

  } catch (error) {
    console.error(`Failed to load child data for index ${idx}:`, error);
    resetChildData(idx);
  }
}

function resetChildData(idx) {
  appState.fearStats = { ...CONFIG.DEFAULT_FEAR_STATS };
  appState.conversationHistory = [];
  appState.mood = 70;
  appState.hunger = 60;
  appState.energy = 50;
  appState.bravery = 0;
  appState.fishScore = 0;
  appState.storyCount = 0;
  saveChildData(idx);
}

export function saveChildData(index) {
  if (index === CONFIG.GUEST_INDEX) {
    return; // Не сохраняем гостевые данные
  }
  
  const idx = index ?? appState.currentChildIndex;
  
  try {
    const data = {
      fearStats: appState.fearStats,
      history: appState.conversationHistory.slice(-CONFIG.MAX_HISTORY),
      mood: appState.mood,
      hunger: appState.hunger,
      energy: appState.energy,
      bravery: appState.bravery,
      fishScore: appState.fishScore,
      storyCount: appState.storyCount
    };

    localStorage.setItem(`fearStats_${idx}`, JSON.stringify(data.fearStats));
    localStorage.setItem(`storyHistory_${idx}`, JSON.stringify(data.history));
    localStorage.setItem(`lucik_mood_${idx}`, data.mood.toString());
    localStorage.setItem(`lucik_hunger_${idx}`, data.hunger.toString());
    localStorage.setItem(`lucik_energy_${idx}`, data.energy.toString());
    localStorage.setItem(`lucik_bravery_${idx}`, data.bravery.toString());
    localStorage.setItem(`fishScore_${idx}`, data.fishScore.toString());
    localStorage.setItem(`storyCount_${idx}`, data.storyCount.toString());

  } catch (error) {
    console.error(`Failed to save child data for index ${idx}:`, error);
    
    if (error.name === 'QuotaExceededError') {
      handleStorageFull(idx);
    }
  }
}

function handleStorageFull(idx) {
  try {
    // Оставляем только последние 5 записей истории
    appState.conversationHistory = appState.conversationHistory.slice(-5);
    localStorage.setItem(`storyHistory_${idx}`, JSON.stringify(appState.conversationHistory));
    
    // Удаляем старые данные игр
    for (let i = 0; i < appState.children.length; i++) {
      if (i !== idx) {
        try {
          const history = JSON.parse(localStorage.getItem(`storyHistory_${i}`) || '[]');
          if (history.length > 10) {
            localStorage.setItem(`storyHistory_${i}`, JSON.stringify(history.slice(-10)));
          }
        } catch (e) {
          localStorage.removeItem(`storyHistory_${i}`);
        }
      }
    }
  } catch (e) {
    console.error('Failed to recover from storage full:', e);
  }
}

export function saveHistory(role, content) {
  if (!role || !content) return;
  
  appState.conversationHistory.push({ 
    role, 
    content,
    timestamp: Date.now()
  });
  
  if (appState.conversationHistory.length > CONFIG.MAX_HISTORY) {
    appState.conversationHistory = appState.conversationHistory.slice(-CONFIG.MAX_HISTORY);
  }
  
  saveChildData(appState.currentChildIndex);
}

export function updateFear(fear) {
  if (appState.currentChildIndex === CONFIG.GUEST_INDEX) return;
  
  if (appState.fearStats[fear] !== undefined) {
    appState.fearStats[fear] = (appState.fearStats[fear] || 0) + 1;
    appState.bravery = Math.min(100, appState.bravery + 10);
    saveChildData(appState.currentChildIndex);
    updateStatsUI();
    
    // Проверяем ачивки
    import('./achievements.js').then(module => {
      module.updateAchievement('brave_kid');
    }).catch(() => {});
  }
}

export function updateStatsUI() {
  const elements = {
    moodFill: document.getElementById('moodFill'),
    hungerFill: document.getElementById('hungerFill'),
    energyFill: document.getElementById('energyFill'),
    braveryFill: document.getElementById('braveryFill')
  };
  
  if (elements.moodFill) elements.moodFill.style.width = appState.mood + '%';
  if (elements.hungerFill) elements.hungerFill.style.width = appState.hunger + '%';
  if (elements.energyFill) elements.energyFill.style.width = appState.energy + '%';
  if (elements.braveryFill) elements.braveryFill.style.width = appState.bravery + '%';
}

export function updateChildNameLabel() {
  const label = document.getElementById('childNameLabel');
  if (!label) return;
  
  if (appState.currentChildIndex === CONFIG.GUEST_INDEX) {
    label.textContent = '🐱 Кто здесь?';
    return;
  }
  
  const child = getCurrentChild();
  label.textContent = `${child.name}, ${child.age} ${getAgeWord(child.age)}`;
}

function getAgeWord(age) {
  if (age % 10 === 1 && age % 100 !== 11) return 'год';
  if ([2, 3, 4].includes(age % 10) && ![12, 13, 14].includes(age % 100)) return 'года';
  return 'лет';
}

export function applyChildSwitch() {
  if (appState.currentChildIndex === CONFIG.GUEST_INDEX) {
    appState.childName = 'гость';
    appState.childAge = 5;
    appState.currentChar = 'lucik';
    loadChildData(CONFIG.GUEST_INDEX);
    updateAvatar();
    updateChildNameLabel();
    updateStatsUI();
  } else {
    const index = appState.currentChildIndex;
    localStorage.setItem('currentChildIndex', index.toString());
    
    const child = getCurrentChild();
    appState.childName = child.name;
    appState.childAge = child.age;
    
    loadChildData(index);
    updateAvatar();
    updateChildNameLabel();
    updateStatsUI();
  }
  
  syncToServer().catch(console.error);
}

function updateAvatar() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  
  const character = CHARACTERS[appState.currentChar];
  if (character && character.icon) {
    avatar.style.backgroundImage = `url('${character.icon}')`;
    avatar.onerror = () => {
      avatar.style.backgroundImage = "url('avatar.png')";
    };
  }
}

export function switchChild(index) {
  if (index === appState.currentChildIndex) return;
  
  if (appState.children.length <= 1 && index !== CONFIG.GUEST_INDEX) {
    console.log('No other children to switch to');
    return;
  }
  
  // Сохраняем данные текущего ребенка
  saveChildData(appState.currentChildIndex);
  
  // Переключаемся
  appState.currentChildIndex = index;
  applyChildSwitch();
}

export async function syncToServer() {
  const guestMode = localStorage.getItem('guestMode') === 'true';
  if (guestMode || appState.currentChildIndex === CONFIG.GUEST_INDEX) return;
  
  const token = getCookie('token');
  if (!token) return;
  
  try {
    const response = await fetch('/api/sync-child-data', {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        childName: appState.childName,
        childAge: appState.childAge,
        character: appState.currentChar,
        fearStats: appState.fearStats,
        bravery: appState.bravery,
        mood: appState.mood,
        hunger: appState.hunger,
        energy: appState.energy,
        conversationHistory: appState.conversationHistory.slice(-CONFIG.SYNC_HISTORY_LENGTH),
        syncedAt: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
    
    console.log('✅ Данные синхронизированы с сервером');
  } catch (error) {
    console.warn('⚠️ Ошибка синхронизации:', error.message);
  }
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Периодическая синхронизация
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (appState.currentChildIndex !== CONFIG.GUEST_INDEX) {
      syncToServer().catch(() => {});
    }
  }, 300000); // Каждые 5 минут
}

// Инициализация при загрузке
initializeState();
