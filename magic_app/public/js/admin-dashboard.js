const ADMIN_CREDENTIALS = {
  email: 'admin@geroy-skazki.local',
  password: 'admintuti13'
};

const ADMIN_API_TOKEN = 'Bearer admin-token-v5.0.3';
const API = '/api/admin/full-stats';

const PLAN_LABELS = { free: 'Бесплатный', basic: 'Базовый', family: 'Семейный' };
const TIME_LABELS = {
  morning: '🌅 Утро',
  day: '☀️ День',
  evening: '🌆 Вечер',
  night: '🌙 Ночь'
};

function showDashboard() {
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  document.getElementById('adminLoadError').style.display = 'none';
}

function showLogin() {
  document.getElementById('adminLogin').style.display = 'flex';
  document.getElementById('adminDashboard').style.display = 'none';
}

function adminLogin() {
  const email = document.getElementById('adminEmail')?.value.trim();
  const password = document.getElementById('adminPassword')?.value;
  const errEl = document.getElementById('adminError');

  if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
    sessionStorage.setItem('admin-auth', 'true');
    errEl.textContent = '';
    showDashboard();
    loadAdminStats();
    return;
  }

  errEl.textContent = 'Неверный логин или пароль';
}

function adminLogout() {
  sessionStorage.removeItem('admin-auth');
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
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Отзывов пока нет</td></tr>';
    return;
  }
  tbody.innerHTML = feedbacks.map((f) => `
    <tr>
      <td>${escapeHtml((f.createdAt || '').split('T')[0] || '—')}</td>
      <td>${'★'.repeat(f.rating || 0)}</td>
      <td>${escapeHtml((f.text || '—').slice(0, 120))}</td>
      <td>${escapeHtml(f.page || '—')}</td>
      <td>${escapeHtml(f.email || 'guest')}</td>
    </tr>
  `).join('');
}

async function loadAdminStats() {
  const errEl = document.getElementById('adminLoadError');
  errEl.style.display = 'none';

  try {
    const res = await fetch(API, {
      headers: { Authorization: ADMIN_API_TOKEN }
    });

    if (res.status === 403) {
      errEl.textContent = 'Доступ к API запрещён';
      errEl.style.display = 'block';
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
    renderTimeOfDay(stats.timeOfDay);
    renderFeedbacks(stats.feedbacks);
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
  if (sessionStorage.getItem('admin-auth') === 'true') {
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
