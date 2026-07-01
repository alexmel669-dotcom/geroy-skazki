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

export default window.leaderboard;
