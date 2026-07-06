import { appState, saveChildData, updateStatsUI, getActiveChildName } from '../core.js';
import { speak } from '../audio.js';
import { updateAchievement } from '../achievements.js';
import { trackEvent } from '../analytics.js';
import { recordFishResult } from '../game-progress.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { getFishConfig } from './game-difficulty.js';

const CATCH_ITEMS = [
  { name: '🐟 Рыбка', points: 10, probability: 0.5 },
  { name: '🐠 Золотая рыбка', points: 25, probability: 0.15 },
  { name: '🦀 Краб', points: 15, probability: 0.1 },
  { name: '👢 Сапог', points: -5, probability: 0.1 },
  { name: '🪣 Ведро', points: -3, probability: 0.08 },
  { name: '🌿 Водоросль', points: 0, probability: 0.07 }
];

function getRandomItem() {
  const rand = Math.random();
  let cumulative = 0;
  for (const item of CATCH_ITEMS) {
    cumulative += item.probability;
    if (rand <= cumulative) return item;
  }
  return CATCH_ITEMS[0];
}

function showCatchAnimation(fishArea, item) {
  const pop = document.createElement('div');
  pop.className = 'fish-catch-pop';
  pop.textContent = item.name;
  pop.style.cssText = `
    position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);
    font-size:1.4rem;font-weight:bold;color:#FFD700;text-shadow:0 2px 8px rgba(0,0,0,0.5);
    pointer-events:none;animation:fishCatchPop 1s ease forwards;z-index:10;
  `;
  if (item.points < 0) pop.style.color = '#FF6B6B';
  else if (item.points === 0) pop.style.color = '#aaa';
  fishArea.appendChild(pop);
  setTimeout(() => pop.remove(), 1000);
}

export function startFishGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('fish');
  const cfg = getFishConfig(level);
  const { fishCount, time, fishSize, speed } = cfg;

  appState.gameActive = true;
  let score = 0;
  let catches = 0;
  let timeLeft = time;
  let combo = 0;

  const { body, close } = createGameScreen({ gameId: 'fish', title: 'Рыбалка', emoji: '🎣', level });

  const hud = document.createElement('div');
  hud.className = 'game-hud-row';
  hud.style.cssText = 'display:flex;justify-content:space-between;width:100%;max-width:520px;padding:8px 4px;font-size:1rem;';
  hud.innerHTML = `<span id="fishScore">⭐ 0</span><span id="fishCatches">🎣 0/${fishCount}</span><span>⏱️ ${timeLeft}с</span>`;

  const fishArea = document.createElement('div');
  fishArea.className = 'fish-area-full';
  fishArea.style.position = 'relative';
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
  const catchesEl = hud.querySelector('#fishCatches');
  const timerEl = hud.querySelector('span:last-child');

  fishArea.addEventListener('click', (e) => {
    const fish = e.target.closest('.fish-element');
    if (!fish || !appState.gameActive || fish.dataset.clicked === 'true') return;

    fish.dataset.clicked = 'true';
    const item = getRandomItem();
    score += item.points;
    if (score < 0) score = 0;
    catches++;
    combo++;
    if (combo >= 3 && item.points > 0) score += Math.floor(combo / 3);

    fish.style.transform = 'scale(1.4) rotate(15deg)';
    fish.style.opacity = '0';
    scoreEl.textContent = `⭐ ${score}`;
    catchesEl.textContent = `🎣 ${catches}/${fishCount}`;
    showCatchAnimation(fishArea, item);
    appState.fishScore = (appState.fishScore || 0) + Math.max(0, item.points);
    updateStatsUI();

    if (item.points < 0) {
      window.ttsEngine?.speak(`Ой, это ${item.name}! Минус ${Math.abs(item.points)} очков.`);
    } else if (item.points > 0) {
      window.ttsEngine?.speak(`Поймал ${item.name}! Плюс ${item.points} очков!`);
    }

    if (catches >= fishCount) {
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

    trackEvent('fish_caught', { level, score, item: item.name, combo });
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
        scoreText: `Поймано ${catches} предметов, ⭐ ${score} очков!`,
        onNext: () => startFishGame(level + 1),
        onClose: () => speak(`Отличная рыбалка! ${score} очков!`)
      });
      trackEvent('fish_game_won', { level, score, catches });
    } else {
      showGameResult({
        won: false,
        level,
        scoreText: `Поймано ${catches} из ${fishCount}. ⭐ ${score} очков.`,
        onRestart: () => startFishGame(level),
        onClose: () => speak(`Неплохо! ${catches} улова и ${score} очков.`)
      });
      trackEvent('fish_game_lost', { level, score, catches });
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

export default { startFishGame };
