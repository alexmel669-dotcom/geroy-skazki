// В функции инициализации:
try {
  const saved = localStorage.getItem('children');
  if (saved) appState.children = JSON.parse(saved);
  appState.currentChildIndex = parseInt(localStorage.getItem('currentChildIndex') || '0');
  if (appState.currentChildIndex >= appState.children.length) {
    appState.currentChildIndex = 0;
  }
} catch (error) {
  console.error('Failed to load children data:', error);
  appState.children = [];
  appState.currentChildIndex = 0; // Исправлено: сбрасываем индекс
}

// Исправление saveChildData
export function saveChildData(index) {
  if (index === CONFIG.GUEST_INDEX) {
    console.log('Guest data not saved (as designed)');
    return;
  }
  
  const idx = index ?? appState.currentChildIndex;
  
  try {
    localStorage.setItem(`fearStats_${idx}`, JSON.stringify(appState.fearStats));
    localStorage.setItem(`storyHistory_${idx}`, JSON.stringify(appState.conversationHistory));
    localStorage.setItem(`lucik_mood_${idx}`, appState.mood.toString());
    localStorage.setItem(`lucik_hunger_${idx}`, appState.hunger.toString());
    localStorage.setItem(`lucik_energy_${idx}`, appState.energy.toString());
    localStorage.setItem(`lucik_bravery_${idx}`, appState.bravery.toString());
    localStorage.setItem(`fishScore_${idx}`, appState.fishScore.toString());
    localStorage.setItem(`storyCount_${idx}`, appState.storyCount.toString());
  } catch (error) {
    console.error('Failed to save child data:', error);
    // Если localStorage переполнен, очищаем старые истории
    if (error.name === 'QuotaExceededError') {
      try {
        appState.conversationHistory = appState.conversationHistory.slice(-10);
        localStorage.setItem(`storyHistory_${idx}`, JSON.stringify(appState.conversationHistory));
      } catch (e) {
        console.error('Failed to recover from quota error:', e);
      }
    }
  }
}
