import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { getMemoryPairs } from './game-difficulty.js';

export function startMemoryGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('memory');
  const pairs = getMemoryPairs(level);
  const total = pairs * 2;
  const cols = total <= 8 ? 4 : total <= 12 ? 4 : 5;

  const emojis = ['😊', '😢', '😨', '😡', '😴', '😍', '🥳', '🤗', '🐱', '🌟', '🎈', '🦋', '🌈', '🍎', '🎹', '⚽'];
  const cards = [...emojis.slice(0, pairs), ...emojis.slice(0, pairs)].sort(() => Math.random() - 0.5);

  let flipped = []; let matched = 0; let attempts = 0; let locked = false; let ended = false;
  const { body, close } = createGameScreen({ gameId: 'memory', title: '🧠 Мемори', emoji: '🧠', level });

  const info = document.createElement('div');
  info.style.cssText = 'text-align:center;color:#fff;font-size:16px;margin-bottom:12px;';
  info.textContent = `Пары: 0/${pairs} | Попытки: 0`;

  const board = document.createElement('div');
  board.style.cssText = `display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;max-width:400px;margin:0 auto;`;

  body.appendChild(info);
  body.appendChild(board);

  cards.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.style.cssText = 'aspect-ratio:1;background:linear-gradient(135deg,#7B68EE,#4a3a8a);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:36px;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
    card.textContent = '?';
    card.onclick = () => {
      if (locked || flipped.includes(i) || ended) return;

      card.textContent = emoji;
      card.style.background = 'rgba(255,255,255,0.15)';
      flipped.push(i);

      if (flipped.length === 2) {
        attempts++;
        info.textContent = `Пары: ${matched}/${pairs} | Попытки: ${attempts}`;
        locked = true;

        const [a, b] = flipped;
        const cardA = board.children[a]; const cardB = board.children[b];

        if (cards[a] === cards[b]) {
          matched++;
          cardA.classList.add('matched');
          cardB.classList.add('matched');
          flipped = [];
          locked = false;
          info.textContent = `Пары: ${matched}/${pairs} | Попытки: ${attempts}`;

          if (matched === pairs) {
            ended = true;
            appState.gameActive = false;
            close();
            recordGameResult('memory', true, level);
            recordGameWin('memory', level);
            updateAchievement('memory_champion');
            checkProgressAchievements();
            trackEvent('memory_won', { level, attempts });
            speak('Все пары найдены! Молодец!');
            showGameResult({
              won: true, level,
              scoreText: `Все пары за ${attempts} попыток!`,
              onNext: () => startMemoryGame(level + 1),
              onRestart: () => startMemoryGame(level)
            });
            if (window.leaderboard) window.leaderboard.submitScore('memory', attempts);
          }
        } else {
          setTimeout(() => {
            cardA.textContent = '?';
            cardA.style.background = 'linear-gradient(135deg,#7B68EE,#4a3a8a)';
            cardB.textContent = '?';
            cardB.style.background = 'linear-gradient(135deg,#7B68EE,#4a3a8a)';
            flipped = [];
            locked = false;
          }, 800);
        }
      }
    };
    board.appendChild(card);
  });

  trackEvent('memory_started', { level });
}

export default { startMemoryGame };
