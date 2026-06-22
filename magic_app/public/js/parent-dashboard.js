import { CONFIG, FEAR_LABELS, migrateFearStatsObject, getFearDisplayName } from './config.js';
import { safeParseJSON, getChildren } from './core.js';

let currentChildIndex = parseInt(localStorage.getItem('activeChildIndex') ?? '-1', 10);
if (Number.isNaN(currentChildIndex)) currentChildIndex = -1;

const ATTENTION_KEYWORDS = [
  'адрес', 'улица', 'дом', 'квартира', 'телефон', 'номер', 'звони',
  'страх', 'страшно', 'боюсь', 'обида', 'обидел', 'плачу', 'больно',
  'один', 'ушёл', 'ушла', 'бросил', 'помоги', 'убьют', 'фамилия', 'почта'
];

function getCurrentChildKey() {
  const children = getChildren();
  if (currentChildIndex < 0) return 'stats_guest';
  const child = children[currentChildIndex];
  return child ? `stats_${child.name}` : 'stats_guest';
}

function getChildStats() {
  const key = getCurrentChildKey();
  const data = safeParseJSON(localStorage.getItem(key), null);
  if (data) {
    data.fearStats = migrateFearStatsObject(data.fearStats);
    return data;
  }
  return {
    totalStories: parseInt(localStorage.getItem('totalStories') || '0', 10),
    totalGames: parseInt(localStorage.getItem('totalGames') || '0', 10),
    history: safeParseJSON(localStorage.getItem('history') || '[]', []),
    fearStats: migrateFearStatsObject(safeParseJSON(localStorage.getItem('fearStats') || '{}', {})),
    lastActive: new Date().toISOString()
  };
}

function childEmoji(role) {
  if (role === 'kid1') return '👦';
  if (role === 'kid2') return '👧';
  return '🐱';
}

function renderChildSelector() {
  const children = getChildren();
  const container = document.getElementById('childSelector');
  if (!container) return;

  let html = `<button class="child-chip ${currentChildIndex === -1 ? 'active' : ''}" data-index="-1">🐾 Гость</button>`;
  html += children.map((c, i) =>
    `<button class="child-chip ${i === currentChildIndex ? 'active' : ''}" data-index="${i}">${childEmoji(c.avatarRole)} ${c.name}, ${c.age} лет</button>`
  ).join('');

  container.innerHTML = html || '<span style="opacity:0.5;font-size:0.85rem;">Добавьте детей</span>';
  container.querySelectorAll('.child-chip').forEach(btn => {
    btn.addEventListener('click', () => selectChild(parseInt(btn.dataset.index, 10)));
  });
}

function selectChild(index) {
  currentChildIndex = index;
  localStorage.setItem('activeChildIndex', String(index));
  renderChildSelector();
  loadAllData();
}

function calculateActiveDays(history) {
  const days = new Set();
  history.forEach(h => {
    if (h.timestamp) days.add(new Date(h.timestamp).toDateString());
  });
  return days.size;
}

function renderProgress(fearStats, totalStories, totalGames) {
  const mainFearEntry = Object.entries(fearStats).sort((a, b) => b[1] - a[1])[0];
  const mainFear = mainFearEntry ? getFearDisplayName(mainFearEntry[0]) : '—';
  const mainFearCount = mainFearEntry ? mainFearEntry[1] : 0;

  let growth = 'Начинаем путь 🌱';
  if (totalStories >= 10 && totalGames >= 5) growth = 'Уверенный прогресс 🌿';
  else if (totalStories >= 5 || totalGames >= 3) growth = 'Первые шаги 🌱';
  else if (totalStories > 0) growth = 'Знакомство с Люциком 🐾';

  document.getElementById('progressContainer').innerHTML = `
    <div class="progress-card">
      <div class="stat-line"><span class="stat-label">Всего сказок</span><span class="stat-val">${totalStories}</span></div>
      <div class="stat-line"><span class="stat-label">Всего игр</span><span class="stat-val">${totalGames}</span></div>
      <div class="stat-line"><span class="stat-label">Самый частый страх</span><span class="stat-val">${mainFear} (${mainFearCount} раз)</span></div>
      <div class="stat-line"><span class="stat-label">Статус</span><span class="stat-val">${growth}</span></div>
    </div>
  `;
}

function renderWeekActivity(history) {
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const today = new Date();
  const weekData = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    weekData[d.toDateString()] = 0;
  }

  history.forEach(h => {
    if (h.timestamp) {
      const key = new Date(h.timestamp).toDateString();
      if (key in weekData) weekData[key]++;
    }
  });

  let html = '<div class="week-grid">';
  Object.entries(weekData).forEach(([key, count], idx) => {
    let cls = 'none';
    if (count > 3) cls = 'active';
    else if (count > 0) cls = 'partial';
    html += `<div class="week-day ${cls}" title="${dayNames[idx]}: ${count}">${dayNames[idx]}</div>`;
  });
  html += '</div>';
  document.getElementById('weekContainer').innerHTML = html;
}

function renderFears(fearStats) {
  const fears = Object.entries(FEAR_LABELS).map(([key, val]) => ({ key, ...val }));
  let maxFear = { key: '', val: 0 };
  let totalSessions = 0;
  let fearsHTML = '';

  fears.forEach(f => {
    const val = fearStats[f.key] || 0;
    totalSessions += val;
    if (val > maxFear.val) maxFear = { key: f.key, val };
    const displayVal = val > 0 ? Math.min(100, val * 20 + 10) : 5;
    fearsHTML += `
      <div class="fear-item">
        <div class="fear-header">
          <span class="name">${f.icon} ${f.name}</span>
          <span class="pct">${val} упоминаний</span>
        </div>
        <div class="bar-bg"><div class="bar-fill" style="width:${displayVal}%"></div></div>
      </div>
    `;
  });
  document.getElementById('fearsContainer').innerHTML = fearsHTML;

  let insightHTML = '';
  if (maxFear.val > 0) {
    insightHTML = `<div class="insight-box warn">🔍 Основной страх: <strong>${getFearDisplayName(maxFear.key)}</strong> (${maxFear.val} обращений).</div>`;
  }
  if (totalSessions > 10) {
    insightHTML += `<div class="insight-box good">✅ Всего ${totalSessions} тематических сессий — ребёнок открыто говорит о чувствах.</div>`;
  }
  document.getElementById('fearInsight').innerHTML = insightHTML;
}

function checkAttentionWords(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  return ATTENTION_KEYWORDS.filter(kw => lower.includes(kw));
}

function renderDialogs(history) {
  const recentHistory = history.slice(-15).reverse();
  const container = document.getElementById('dialogsContainer');
  if (recentHistory.length === 0) {
    container.innerHTML = '<div class="empty-state">Пока нет диалогов</div>';
    return;
  }

  container.innerHTML = recentHistory.map(h => {
    const date = new Date(h.timestamp || Date.now());
    const time = date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const isChild = h.role === 'child';
    const cls = isChild ? 'child' : 'lucik';
    const prefix = isChild ? '👶 Ребёнок' : (h.characterName ? `🐱 ${h.characterName}` : '🐱 Люцик');
    const attentionWords = !isChild ? (h.alertWords || checkAttentionWords(h.text)) : [];
    const isAlerted = h.alerted || attentionWords.length > 0;
    const text = (h.text || '').substring(0, 150);
    return `
      <div class="history-item ${cls} ${isAlerted ? 'alerted' : ''}">
        <div class="msg">${text}${(h.text && h.text.length > 150) ? '...' : ''}${isAlerted ? '<span class="alert-tag">⚠️</span>' : ''}</div>
        <div class="meta"><span>${prefix}</span><span>${time}</span></div>
      </div>
    `;
  }).join('');
}

function renderInsights(fearStats, totalStories, totalGames, history) {
  const totalSessions = Object.values(fearStats).reduce((a, b) => a + b, 0);
  let html = '';

  if (totalStories === 0 && totalGames === 0) {
    html = '<div class="empty-state">Недостаточно данных. Начните использовать приложение.</div>';
  } else {
    if (totalStories > 0) html += `<div class="insight-box good">📚 Создано <strong>${totalStories}</strong> сказок.</div>`;
    if (totalGames > 0) html += `<div class="insight-box good">🎮 Сыграно <strong>${totalGames}</strong> игр.</div>`;
    if (totalSessions > 0) {
      const topFear = Object.entries(fearStats).sort((a, b) => b[1] - a[1])[0];
      html += `<div class="insight-box">💬 ${totalSessions} обращений к страхам. Чаще: <strong>${topFear ? getFearDisplayName(topFear[0]) : '—'}</strong>.</div>`;
    }
    const attentionCount = history.filter(h => h.role !== 'child' && (h.alerted || checkAttentionWords(h.text).length > 0)).length;
    if (attentionCount > 0) {
      html += `<div class="insight-box warn">⚠️ ${attentionCount} ответов требуют внимания. Нажмите «Обрати внимание».</div>`;
    }
  }
  document.getElementById('insightsContainer').innerHTML = html || '<div class="empty-state">Недостаточно данных</div>';
}

function loadAllData() {
  const children = getChildren();
  const stats = getChildStats();
  const history = stats.history || [];
  const fearStats = stats.fearStats || migrateFearStatsObject({});
  const totalStories = stats.totalStories || 0;
  const totalGames = stats.totalGames || 0;

  document.getElementById('childrenNamesInput').value = localStorage.getItem('childrenNames') || '';

  const child = currentChildIndex >= 0 ? (children[currentChildIndex] || null) : null;
  document.getElementById('childInfo').textContent = child
    ? `${child.name}, ${child.age} лет`
    : 'Гость — общая статистика';

  document.getElementById('statsContainer').innerHTML = `
    <div class="row"><span class="label">📚 Создано сказок</span><span class="value">${totalStories}</span></div>
    <div class="row"><span class="label">🎮 Сыграно игр</span><span class="value">${totalGames}</span></div>
    <div class="row"><span class="label">💬 Всего диалогов</span><span class="value">${history.length}</span></div>
    <div class="row"><span class="label">🎯 Страхов в работе</span><span class="value">${Object.values(fearStats).filter(v => v > 0).length} из ${Object.keys(FEAR_LABELS).length}</span></div>
    <div class="row"><span class="label">📱 Дней активности</span><span class="value">${calculateActiveDays(history)}</span></div>
  `;

  renderProgress(fearStats, totalStories, totalGames);
  renderWeekActivity(history);
  renderFears(fearStats);
  renderDialogs(history);
  renderInsights(fearStats, totalStories, totalGames, history);
  renderChildSelector();
}

function saveChildrenNames() {
  const names = document.getElementById('childrenNamesInput').value.trim();
  if (!names) {
    alert('Введите имена детей');
    return;
  }

  const namesArr = names.split(',').map(n => n.trim()).filter(Boolean).slice(0, 3);
  const existing = getChildren();
  const updated = namesArr.map((name, i) => {
    const prev = existing.find(c => c.name === name) || existing[i];
    return {
      name,
      age: prev?.age || 5,
      index: i,
      gender: prev?.gender || 'unknown',
      avatarRole: prev?.avatarRole || 'lucik'
    };
  });

  localStorage.setItem('childrenNames', names);
  localStorage.setItem('children', JSON.stringify(updated));

  updated.forEach(child => {
    const key = `stats_${child.name}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({
        totalStories: 0,
        totalGames: 0,
        history: [],
        fearStats: { ...CONFIG.DEFAULT_FEAR_STATS },
        lastActive: new Date().toISOString()
      }));
    }
  });

  if (currentChildIndex >= updated.length) currentChildIndex = updated.length > 0 ? 0 : -1;
  localStorage.setItem('activeChildIndex', String(currentChildIndex));
  alert('✅ Имена сохранены!');
  loadAllData();
}

function showAttentionModal() {
  const history = getChildStats().history || [];
  const alertedItems = history.slice(-20).reverse()
    .filter(h => h.role !== 'child' && (h.alerted || checkAttentionWords(h.text).length > 0))
    .map(h => ({
      text: h.text,
      words: h.alertWords || checkAttentionWords(h.text),
      timestamp: h.timestamp,
      characterName: h.characterName || 'Люцик'
    }));

  const content = document.getElementById('attentionContent');
  if (alertedItems.length === 0) {
    content.innerHTML = '<div class="empty-state">✅ Нет подозрительных сообщений</div>';
  } else {
    content.innerHTML = alertedItems.map(item => {
      const time = new Date(item.timestamp || Date.now()).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `
        <div class="attention-item">
          <div class="attn-text">${(item.text || '').substring(0, 200)}</div>
          <div class="attn-meta">🐱 ${item.characterName} · ${time} · ${item.words.join(', ')}</div>
        </div>
      `;
    }).join('');
  }
  document.getElementById('attentionModal').style.display = 'flex';
}

window.selectChild = selectChild;
window.saveChildrenNames = saveChildrenNames;
window.showAttentionModal = showAttentionModal;

document.addEventListener('DOMContentLoaded', loadAllData);
