import { appState, showGamesMenu } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

const ITEMS = [
  { name: '🐟 Рыбка', points: 10, prob: 0.40, emoji: '🐟' },
  { name: '🐠 Немо', points: 30, prob: 0.05, emoji: '🐠', rare: true },
  { name: '🦈 Акула', points: 50, prob: 0.02, emoji: '🦈', legendary: true },
  { name: '🧜‍♀️ Русалка', points: 100, prob: 0.005, emoji: '🧜‍♀️', mythic: true },
  { name: '💀 Сундук', points: 75, prob: 0.015, emoji: '💀' },
  { name: '👢 Сапог', points: -5, prob: 0.30, emoji: '👢' },
  { name: '🪣 Ведро', points: -3, prob: 0.15, emoji: '🪣' },
  { name: '🌿 Трава', points: 0, prob: 0.06, emoji: '🌿' }
];

export function startFishGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const TIME = 30;
  let score = 0;
  let timeLeft = TIME;
  let ended = false;
  let combo = 0;
  const caught = [];

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;padding:12px 16px;background:rgba(0,0,0,0.5);color:#fff;font-size:16px;z-index:10;';
  header.innerHTML = `<span>🎣 Рыбалка</span><span>⭐ <b id="fishScore">0</b></span><span>⏱ <b id="fishTimer">${TIME}</b>с</span><button id="fishClose" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>`;

  const pond = document.createElement('div');
  pond.style.cssText = 'flex:1;position:relative;background:linear-gradient(180deg,#1a5276,#0d1b2a);overflow:hidden;';

  const waves = document.createElement('div');
  waves.style.cssText = 'position:absolute;top:0;left:0;right:0;height:40px;background:rgba(255,255,255,0.1);animation:waveMove 3s ease-in-out infinite;';
  pond.appendChild(waves);

  overlay.appendChild(header);
  overlay.appendChild(pond);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  function randomItem() {
    const r = Math.random();
    let c = 0;
    for (const item of ITEMS) {
      c += item.prob;
      if (r <= c) return item;
    }
    return ITEMS[0];
  }

  function spawnItem() {
    if (ended) return;
    const item = randomItem();
    const el = document.createElement('div');
    el.textContent = item.emoji;
    el.style.cssText = `position:absolute;font-size:${item.rare ? '50px' : item.legendary ? '60px' : item.mythic ? '70px' : '38px'};left:${5 + Math.random() * 85}%;top:${15 + Math.random() * 70}%;cursor:pointer;transition:all 0.3s;animation:fishFloat ${1.5 + Math.random() * 2}s ease-in-out infinite;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.4));`;

    el.onclick = () => {
      if (ended) return;
      score = Math.max(0, score + item.points);
      if (item.points > 0) {
        combo++;
        if (combo >= 3) score += combo * 2;
      } else {
        combo = 0;
      }
      caught.push(item);

      document.getElementById('fishScore').textContent = score;

      const pop = document.createElement('div');
      pop.textContent = `${item.name} ${item.points >= 0 ? '+' : ''}${item.points}`;
      pop.style.cssText = `position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);font-size:20px;color:${item.points >= 0 ? '#FFD700' : '#FF6B6B'};text-shadow:0 2px 8px rgba(0,0,0,0.6);animation:popUp 1s ease forwards;pointer-events:none;z-index:10;`;
      pond.appendChild(pop);
      setTimeout(() => pop.remove(), 1000);

      el.style.transform = 'scale(1.5)';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
      speak(item.name + '!');
    };

    pond.appendChild(el);
    setTimeout(() => { if (!ended && el.parentNode) el.remove(); }, 4000 + Math.random() * 2000);
  }

  for (let i = 0; i < 8; i++) spawnItem();
  const spawnInterval = setInterval(spawnItem, 1500);

  const timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('fishTimer').textContent = timeLeft;
    if (timeLeft <= 0) finish();
  }, 1000);

  function finish() {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    clearInterval(spawnInterval);
    clearInterval(timerInterval);
    document.body.classList.remove('game-active');
    overlay.remove();

    recordGameResult('fish', true, level);
    updateAchievement('fish_master');
    checkProgressAchievements();
    trackEvent('fish_end', { level, score });

    const best = Math.max(+(localStorage.getItem('fish-best') || 0), score);
    localStorage.setItem('fish-best', String(best));
    window.leaderboard?.submitScore('fish', score);

    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
    result.innerHTML = `
      <div style="background:linear-gradient(135deg,#fff,#f0f0f0);border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;">
        <div style="font-size:48px;">🎣</div>
        <h2 style="margin:12px 0;">Рыбалка окончена!</h2>
        <p style="font-size:24px;">⭐ ${score}</p>
        <p style="color:#666;">🏆 Рекорд: ${best}</p>
        <button id="fishRestart" style="margin:8px;padding:12px 24px;border-radius:12px;border:none;background:#FFD700;color:#333;font-size:16px;cursor:pointer;width:80%;">🔄 Ещё раз</button>
        <button id="fishExit" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ddd;background:#fff;color:#666;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button>
      </div>
    `;
    document.body.appendChild(result);
    result.querySelector('#fishRestart').onclick = () => { result.remove(); startFishGame(level); };
    result.querySelector('#fishExit').onclick = () => { result.remove(); showGamesMenu(); };
  }

  document.getElementById('fishClose').onclick = () => {
    clearInterval(spawnInterval);
    clearInterval(timerInterval);
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('fish_started', { level });
}

export default { startFishGame };
