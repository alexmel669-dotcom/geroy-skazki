import { appState, saveChildData, updateStatsUI } from '../core.js';
import { speak } from '../audio.js';
import { updateAchievement } from '../achievements.js';
import { trackEvent } from '../analytics.js';

export function startFishGame(level = 1) {
  if (appState.gameActive) return;

  const config = {
    1: { fishCount: 10, time: 30, fishSize: 60, speed: 1500 },
    2: { fishCount: 20, time: 30, fishSize: 50, speed: 1200 },
    3: { fishCount: 30, time: 30, fishSize: 40, speed: 900 }
  };

  const { fishCount, time, fishSize, speed } = config[level] || config[1];

  appState.gameActive = true;
  let score = 0;
  let timeLeft = time;
  let combo = 0;

  const container = document.createElement('div');
  container.className = 'game-overlay';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-label', 'Игра Рыбалка');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;padding:20px;font-size:1.2rem;';
  header.innerHTML = `
    <span>🐟 ${score}/${fishCount}</span>
    <span>⭐ Уровень ${level}</span>
    <span>⏱️ ${timeLeft}с</span>
  `;

  const fishArea = document.createElement('div');
  fishArea.className = 'fish-area';
  fishArea.style.cssText = `
    flex: 1; position: relative; width: 100%; max-height: 60vh;
    background: linear-gradient(180deg, #1a3a5c, #0d2137);
    border-radius: 20px; margin: 10px; overflow: hidden;
  `;

  const fishElements = [];
  const fishTypes = ['🐟', '🐠', '🐡', '🦈', '🐙'];

  for (let i = 0; i < Math.min(fishCount, 5); i++) {
    const fish = createFish(fishTypes, fishSize, fishArea);
    fishElements.push(fish);
    fishArea.appendChild(fish);
  }

  fishArea.addEventListener('click', (e) => {
    const fish = e.target.closest('.fish-element');
    if (!fish || !appState.gameActive || fish.dataset.clicked === 'true') return;

    fish.dataset.clicked = 'true';
    score++;
    combo++;
    fish.style.transform = 'scale(1.3)';
    fish.style.opacity = '0';
    fish.style.transition = 'all 0.3s';

    if (combo >= 3) score += Math.floor(combo / 3);

    header.querySelector('span:first-child').textContent = `🐟 ${score}/${fishCount}`;
    appState.hunger = Math.min(100, appState.hunger + 3);
    appState.fishScore++;
    updateStatsUI();

    if (score >= fishCount) {
      endGame(true);
      return;
    }

    setTimeout(() => {
      if (appState.gameActive && fishElements.length < fishCount) {
        const newFish = createFish(fishTypes, fishSize, fishArea);
        fishElements.push(newFish);
        fishArea.appendChild(newFish);
      }
    }, 500);

    setTimeout(() => {
      fish.remove();
      const index = fishElements.indexOf(fish);
      if (index > -1) fishElements.splice(index, 1);
    }, 300);

    trackEvent('fish_caught', { level, score, combo });
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    position: absolute; top: 20px; right: 20px;
    background: rgba(255,255,255,0.2); border: none; color: white;
    width: 40px; height: 40px; border-radius: 50%; font-size: 1.5rem;
    cursor: pointer; z-index: 10;
  `;
  closeBtn.onclick = () => endGame(false);

  const timerInterval = setInterval(() => {
    timeLeft--;
    const timerSpan = header.querySelector('span:last-child');
    if (timerSpan) timerSpan.textContent = `⏱️ ${timeLeft}с`;
    if (timeLeft <= 0) endGame(false);
    combo = 0;
  }, 1000);

  let ended = false;

  function endGame(won) {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    clearInterval(timerInterval);
    clearInterval(moveInterval);
    saveChildData(appState.currentChildIndex);
    container.remove();

    if (won) {
      updateAchievement('fish_master');
      speak(`Ура! Ты поймал всех рыбок! Уровень ${level} пройден! 🎉`);
      trackEvent('fish_game_won', { level, score });
      if (level < 3) {
        setTimeout(() => {
          if (confirm('Хочешь перейти на следующий уровень?')) startFishGame(level + 1);
        }, 2000);
      }
    } else {
      speak(`Игра окончена! Ты поймал ${score} рыбок из ${fishCount}!`);
      trackEvent('fish_game_lost', { level, score });
    }
  }

  const moveInterval = setInterval(() => {
    if (!appState.gameActive) return;
    fishElements.forEach(fish => {
      if (fish.dataset.clicked === 'true') return;
      const areaRect = fishArea.getBoundingClientRect();
      const maxX = areaRect.width - fishSize - 10;
      const maxY = areaRect.height - fishSize - 10;
      fish.style.left = Math.random() * maxX + 'px';
      fish.style.top = Math.random() * maxY + 'px';
    });
  }, speed);

  fishArea.appendChild(closeBtn);
  container.appendChild(header);
  container.appendChild(fishArea);
  document.body.appendChild(container);

  trackEvent('fish_game_started', { level });
}

function createFish(fishTypes, size, area) {
  const fish = document.createElement('div');
  fish.className = 'fish-element';
  fish.textContent = fishTypes[Math.floor(Math.random() * fishTypes.length)];
  const areaRect = area.getBoundingClientRect();
  fish.style.cssText = `
    position: absolute; font-size: ${size}px;
    left: ${Math.random() * (areaRect.width - size - 10)}px;
    top: ${Math.random() * (areaRect.height - size - 10)}px;
    cursor: pointer; transition: left 0.5s, top 0.5s; user-select: none;
  `;
  fish.dataset.clicked = 'false';
  return fish;
}
