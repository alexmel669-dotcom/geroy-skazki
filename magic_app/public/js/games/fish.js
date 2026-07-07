import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { getFishConfig } from './game-difficulty.js';

const ITEMS = [
  { name: '🐟 Рыбка', points: 10, prob: 0.50, good: true },
  { name: '🐠 Золотая', points: 25, prob: 0.15, good: true },
  { name: '🦀 Краб', points: 15, prob: 0.10, good: true },
  { name: '👢 Сапог', points: -5, prob: 0.10, good: false },
  { name: '🪣 Ведро', points: -3, prob: 0.08, good: false },
  { name: '🌿 Водоросль', points: 0, prob: 0.07, good: false }
];

function randomItem() {
  const r = Math.random();
  let c = 0;
  for (const item of ITEMS) { c += item.prob; if (r <= c) return item; }
  return ITEMS[0];
}

export function startFishGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('fish');
  const cfg = getFishConfig(level);
  const { fishCount, time } = cfg;

  let score = 0; let catches = 0; let timeLeft = time; let ended = false;
  const { body, close } = createGameScreen({ gameId: 'fish', title: '🎣 Рыбалка', emoji: '🎣', level });

  const hud = document.createElement('div');
  hud.style.cssText = 'display:flex;justify-content:space-between;padding:12px 16px;color:#fff;font-size:18px;font-weight:bold;';
  hud.innerHTML = `<span>⭐ ${score}</span><span>🎣 ${catches}/${fishCount}</span><span>⏱ ${timeLeft}с</span>`;

  const pond = document.createElement('div');
  pond.style.cssText = 'position:relative;width:100%;height:65vh;background:linear-gradient(180deg,#1a5276,#0d1b2a);border-radius:20px;overflow:hidden;box-shadow:inset 0 0 60px rgba(0,0,0,0.5);';

  const waves = document.createElement('div');
  waves.style.cssText = 'position:absolute;top:0;left:0;right:0;height:40px;background:rgba(255,255,255,0.1);animation:waveMove 3s ease-in-out infinite;';
  pond.appendChild(waves);

  body.appendChild(hud);
  body.appendChild(pond);

  function spawnFish() {
    if (ended) return;
    const fish = document.createElement('div');
    fish.textContent = '🐟';
    fish.style.cssText = `position:absolute;font-size:44px;left:${5 + Math.random() * 85}%;top:${10 + Math.random() * 70}%;cursor:pointer;transition:all 0.3s;animation:fishFloat ${1.5 + Math.random() * 2}s ease-in-out infinite;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.4));`;
    fish.onclick = () => {
      if (ended) return;
      const item = randomItem();
      score = Math.max(0, score + item.points);
      if (item.good) catches++;
      hud.querySelector('span:first-child').textContent = `⭐ ${score}`;
      hud.querySelector('span:nth-child(2)').textContent = `🎣 ${catches}/${fishCount}`;

      const pop = document.createElement('div');
      pop.textContent = item.name;
      pop.style.cssText = `position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font-size:24px;color:${item.points >= 0 ? '#FFD700' : '#FF6B6B'};text-shadow:0 2px 8px rgba(0,0,0,0.6);animation:popUp 0.8s ease forwards;pointer-events:none;z-index:10;`;
      pond.appendChild(pop);
      setTimeout(() => pop.remove(), 800);

      fish.style.transform = 'scale(1.6)';
      fish.style.opacity = '0';
      setTimeout(() => fish.remove(), 300);

      speak(item.name + '!');

      if (catches >= fishCount && score >= fishCount * 5) endGame(true);
    };
    pond.appendChild(fish);
    setTimeout(() => { if (!ended && fish.parentNode) fish.remove(); }, 5000);
  }

  for (let i = 0; i < Math.min(fishCount, 6); i++) spawnFish();
  const spawnTimer = setInterval(spawnFish, 2000);

  const countdown = setInterval(() => {
    timeLeft--;
    hud.querySelector('span:last-child').textContent = `⏱ ${timeLeft}с`;
    if (timeLeft <= 0) endGame(score >= fishCount * 5);
  }, 1000);

  function endGame(won) {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    clearInterval(spawnTimer);
    clearInterval(countdown);
    close();

    recordGameResult('fish', won, level);
    if (won) { recordGameWin('fish', level); updateAchievement('fish_master'); checkProgressAchievements(); }
    trackEvent(won ? 'fish_won' : 'fish_lost', { level, score });

    showGameResult({
      won, level,
      scoreText: `Поймано ${catches} рыб, ⭐ ${score}`,
      onNext: won ? () => startFishGame(level + 1) : null,
      onRestart: () => startFishGame(level)
    });
    if (won && window.leaderboard) window.leaderboard.submitScore('fish', score);
  }
}

export default { startFishGame };
