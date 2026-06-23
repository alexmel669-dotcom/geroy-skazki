import { getAnalyticsStats } from './analytics.js';

function loadLocalStats() {
  const role = localStorage.getItem('userRole');
  if (role !== 'admin' && role !== 'dev') {
    document.getElementById('adminDenied').style.display = 'block';
    document.getElementById('adminContent').style.display = 'none';
    return;
  }

  const analytics = getAnalyticsStats();
  const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
  const dayAgo = Date.now() - 86400000;
  const eventsLast24h = events.filter((e) => e.timestamp >= dayAgo).length;
  const alertEvents = events.filter((e) => e.name === 'alert').length;

  const children = JSON.parse(localStorage.getItem('children') || '[]');
  const ageBuckets = { '3-6': 0, '7-10': 0, '11-14': 0 };
  children.forEach((c) => {
    const age = c.age || 5;
    if (age <= 6) ageBuckets['3-6']++;
    else if (age <= 10) ageBuckets['7-10']++;
    else ageBuckets['11-14']++;
  });

  const gameCounts = {};
  const charCounts = {};
  events.forEach((e) => {
    if (e.name === 'game_selected') gameCounts[e.data] = (gameCounts[e.data] || 0) + 1;
    if (e.name === 'character_change') charCounts[e.data] = (charCounts[e.data] || 0) + 1;
  });

  const data = {
    totalUsers: 1,
    activeToday: eventsLast24h > 0 ? 1 : 0,
    totalChildren: children.length,
    totalDialogs: analytics.totalEvents,
    alertDialogs: alertEvents,
    eventsLast24h,
    ageBuckets,
    topGames: Object.entries(gameCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
    topCharacters: Object.entries(charCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  };

  document.getElementById('adminDenied').style.display = 'none';
  document.getElementById('adminContent').style.display = 'block';

  document.getElementById('statsGrid').innerHTML = `
    <div class="admin-stat-card"><div class="val">${data.totalUsers}</div><div class="lbl">Пользователей</div></div>
    <div class="admin-stat-card"><div class="val">${data.activeToday}</div><div class="lbl">Активны сегодня</div></div>
    <div class="admin-stat-card"><div class="val">${data.totalChildren}</div><div class="lbl">Детей в профилях</div></div>
    <div class="admin-stat-card"><div class="val">${data.totalDialogs}</div><div class="lbl">Событий / диалогов</div></div>
    <div class="admin-stat-card"><div class="val">${data.alertDialogs}</div><div class="lbl">Тревожных</div></div>
    <div class="admin-stat-card"><div class="val">${data.eventsLast24h}</div><div class="lbl">За 24 ч</div></div>
  `;

  const ages = data.ageBuckets || {};
  const games = (data.topGames || []).map(([n, c]) => `<li>${n}: ${c}</li>`).join('') || '<li>Нет данных</li>';
  const chars = (data.topCharacters || []).map(([n, c]) => `<li>${n}: ${c}</li>`).join('') || '<li>Нет данных</li>';

  document.getElementById('detailsBlock').innerHTML = `
    <h3 style="margin-top:0;">📊 Детали (локальные данные)</h3>
    <p><strong>Возраст:</strong> 3–6: ${ages['3-6'] || 0}, 7–10: ${ages['7-10'] || 0}, 11–14: ${ages['11-14'] || 0}</p>
    <p><strong>Топ игр:</strong></p><ul>${games}</ul>
    <p><strong>Популярные персонажи:</strong></p><ul>${chars}</ul>
  `;
}

document.getElementById('refreshStatsBtn')?.addEventListener('click', loadLocalStats);
document.addEventListener('DOMContentLoaded', loadLocalStats);
