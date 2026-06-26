import { appState, saveChildData, updateStatsUI, getActiveChildName } from '../core.js';
import { speak } from '../audio.js';
import { updateAchievement } from '../achievements.js';
import { trackEvent } from '../analytics.js';
import { recordFishResult } from '../game-progress.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { getFishConfig } from './game-difficulty.js';

export function startFishGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('fish');
  const cfg = getFishConfig(level);
  const { fishCount, time, fishSize, speed } = cfg;

  appState.gameActive = true;
  let score = 0;
  let timeLeft = time;
  let combo = 0;

  const { body, close } = createGameScreen({ gameId: 'fish', title: 'Рыбалка', emoji: '🎣', level });

  const hud = document.createElement('div');
  hud.className = 'game-hud-row';
  hud.style.cssText = 'display:flex;justify-content:space-between;width:100%;max-width:520px;padding:8px 4px;font-size:1rem;';
  hud.innerHTML = `<span id="fishScore">🐟 0/${fishCount}</span><span>⏱️ ${timeLeft}с</span>`;

  const fishArea = document.createElement('div');
  fishArea.className = 'fish-area-full';
  fishArea.innerHTML = '<div class="fish-waves" aria-hidden="true"></div><div class="fish-bubbles" aria-hidden="true"></div>';

  const fishElements = [];
  const fishTypes = ['🐟', '🐠', '🐡', '🦈', '🐙'];

  for (let i = 0; i < Math.min(fishCount, 6); i++) {
    const fish = createFish(fishTypes, fishSize, fishArea);
    fishElements.push(fish);
    fishArea.appendChild(fish);
  }

  body.appendChild(hud);
  body.appendChild(fishArea);

  const scoreEl = hud.querySelector('#fishScore');
  const timerEl = hud.querySelector('span:last-child');

  fishArea.addEventListener('click', (e) => {
    const fish = e.target.closest('.fish-element');
    if (!fish || !appState.gameActive || fish.dataset.clicked === 'true') return;

    fish.dataset.clicked = 'true';
    score++;
    combo++;
    fish.style.transform = 'scale(1.4) rotate(15deg)';
    fish.style.opacity = '0';
    if (combo >= 3) score += Math.floor(combo / 3);
    scoreEl.textContent = `🐟 ${score}/${fishCount}`;
    appState.fishScore++;
    updateStatsUI();

    if (score >= fishCount) {
      endGame(true);
      return;
    }

    setTimeout(() => {
      fish.remove();
      const idx = fishElements.indexOf(fish);
      if (idx > -1) fishElements.splice(idx, 1);
      if (appState.gameActive) {
        const newFish = createFish(fishTypes, fishSize, fishArea);
        fishElements.push(newFish);
        fishArea.appendChild(newFish);
      }
    }, 280);

    trackEvent('fish_caught', { level, score, combo });
  });

  const timerInterval = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.textContent = `⏱️ ${timeLeft}с`;
    if (timeLeft <= 0) endGame(false);
    combo = 0;
  }, 1000);

  const moveInterval = setInterval(() => {
    if (!appState.gameActive) return;
    const rect = fishArea.getBoundingClientRect();
    fishElements.forEach((fish) => {
      if (fish.dataset.clicked === 'true') return;
      const maxX = Math.max(10, rect.width - fishSize - 10);
      const maxY = Math.max(10, rect.height - fishSize - 10);
      fish.style.left = `${Math.random() * maxX}px`;
      fish.style.top = `${Math.random() * maxY}px`;
    });
  }, speed);

  let ended = false;

  function endGame(won) {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    clearInterval(timerInterval);
    clearInterval(moveInterval);
    saveChildData({ fishScore: appState.fishScore || 0 });
    const childName = getActiveChildName();
    recordFishResult(score, level, childName);
    close();

    if (won) {
      recordGameWin('fish', level);
      updateAchievement('fish_master');
      showGameResult({
        won: true,
        level,
        scoreText: `Поймано ${score} из ${fishCount}!`,
        onNext: () => startFishGame(level + 1),
        onClose: () => speak(`Отличная рыбалка! ${score} рыбок!`)
      });
      trackEvent('fish_game_won', { level, score });
    } else {
      showGameResult({
        won: false,
        level,
        scoreText: `Поймано ${score} из ${fishCount}. Попробуй ещё!`,
        onClose: () => speak(`Неплохо! ${score} рыбок из ${fishCount}.`)
      });
      trackEvent('fish_game_lost', { level, score });
    }
  }

  trackEvent('fish_game_started', { level });
}

function createFish(fishTypes, size, area) {
  const fish = document.createElement('div');
  fish.className = 'fish-element';
  fish.textContent = fishTypes[Math.floor(Math.random() * fishTypes.length)];
  fish.style.cssText = `
    position: absolute; font-size: ${size}px;
    left: ${Math.random() * 200}px; top: ${Math.random() * 200}px;
    cursor: pointer; transition: left 0.6s ease, top 0.6s ease, transform 0.25s, opacity 0.25s;
    user-select: none; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35));
  `;
  fish.dataset.clicked = 'false';
  return fish;
}
