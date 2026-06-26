import { bindNotificationSettingsUI, initNotificationScheduler, scheduleMissYouNotification } from './notifications.js';
import { logout, checkAuth } from './auth.js';
import { CONFIG, FEAR_LABELS, PLANS, migrateFearStatsObject, getFearDisplayName } from './config.js';
import { safeParseJSON, getChildren, getUserPlan, getStoriesRemaining, getPlanDaysRemaining, resetDailyCounters } from './core.js';
import { getGameProgressSummary } from './game-progress.js';

let pinAttempts = 0;
let pinLockedUntil = 0;

const TIME_LABELS = {
  morning: '🌅 Утро',
  day: '☀️ День',
  evening: '🌆 Вечер',
  night: '🌙 Ночь'
};

function renderTimeStats(history) {
  const container = document.getElementById('timeBarsContainer');
  const insightEl = document.getElementById('timeInsight');
  if (!container) return;

  const counts = { morning: 0, day: 0, evening: 0, night: 0 };
  (history || []).forEach((h) => {
    const part = h.timeOfDay || 'day';
    if (counts[part] !== undefined) counts[part]++;
  });

  const max = Math.max(...Object.values(counts), 1);
  container.innerHTML = Object.entries(TIME_LABELS).map(([key, label]) => {
    const val = counts[key] || 0;
    const pct = Math.round((val / max) * 100);
    return `<div class="time-bar" style="display:flex;align-items:center;gap:10px;margin:8px 0;">
      <span style="min-width:72px;font-size:0.85rem;">${label}</span>
      <div class="bar-bg" style="flex:1;"><div class="bar-fill-time" style="width:${pct}%"></div></div>
      <span style="min-width:24px;text-align:right;">${val}</span>
    </div>`;
  }).join('');

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const child = getChildren()[currentChildIndex];
  if (insightEl && top && top[1] > 0) {
    insightEl.style.display = 'block';
    insightEl.innerHTML = `💡 <strong>Заметили:</strong> ${child?.name || 'Ребёнок'} чаще всего общается с Люциком (${TIME_LABELS[top[0]]?.replace(/^[^\s]+\s/, '') || top[0]}). Попробуйте вечернюю сказку пораньше, если это вечер.`;
  }
}

async function getCurrentUser() {
  const token = localStorage.getItem('userToken');
  const children = getChildren();
  const child = currentChildIndex >= 0 ? children[currentChildIndex] : children[0];
  const fallback = {
    parentName: localStorage.getItem('parentName') || localStorage.getItem('userEmail')?.split('@')[0] || 'Родитель',
    username: localStorage.getItem('userEmail')?.split('@')[0] || 'Родитель',
    childName: child?.name || 'ребёнок'
  };
  if (!token || localStorage.getItem('guestMode') === 'true') return fallback;

  try {
    const res = await fetch('/api/profile-update', {
      credentials: 'include',
      headers: authHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      const u = data.user || {};
      if (u.parentName) localStorage.setItem('parentName', u.parentName);
      return {
        parentName: u.parentName || u.username || fallback.parentName,
        username: u.username || fallback.username,
        childName: child?.name || u.childName || u.children?.[0]?.name || fallback.childName
      };
    }
  } catch {
    /* local fallback */
  }
  return fallback;
}

async function updateParentGreeting() {
  const user = await getCurrentUser();
  const el = document.getElementById('parentGreeting');
  if (el) {
    el.textContent = `👋 Здравствуйте, ${user.parentName || user.username}!`;
  }
}

function getWeeklyStatsLocal() {
  const stats = getChildStats();
  const history = stats.history || [];
  const weekAgo = Date.now() - 7 * 86400000;
  const recent = history.filter((h) => new Date(h.timestamp || 0).getTime() > weekAgo);
  const totalChats = recent.filter((h) => h.role === 'child' || h.role === 'user').length;
  const totalStories = recent.filter((h) => h.type === 'story').length;
  const moods = recent.map((h) => h.mood).filter(Boolean);
  let mood = 'neutral';
  if (moods.filter((m) => m === 'positive').length > moods.length / 2) mood = 'happy';
  else if (moods.filter((m) => m === 'concerned').length > 0) mood = 'anxious';
  else if (moods.filter((m) => m === 'neutral').length === moods.length && moods.length) mood = 'neutral';
  const concerns = [...new Set(recent.flatMap((h) => h.alertWords || []).filter(Boolean))];
  return { totalChats, totalStories, mood, concerns };
}

function generateReportText(stats, parentName, childName) {
  const moodMap = {
    happy: 'хорошим',
    neutral: 'спокойным',
    sad: 'грустным',
    anxious: 'тревожным'
  };
  const mood = moodMap[stats.mood] || 'разным';
  const concernLine = stats.concerns?.length
    ? 'Были моменты, на которые стоит обратить внимание.'
    : 'Всё в порядке.';
  return [
    `${parentName}, здравствуйте!`,
    `На этой неделе ${childName} общался со мной ${stats.totalChats} раз.`,
    `Мы рассказали ${stats.totalStories} сказок.`,
    `Настроение было в основном ${mood}.`,
    concernLine,
    'Спасибо, что вы с нами!'
  ].join(' ');
}

async function fetchWeeklyStatsFromServer() {
  try {
    const res = await fetch('/api/weekly-stats', { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      totalChats: data.totalChats ?? 0,
      totalStories: data.totalStories ?? 0,
      mood: data.mood || 'neutral',
      concerns: data.concerns || []
    };
  } catch {
    return null;
  }
}

async function speakReport() {
  const btn = document.getElementById('speakReportBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Готовим...';
  }
  try {
    const user = await getCurrentUser();
    const stats = (await fetchWeeklyStatsFromServer()) || getWeeklyStatsLocal();
    const text = generateReportText(stats, user.parentName, user.childName);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ text, voice: 'jane' })
      });
      const data = await res.json();
      if (data.audioUrl) {
        await new Promise((resolve, reject) => {
          const audio = new Audio(data.audioUrl);
          audio.onended = resolve;
          audio.onerror = reject;
          audio.play().catch(reject);
        });
        return;
      }
    } catch {
      /* browser fallback */
    }

    if ('speechSynthesis' in window) {
      await new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.onend = resolve;
        utterance.onerror = resolve;
        window.speechSynthesis.speak(utterance);
      });
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🎤 Прослушать отчёт';
    }
  }
}

function authHeaders() {
  const token = localStorage.getItem('userToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function isChildToken() {
  try {
    const token = localStorage.getItem('userToken');
    if (!token) return false;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role === 'child' || payload.mode === 'child';
  } catch {
    return false;
  }
}

async function ensureParentAccess() {
  if (localStorage.getItem('childMode') === 'true' || isChildToken()) {
    window.location.href = 'app.html';
    return false;
  }
  if (localStorage.getItem('guestMode') === 'true') {
    window.location.href = 'login.html?redirect=parent';
    return false;
  }
  const authed = await checkAuth();
  if (!authed) {
    window.location.href = 'login.html?redirect=parent';
    return false;
  }
  return true;
}

async function enterParentCabinet() {
  if (!(await ensureParentAccess())) return;

  const sessionOk = sessionStorage.getItem('parentPinOk') === 'true';
  if (sessionOk) {
    document.getElementById('parentCabinet').style.display = 'block';
    loadAllData();
    return;
  }

  if (Date.now() < pinLockedUntil) {
    alert('Слишком много попыток. Попробуйте через 5 минут.');
    window.location.href = 'app.html';
    return;
  }

  try {
    const check = await fetch('/api/verify-pin', {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: JSON.stringify({ checkOnly: true })
    });
    if (check.status === 401) {
      window.location.href = 'login.html?redirect=parent';
      return;
    }
    const data = await check.json();
    if (data.noPin) {
      sessionStorage.setItem('parentPinOk', 'true');
      document.getElementById('parentCabinet').style.display = 'block';
      loadAllData();
      return;
    }
  } catch {
    /* show pin overlay */
  }

  document.getElementById('pinOverlay').style.display = 'flex';
  document.getElementById('parentCabinet').style.display = 'none';
}

async function verifyPinSubmit() {
  const pin = document.getElementById('pinInput')?.value.trim();
  const errEl = document.getElementById('pinError');
  if (!/^\d{4}$/.test(pin)) {
    errEl.textContent = 'Введите 4 цифры';
    errEl.style.display = 'block';
    return;
  }

  const res = await fetch('/api/verify-pin', {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
    body: JSON.stringify({ pin })
  });

  if (res.status === 401) {
    window.location.href = 'login.html?redirect=parent';
    return;
  }

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    pinLockedUntil = Date.now() + (data.waitSec || 300) * 1000;
    errEl.textContent = data.error || 'Слишком много попыток';
    errEl.style.display = 'block';
    return;
  }

  if (res.ok) {
    sessionStorage.setItem('parentPinOk', 'true');
    pinAttempts = 0;
    document.getElementById('pinOverlay').style.display = 'none';
    document.getElementById('parentCabinet').style.display = 'block';
    loadAllData();
    return;
  }

  const data = await res.json().catch(() => ({}));

  pinAttempts++;
  errEl.textContent = data.error || 'Неверный PIN';
  errEl.style.display = 'block';
  if (data.attemptsLeft === 0 || pinAttempts >= 3) {
    pinLockedUntil = Date.now() + 300000;
    pinAttempts = 0;
    alert('Слишком много попыток. Попробуйте через 5 минут.');
    window.location.href = 'app.html';
  }
}

async function connectChildDevice() {
  const res = await fetch('/api/child-token', {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders(),
    body: JSON.stringify({ childIndex: currentChildIndex >= 0 ? currentChildIndex : 0 })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Не удалось создать ссылку');
    return;
  }
  const qr = document.getElementById('childQrCode');
  const link = document.getElementById('childLink');
  if (qr) {
    qr.innerHTML = `<p style="font-size:0.85rem;opacity:0.8;">Скопируйте ссылку и откройте на телефоне ребёнка:</p>`;
  }
  if (link) {
    link.innerHTML = `<a href="${data.url}" style="color:var(--accent);word-break:break-all;" target="_blank">${data.url}</a>
      <button type="button" class="btn-save" style="margin-top:10px;width:100%;" id="copyChildLinkBtn">📋 Скопировать ссылку</button>`;
    document.getElementById('copyChildLinkBtn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(data.url);
        alert('Ссылка скопирована!');
      } catch {
        prompt('Скопируйте ссылку:', data.url);
      }
    });
  }
}

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
  if (role === 'kid1') return '👧';
  if (role === 'kid2') return '👦';
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
  const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const today = new Date();
  const weekEntries = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    weekEntries.push({ date: d, key: d.toDateString(), count: 0 });
  }

  history.forEach(h => {
    if (h.timestamp) {
      const key = new Date(h.timestamp).toDateString();
      const entry = weekEntries.find((w) => w.key === key);
      if (entry) entry.count++;
    }
  });

  let html = '<div class="week-grid">';
  weekEntries.forEach(({ date, count }) => {
    let cls = 'none';
    if (count > 3) cls = 'active';
    else if (count > 0) cls = 'partial';
    const label = dayLabels[date.getDay()];
    html += `<div class="week-day ${cls}" title="${date.toLocaleDateString('ru-RU')}: ${count}">${label}</div>`;
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

function renderGameProgress(childName) {
  const container = document.getElementById('gameProgressContainer');
  if (!container) return;
  const games = getGameProgressSummary(childName === 'Гость' ? 'guest' : childName);
  container.innerHTML = games.map((g) => {
    const pct = Math.min(100, Math.round((g.value / g.max) * 100));
    return `
      <div class="fear-item" style="margin-bottom:12px;">
        <div class="fear-header">
          <span class="name">${g.label}</span>
          <span class="pct">${g.detail}</span>
        </div>
        <div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

async function renderPlanInfo() {
  const container = document.getElementById('planInfoContainer');
  if (!container) return;
  resetDailyCounters();

  let planExpiry = localStorage.getItem('planExpiry');
  let promocodeUsed = localStorage.getItem('promocodeUsed');

  if (localStorage.getItem('guestMode') !== 'true') {
    try {
      const res = await fetch('/api/profile-update', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.user?.plan) localStorage.setItem('userPlan', data.user.plan);
        if (data.user?.planExpiry) {
          planExpiry = data.user.planExpiry;
          localStorage.setItem('planExpiry', planExpiry);
        }
        if (data.user?.promocodeUsed) {
          promocodeUsed = data.user.promocodeUsed;
          localStorage.setItem('promocodeUsed', promocodeUsed);
        }
        if (data.user?.parentName) {
          localStorage.setItem('parentName', data.user.parentName);
        }
      }
    } catch {
      /* local fallback */
    }
  }

  const planId = getUserPlan();
  const plan = PLANS[planId] || PLANS.free;
  const remaining = getStoriesRemaining();
  const used = plan.storiesPerDay - remaining;
  const daysLeft = getPlanDaysRemaining();

  let promoRow = '';
  if (promocodeUsed && planExpiry && daysLeft > 0 && planId !== 'free') {
    promoRow = `
      <div class="plan-row"><span class="label">Тестовый период</span><span class="value">Осталось ${daysLeft} дн.</span></div>
      <div class="plan-row"><span class="label">Промокод</span><span class="value">${promocodeUsed}</span></div>
      <a href="pricing.html" class="plan-change-btn">Продлить тариф</a>`;
  } else {
    promoRow = `<a href="pricing.html" class="plan-change-btn">Сменить тариф</a>`;
  }

  container.innerHTML = `
    <div class="plan-row"><span class="label">Тариф</span><span class="value">${plan.name}</span></div>
    <div class="plan-row"><span class="label">Сказок сегодня</span><span class="value">${used} / ${plan.storiesPerDay}</span></div>
    <div class="plan-row"><span class="label">Осталось</span><span class="value">${remaining}</span></div>
    <div class="plan-row"><span class="label">Память диалогов</span><span class="value">${plan.memoryDays} дн.</span></div>
    ${promoRow}
  `;
}

async function loadConcernsFromServer() {
  const local = safeParseJSON(localStorage.getItem('parentConcerns'), []) || [];
  if (localStorage.getItem('guestMode') === 'true') return local;
  try {
    const res = await fetch('/api/profile-update', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.user?.concerns?.length) return data.user.concerns;
    }
  } catch {
    /* use local */
  }
  return local;
}

async function renderPsychologistBlock() {
  const concerns = await loadConcernsFromServer();
  const block = document.getElementById('psychologistBlock');
  if (!block) return;
  if (!concerns.length) {
    block.style.display = 'none';
    return;
  }
  block.style.display = 'block';

  const btn = document.getElementById('getPsychologistHelp');
  const adviceEl = document.getElementById('psychologistAdvice');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Готовим рекомендации...';
    try {
      const childAge = parseInt(localStorage.getItem('profileChildAge') || '7', 10);
      const res = await fetch('/api/psychologist-help', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ concerns, childAge })
      });
      const data = await res.json();
      if (adviceEl && data.advice) {
        adviceEl.textContent = data.advice;
        adviceEl.style.display = 'block';
      }
    } catch {
      if (adviceEl) {
        adviceEl.textContent = 'Не удалось загрузить рекомендации. Попробуйте позже.';
        adviceEl.style.display = 'block';
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Получить рекомендации';
    }
  });
}

function loadAllData() {
  updateParentGreeting();
  renderPlanInfo();
  renderPsychologistBlock();
  bindNotificationSettingsUI();
  initNotificationScheduler().catch(() => {});
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
  renderGameProgress(child ? child.name : 'guest');
  renderWeekActivity(history);
  renderFears(fearStats);
  renderDialogs(history);
  renderInsights(fearStats, totalStories, totalGames, history);
  renderTimeStats(history);
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

document.getElementById('pinSubmitBtn')?.addEventListener('click', verifyPinSubmit);
document.getElementById('pinInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') verifyPinSubmit();
});
document.getElementById('connectChildDevice')?.addEventListener('click', connectChildDevice);
document.getElementById('speakReportBtn')?.addEventListener('click', speakReport);
document.getElementById('parentLogoutBtn')?.addEventListener('click', () => logout());
document.getElementById('weeklyDigestBtn')?.addEventListener('click', async () => {
  const res = await fetch('/api/weekly-digest', {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders()
  });
  const data = await res.json();
  alert(res.ok ? 'Отчёт отправлен на email!' : (data.error || 'Не удалось отправить'));
});

document.addEventListener('DOMContentLoaded', () => {
  enterParentCabinet();
  scheduleMissYouNotification();
});
