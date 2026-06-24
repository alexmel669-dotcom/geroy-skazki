const API = '/api/admin/stats';

function renderBarChart(container, items, valueKey = 'count') {
  if (!container) return;
  const max = Math.max(...items.map((i) => i[valueKey] || 0), 1);
  container.innerHTML = items.map((item) => {
    const h = Math.max(4, Math.round(((item[valueKey] || 0) / max) * 100));
    return `<div class="bar" style="height:${h}%" title="${item.label}: ${item[valueKey]}"><span class="bar-value">${item[valueKey]}</span><span class="bar-label">${item.label}</span></div>`;
  }).join('');
}

function renderPieChart(container, plans) {
  if (!container) return;
  const total = Object.values(plans).reduce((a, b) => a + b, 0) || 1;
  const colors = { free: '#888', basic: '#6C63FF', family: '#ffb800' };
  const labels = { free: 'Бесплатный', basic: 'Базовый', family: 'Семейный' };

  container.innerHTML = Object.entries(plans).map(([key, val]) => {
    const pct = Math.round((val / total) * 100);
    return `<div class="pie-row"><span class="pie-dot" style="background:${colors[key] || '#666'}"></span><span>${labels[key] || key}</span><strong>${val}</strong><span class="pie-pct">${pct}%</span></div>`;
  }).join('');
}

async function loadStats() {
  const token = localStorage.getItem('userToken');
  const role = localStorage.getItem('userRole');

  if (role !== 'admin' && !token) {
    window.location.href = 'login.html';
    return;
  }

  const res = await fetch(API, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (res.status === 403) {
    document.getElementById('adminDenied').style.display = 'block';
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('adminDenied').textContent = 'Доступ запрещён. Только для администраторов.';
    return;
  }

  if (!res.ok) {
    document.getElementById('adminDenied').textContent = 'Ошибка загрузки статистики';
    document.getElementById('adminDenied').style.display = 'block';
    return;
  }

  const data = await res.json();
  document.getElementById('adminDenied').style.display = 'none';
  document.getElementById('adminContent').style.display = 'block';

  document.getElementById('statsGrid').innerHTML = `
    <div class="admin-stat-card"><div class="val">${data.dau ?? data.activeToday ?? 0}</div><div class="lbl">DAU</div></div>
    <div class="admin-stat-card"><div class="val">${data.mau ?? 0}</div><div class="lbl">MAU</div></div>
    <div class="admin-stat-card"><div class="val">${data.total ?? data.totalUsers ?? 0}</div><div class="lbl">Пользователей</div></div>
    <div class="admin-stat-card"><div class="val">${data.newThisWeek ?? 0}</div><div class="lbl">Новых за 7 дн.</div></div>
    <div class="admin-stat-card"><div class="val">${data.conversion ?? 0}%</div><div class="lbl">Конверсия</div></div>
    <div class="admin-stat-card"><div class="val">${data.avgSession ?? '—'}</div><div class="lbl">Ср. сессия</div></div>
    <div class="admin-stat-card"><div class="val">${data.totalChildren ?? 0}</div><div class="lbl">Детей</div></div>
    <div class="admin-stat-card"><div class="val">${data.eventsLast24h ?? 0}</div><div class="lbl">Событий / 24ч</div></div>
  `;

  renderBarChart(document.getElementById('dauChart'), data.dauByDay || []);
  renderBarChart(document.getElementById('registrationsChart'), data.registrationsByDay || []);
  renderPieChart(document.getElementById('plansChart'), data.plans || {});

  const ages = data.ageBuckets || {};
  const games = (data.topGames || []).map(([n, c]) => `<li>${n}: ${c}</li>`).join('') || '<li>Нет данных</li>';
  const chars = (data.topCharacters || []).map(([n, c]) => `<li>${n}: ${c}</li>`).join('') || '<li>Нет данных</li>';

  document.getElementById('detailsBlock').innerHTML = `
    <h3 style="margin-top:0;">📊 Детали</h3>
    <p><strong>Возраст:</strong> 3–6: ${ages['3-6'] || 0}, 7–10: ${ages['7-10'] || 0}, 11–14: ${ages['11-14'] || 0}</p>
    <p><strong>Топ игр:</strong></p><ul>${games}</ul>
    <p><strong>Популярные персонажи:</strong></p><ul>${chars}</ul>
    <p style="opacity:0.5;font-size:0.8rem;">Обновлено: ${new Date(data.updatedAt || Date.now()).toLocaleString('ru-RU')}</p>
  `;
}

document.getElementById('refreshStatsBtn')?.addEventListener('click', loadStats);
document.addEventListener('DOMContentLoaded', loadStats);
