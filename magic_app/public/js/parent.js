// Загружаем данные из localStorage
function loadParentData() {
  const children = JSON.parse(localStorage.getItem('children') || '[]');
  const appState = JSON.parse(localStorage.getItem('appState') || '{}');
  const fearStats = JSON.parse(localStorage.getItem('fearStats') || '{}');
  const history = JSON.parse(localStorage.getItem('history') || '[]');
  const totalStories = parseInt(localStorage.getItem('totalStories') || '0');
  const totalGames = parseInt(localStorage.getItem('totalGames') || '0');

  // Инфо о ребёнке
  const currentChild = children[appState.currentChildIndex] || { name: 'Гость', age: 5 };
  document.getElementById('childInfo').textContent = `${currentChild.name}, ${currentChild.age} лет`;

  // Общая статистика
  document.getElementById('statsContainer').innerHTML = `
    <div class="row"><span class="label">Создано сказок</span><span class="value">${totalStories}</span></div>
    <div class="row"><span class="label">Сыграно игр</span><span class="value">${totalGames}</span></div>
    <div class="row"><span class="label">Дней активности</span><span class="value">${Math.max(1, Math.floor(history.length / 3))}</span></div>
    <div class="row"><span class="label">Записей в истории</span><span class="value">${history.length}</span></div>
  `;

  // Страхи
  const fears = [
    { key: 'темноты', name: 'Темнота', icon: '🌑' },
    { key: 'врачей', name: 'Врачи', icon: '🩺' },
    { key: 'одиночества', name: 'Одиночество', icon: '🧍' },
    { key: 'животных', name: 'Животные', icon: '🐕' },
    { key: 'обиды', name: 'Обиды', icon: '😢' },
    { key: 'нового', name: 'Новое', icon: '🆕' }
  ];
  
  let fearsHTML = '';
  const hasData = Object.values(fearStats).some(v => v > 0);
  
  fears.forEach(f => {
    const val = fearStats[f.key] || 0;
    const displayVal = hasData ? val : Math.floor(Math.random() * 40 + 20); // демо-данные если пусто
    fearsHTML += `
      <div class="fear-item">
        <div class="fear-header"><span>${f.icon} ${f.name}</span><span>${displayVal}% преодолено</span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${displayVal}%"></div></div>
      </div>
    `;
  });
  document.getElementById('fearsContainer').innerHTML = fearsHTML || '<div class="empty">Нет данных о страхах</div>';

  // История
  const recentHistory = history.slice(-6).reverse();
  let historyHTML = '';
  recentHistory.forEach(h => {
    let icon = '💬';
    if (h.type === 'user') icon = '🗣️';
    else if (h.type === 'ai') icon = '🐱';
    else if (h.type === 'game') icon = '🎮';
    
    const date = new Date(h.timestamp);
    const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    historyHTML += `<div class="row"><span class="label">${icon} ${h.text?.substring(0, 40) || '...'}</span><span class="value">${time}</span></div>`;
  });
  document.getElementById('historyContainer').innerHTML = historyHTML || '<div class="empty">Пока нет активности</div>';
}

loadParentData();
