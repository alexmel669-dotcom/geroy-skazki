const API = '/api/admin/full-stats';

const PLAN_LABELS = { free: 'Бесплатный', basic: 'Базовый', family: 'Семейный' };
const TIME_LABELS = {
  morning: '🌅 Утро',
  day: '☀️ День',
  evening: '🌆 Вечер',
  night: '🌙 Ночь'
};

function getAdminToken() {
  return sessionStorage.getItem('admin-token') || '';
}

function showDashboard() {
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  document.getElementById('adminLoadError').style.display = 'none';
}

function showLogin() {
  document.getElementById('adminLogin').style.display = 'flex';
  document.getElementById('adminDashboard').style.display = 'none';
}

async function adminLogin() {
  const email = document.getElementById('adminEmail')?.value.trim();
  const password = document.getElementById('adminPassword')?.value;
  const errEl = document.getElementById('adminError');
  const btn = document.getElementById('adminLoginBtn');

  if (!email || !password) {
    errEl.textContent = 'Введите email и пароль';
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Вход...';
  }
  errEl.textContent = '';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      const data = await res.json();
      sessionStorage.setItem('admin-auth', 'true');
      sessionStorage.setItem('admin-token', data.token);
      showDashboard();
      loadAdminStats();
      return;
    }

    errEl.textContent = 'Неверный логин или пароль';
  } catch {
    errEl.textContent = 'Ошибка сети. Попробуйте позже.';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Войти';
    }
  }
}

function adminLogout() {
  sessionStorage.removeItem('admin-auth');
  sessionStorage.removeItem('admin-token');
  document.getElementById('adminPassword').value = '';
  document.getElementById('adminError').textContent = '';
  showLogin();
}

function renderObjectBarChart(container, dataObj) {
  if (!container) return;
  const items = Object.entries(dataObj || {}).map(([date, count]) => ({
    label: new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' }),
    count
  }));
  const max = Math.max(...items.map((i) => i.count), 1);
  container.innerHTML = items.map((item) => {
    const h = Math.max(4, Math.round((item.count / max) * 100));
    return `<div class="bar" style="height:${h}%" title="${item.label}: ${item.count}"><span class="bar-value">${item.count}</span><span class="bar-label">${item.label}</span></div>`;
  }).join('');
}

function renderPlans(plans) {
  const el = document.getElementById('plansBreakdown');
  if (!el) return;
  const total = Object.values(plans || {}).reduce((a, b) => a + b, 0) || 1;
  const colors = { free: '#888', basic: '#6C63FF', family: '#ffb800' };
  el.innerHTML = Object.entries(plans || {}).map(([key, val]) => {
    const pct = Math.round((val / total) * 100);
    return `<div class="plan-row"><span class="plan-dot" style="background:${colors[key] || '#666'}"></span><span>${PLAN_LABELS[key] || key}</span><strong>${val}</strong><span class="plan-pct">${pct}%</span></div>`;
  }).join('');
}

function renderChildrenTable(children) {
  const tbody = document.querySelector('#childrenTable tbody');
  if (!tbody) return;
  if (!children?.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Нет данных</td></tr>';
    return;
  }
  tbody.innerHTML = children.map((c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(String(c.age))}</td>
      <td>${escapeHtml(String(c.gender))}</td>
      <td>${escapeHtml(c.parentEmail)}</td>
      <td>${escapeHtml(c.plan || 'free')}</td>
      <td>${c.streak || 0}</td>
      <td>${escapeHtml(c.lastLogin || '—')}</td>
    </tr>
  `).join('');
}

function renderGameUsage(gameUsage) {
  const el = document.getElementById('gameUsage');
  if (!el) return;
  const entries = Object.entries(gameUsage || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    el.innerHTML = '<div class="empty-state">Нет данных об играх</div>';
    return;
  }
  el.innerHTML = entries.map(([name, count]) => `
    <div class="admin-list-row"><span>${escapeHtml(name)}</span><strong>${count}</strong></div>
  `).join('');
}

function renderTimeOfDay(timeOfDay) {
  const el = document.getElementById('timeOfDay');
  if (!el) return;
  const max = Math.max(...Object.values(timeOfDay || {}), 1);
  el.innerHTML = Object.entries(TIME_LABELS).map(([key, label]) => {
    const val = timeOfDay?.[key] || 0;
    const pct = Math.round((val / max) * 100);
    return `<div class="time-bar-row"><span>${label}</span><div class="bar-bg"><div class="bar-fill-time" style="width:${pct}%"></div></div><span>${val}</span></div>`;
  }).join('');
}

function renderStreakLeaders(leaders) {
  const el = document.getElementById('streakLeaders');
  if (!el) return;
  if (!leaders?.length) {
    el.innerHTML = '<div class="empty-state">Streak пока не синхронизирован с сервером</div>';
    return;
  }
  el.innerHTML = leaders.map((c, i) => `
    <div class="admin-list-row"><span>${i + 1}. ${escapeHtml(c.name)} (${escapeHtml(c.parentEmail)})</span><strong>🔥 ${c.streak}</strong></div>
  `).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderFeedbacks(feedbacks) {
  const tbody = document.querySelector('#feedbacksTable tbody');
  if (!tbody) return;
  if (!feedbacks?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Отзывов пока нет</td></tr>';
    return;
  }
  tbody.innerHTML = feedbacks.map((f, i) => `
    <tr>
      <td>${escapeHtml(new Date(f.timestamp || f.date || f.createdAt || Date.now()).toLocaleString('ru-RU'))}</td>
      <td>${'⭐'.repeat(Math.min(5, Math.max(1, f.rating || 5)))}</td>
      <td>${escapeHtml((f.text || '—').slice(0, 120))}${f.adminReply ? `<br><small>💬 ${escapeHtml(f.adminReply)}</small>` : ''}</td>
      <td>${escapeHtml(f.page || '—')}</td>
      <td>${escapeHtml(f.name || f.email || 'guest')}</td>
      <td><button type="button" class="modal-btn" style="padding:4px 8px;font-size:0.75rem;" onclick="replyToFeedback(${i})">Ответить</button></td>
    </tr>
  `).join('');
}

async function replyToFeedback(index) {
  const reply = prompt('Ваш ответ:');
  if (!reply) return;
  try {
    await fetch('/api/admin/feedback-reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAdminToken()
      },
      body: JSON.stringify({ index, reply })
    });
    loadAdminStats();
  } catch (e) {
    console.error('Reply error:', e);
  }
}

window.replyToFeedback = replyToFeedback;

async function loadThanks() {
  try {
    const res = await fetch('/api/admin-thanks', {
      headers: { Authorization: getAdminToken() }
    });
    if (!res.ok) return;
    const thanks = await res.json();

    document.getElementById('thanksList').innerHTML = thanks.length > 0
      ? thanks.map((t) => `
        <div class="thanks-item">
          <div class="thanks-message">💬 "${escapeHtml(t.message)}"</div>
          <div class="thanks-meta">
            👤 ${escapeHtml(t.userName)}, ${escapeHtml(String(t.userAge || '?'))} лет · ${escapeHtml(new Date(t.date).toLocaleString('ru-RU'))}
          </div>
        </div>
      `).join('')
      : '<p>Пока никто не сказал спасибо 😿</p>';
  } catch (e) {
    console.error('Thanks load error:', e);
  }
}

async function loadAdminStats() {
  const errEl = document.getElementById('adminLoadError');
  const token = getAdminToken();
  if (!token) {
    adminLogout();
    return;
  }

  errEl.style.display = 'none';

  try {
    const res = await fetch(API, {
      headers: { Authorization: token }
    });

    if (res.status === 403) {
      errEl.textContent = 'Сессия администратора истекла. Войдите снова.';
      errEl.style.display = 'block';
      adminLogout();
      return;
    }

    if (!res.ok) {
      errEl.textContent = 'Ошибка загрузки статистики';
      errEl.style.display = 'block';
      return;
    }

    const stats = await res.json();

    document.getElementById('totalUsers').textContent = stats.total ?? 0;
    document.getElementById('dau').textContent = stats.dau ?? 0;
    document.getElementById('mau').textContent = stats.mau ?? 0;
    document.getElementById('dialogsToday').textContent = stats.dialogsToday ?? 0;
    document.getElementById('newToday').textContent = stats.newToday ?? 0;
    document.getElementById('newThisWeek').textContent = stats.newThisWeek ?? 0;
    document.getElementById('totalChildren').textContent = stats.totalChildren ?? 0;
    document.getElementById('avgSession').textContent = `${stats.avgSessionMinutes ?? 12} мин`;
    document.getElementById('suspicious').textContent = stats.suspiciousCount ?? 0;
    document.getElementById('statsUpdated').textContent = stats.updatedAt
      ? `Обновлено: ${new Date(stats.updatedAt).toLocaleString('ru-RU')}`
      : '';

    renderObjectBarChart(document.getElementById('registrationsChart'), stats.registrationsByDay);
    renderObjectBarChart(document.getElementById('loginsChart'), stats.loginsByDay);
    renderPlans(stats.plans);
    renderStreakLeaders(stats.streakLeaders);
    renderChildrenTable(stats.children);
    renderGameUsage(stats.gameUsage);
    const games = stats.gameUsage || {};
    const popularEl = document.getElementById('popularGames');
    if (popularEl) {
      popularEl.innerHTML = Object.entries(games)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([g, c]) => `<div class="admin-list-row">🎮 ${escapeHtml(g)}: ${c}</div>`)
        .join('') || '<div class="empty-state">Нет данных об играх</div>';
    }
    renderTimeOfDay(stats.timeOfDay);
    renderFeedbacks(stats.feedbacks);
    loadThanks();
  } catch (error) {
    console.error('Admin stats error:', error);
    errEl.textContent = 'Ошибка сети при загрузке статистики';
    errEl.style.display = 'block';
  }
}

document.getElementById('adminLoginBtn')?.addEventListener('click', adminLogin);
document.getElementById('adminPassword')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') adminLogin();
});
document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);
document.getElementById('refreshStatsBtn')?.addEventListener('click', loadAdminStats);

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('admin-auth') === 'true' && getAdminToken()) {
    showDashboard();
    loadAdminStats();
  } else {
    showLogin();
  }
});

window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.loadAdminStats = loadAdminStats;

export { adminLogin, adminLogout, loadAdminStats };
