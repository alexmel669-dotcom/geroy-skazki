const API = '/api/admin/stats';



async function loadStats() {

  const token = localStorage.getItem('userToken');

  const res = await fetch(API, {

    credentials: 'include',

    headers: token ? { Authorization: `Bearer ${token}` } : {}

  });



  if (res.status === 403) {

    document.getElementById('adminDenied').style.display = 'block';

    document.getElementById('adminContent').style.display = 'none';

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

    <h3 style="margin-top:0;">📊 Детали</h3>

    <p><strong>Возраст:</strong> 3–6: ${ages['3-6'] || 0}, 7–10: ${ages['7-10'] || 0}, 11–14: ${ages['11-14'] || 0}</p>

    <p><strong>Топ игр:</strong></p><ul>${games}</ul>

    <p><strong>Популярные персонажи:</strong></p><ul>${chars}</ul>

  `;

}



document.getElementById('refreshStatsBtn')?.addEventListener('click', loadStats);

document.addEventListener('DOMContentLoaded', loadStats);

