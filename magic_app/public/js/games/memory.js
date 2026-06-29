import { appState, getActiveChildName } from '../core.js';
import { updateAchievement } from '../achievements.js';
import { trackEvent } from '../analytics.js';
import { recordMemoryWin } from '../game-progress.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { getMemoryPairs } from './game-difficulty.js';
import { createGame } from '../game-engine.js';

export function startMemoryGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('memory');

  const pairCount = getMemoryPairs(level);
  const cardCount = pairCount * 2;
  const cols = cardCount <= 8 ? 4 : cardCount <= 12 ? 4 : 5;

  appState.gameActive = true;

  const emojiPool = ['😊','😢','😨','😡','😴','😍','🥳','🤗','🐱','🌟','🎈','🦋','🌈','🍎','🎸','⚽'];
  const picked = emojiPool.slice(0, pairCount);
  appState.memoryCards = [...picked, ...picked].sort(() => Math.random() - 0.5);
  appState.memoryFlipped = new Array(cardCount).fill(false);
  appState.memoryMatches = 0;
  appState.memoryLocked = false;

  let attempts = 0;
  let firstCardIndex = null;
  let firstCardElement = null;

  const { body, close } = createGameScreen({ gameId: 'memory', title: 'Мемори', emoji: '🧠', level });

  const engine = createGame({
    name: 'Мемори',
    gameId: 'memory',
    emoji: '🧠',
    maxScore: pairCount * 1000
  });
  const gameBody = engine.mount(body);
  engine.start();
  engine.on('exit', () => {
    appState.gameActive = false;
    close();
  });

  const info = document.createElement('div');
  info.style.cssText = 'margin:8px 0;font-size:1rem;color:white;text-align:center;';
  info.textContent = `Найдено пар: 0 / ${pairCount} | Попытки: 0`;

  const board = document.createElement('div');
  board.className = 'memory-board';
  board.style.cssText = `display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;max-width:min(420px,92vw);margin:0 auto;width:100%;`;

  gameBody.appendChild(info);
  gameBody.appendChild(board);

  for (let i = 0; i < cardCount; i++) {
    const card = document.createElement('div');
    card.style.cssText = `
      aspect-ratio: 1;
      background: linear-gradient(135deg, #4a4a6a, #6c6caa);
      border-radius: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      cursor: pointer;
      transition: transform 0.3s, background 0.3s;
    `;
    card.textContent = '?';
    card.dataset.index = i;

    card.onclick = () => {
      if (appState.memoryLocked || appState.memoryFlipped[i] || firstCardIndex === i) return;
      flipCard(card, i);

      if (firstCardIndex === null) {
        firstCardIndex = i;
        firstCardElement = card;
      } else {
        attempts++;
        info.textContent = `Найдено пар: ${appState.memoryMatches} / ${pairCount} | Попытки: ${attempts}`;
        appState.memoryLocked = true;

        if (appState.memoryCards[firstCardIndex] === appState.memoryCards[i]) {
          appState.memoryMatches++;
          engine.addScore(10);

          setTimeout(() => {
            card.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
            firstCardElement.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
            firstCardIndex = null;
            firstCardElement = null;
            appState.memoryLocked = false;
            info.textContent = `Найдено пар: ${appState.memoryMatches} / ${pairCount} | Попытки: ${attempts}`;

            if (appState.memoryMatches === pairCount) {
              updateAchievement('memory_champion');
              recordMemoryWin(pairCount, getActiveChildName());
              recordGameWin('memory', level);
              trackEvent('memory_game_won', { attempts, level });
              appState.gameActive = false;
              engine.exit();
              close();
              showGameResult({
                won: true,
                level,
                scoreText: `Все пары за ${attempts} попыток!`,
                onNext: () => startMemoryGame(level + 1)
              });
            }
          }, 500);
        } else {
          setTimeout(() => {
            unflipCard(card, i);
            unflipCard(firstCardElement, firstCardIndex);
            firstCardIndex = null;
            firstCardElement = null;
            appState.memoryLocked = false;
          }, 1000);
        }
      }
    };

    board.appendChild(card);
  }

  function flipCard(card, index) {
    appState.memoryFlipped[index] = true;
    card.textContent = appState.memoryCards[index];
    card.style.background = 'linear-gradient(135deg, #fff, #f0f0f0)';
  }

  function unflipCard(card, index) {
    appState.memoryFlipped[index] = false;
    card.textContent = '?';
    card.style.background = 'linear-gradient(135deg, #4a4a6a, #6c6caa)';
  }

  trackEvent('memory_game_started', { level });
}
