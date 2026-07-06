window.leaderboard = {
  async submitScore(game, score) {
    const user = JSON.parse(localStorage.getItem('geroy-user') || '{}');
    try {
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, score, name: user.childName || 'Гость' })
      });
    } catch {
      /* offline */
    }
  },

  async render(game) {
    try {
      const res = await fetch(`/api/leaderboard?game=${encodeURIComponent(game || 'runner')}`);
      const scores = await res.json();
      if (!Array.isArray(scores) || !scores.length) return '<p>Пока нет рекордов</p>';
      return scores.slice(0, 5).map((s, i) =>
        `<div>${['🥇', '🥈', '🥉', '4', '5'][i]} ${s.name}: ${s.score}⭐</div>`
      ).join('');
    } catch {
      return '<p>Не удалось загрузить таблицу</p>';
    }
  }
};

const LEADERBOARD_GAMES = [
  { id: 'runner', name: '🐱 Люцик-раннер' },
  { id: 'fish', name: '🎣 Рыбалка' },
  { id: 'quiz', name: '❓ Викторина' },
  { id: 'memory', name: '🧠 Мемори' }
];

async function loadLeaderboard(gameId) {
  const el = document.getElementById('leaderboardScores');
  if (!el) return;
  el.innerHTML = '<p>Загрузка...</p>';
  try {
    const res = await fetch(`/api/leaderboard?game=${encodeURIComponent(gameId)}`);
    const scores = await res.json();
    el.innerHTML = (Array.isArray(scores) ? scores : []).slice(0, 10).map((s, i) =>
      `<div class="leaderboard-row">${['🥇', '🥈', '🥉'][i] || '•'} ${s.name}: ${s.score}⭐</div>`
    ).join('') || '<p>Нет результатов</p>';
  } catch {
    el.innerHTML = '<p>Не удалось загрузить таблицу</p>';
  }
}

async function showLeaderboard() {
  const popup = document.createElement('div');
  popup.className = 'leaderboard-popup game-overlay';
  popup.innerHTML = `
    <div class="modal-box leaderboard-modal">
      <h3>🏆 Таблица лидеров</h3>
      <p>Выбери игру:</p>
      <div class="leaderboard-games">
        ${LEADERBOARD_GAMES.map((g) =>
          `<button type="button" class="dj-btn leaderboard-game-btn" data-game="${g.id}">${g.name}</button>`
        ).join('')}
      </div>
      <div id="leaderboardScores" class="leaderboard-list"></div>
      <button type="button" class="dj-btn leaderboard-close-btn" style="margin-top:12px;width:100%;">Закрыть</button>
    </div>
  `;

  popup.querySelectorAll('.leaderboard-game-btn').forEach((btn) => {
    btn.addEventListener('click', () => loadLeaderboard(btn.dataset.game));
  });
  popup.querySelector('.leaderboard-close-btn')?.addEventListener('click', () => popup.remove());
  popup.addEventListener('click', (e) => {
    if (e.target === popup) popup.remove();
  });

  document.body.appendChild(popup);
  loadLeaderboard('runner');
}

window.loadLeaderboard = loadLeaderboard;
window.showLeaderboard = showLeaderboard;

export default window.leaderboard;
export { showLeaderboard, loadLeaderboard };
