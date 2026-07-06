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

async function showLeaderboard() {
  const game = prompt('Выбери игру: runner, fish, quiz, memory');
  if (!game) return;

  let scores = [];
  try {
    const res = await fetch(`/api/leaderboard?game=${encodeURIComponent(game)}`);
    scores = await res.json();
  } catch {
    scores = [];
  }

  const html = (Array.isArray(scores) ? scores : []).slice(0, 10).map((s, i) =>
    `<div>${['🥇', '🥈', '🥉'][i] || '•'} ${s.name}: ${s.score}⭐</div>`
  ).join('') || '<p>Пока нет рекордов</p>';

  const popup = document.createElement('div');
  popup.className = 'leaderboard-popup game-overlay';
  popup.innerHTML = `
    <div class="modal-box">
      <h3>🏆 Таблица лидеров</h3>
      <div class="leaderboard-list">${html}</div>
      <button type="button" class="modal-btn secondary" style="margin-top:12px;width:100%;">Закрыть</button>
    </div>
  `;
  popup.querySelector('button')?.addEventListener('click', () => popup.remove());
  document.body.appendChild(popup);
}

window.showLeaderboard = showLeaderboard;

export default window.leaderboard;
export { showLeaderboard };
