// ========================================
// game-ui.js — полноэкранные игры с уровнями
// ========================================

import { loadGameProgress, saveGameProgress } from '../game-progress.js';
import { getActiveChildName } from '../core.js';

export const MAX_GAME_LEVEL = 5;

export function getGameLevel(gameId) {
  const p = loadGameProgress(getActiveChildName());
  const block = p[gameId] || {};
  return Math.min(MAX_GAME_LEVEL, Math.max(1, block.level || 1));
}

export function recordGameWin(gameId, level) {
  const name = getActiveChildName();
  const p = loadGameProgress(name);
  const block = { ...(p[gameId] || {}), wins: (p[gameId]?.wins || 0) + 1 };
  if (level >= (block.level || 1) && level < MAX_GAME_LEVEL) {
    block.level = level + 1;
  } else {
    block.level = Math.max(block.level || 1, level);
  }
  block.lastLevel = level;
  p[gameId] = block;
  saveGameProgress(p, name);
  return block.level;
}

export function createGameScreen({ gameId, title, emoji = '🎮', level: levelOverride }) {
  const level = levelOverride ?? getGameLevel(gameId);
  const overlay = document.createElement('div');
  overlay.className = 'game-screen';
  overlay.setAttribute('role', 'dialog');
  overlay.innerHTML = `
    <div class="game-screen-bg" aria-hidden="true"></div>
    <div class="game-screen-stars" aria-hidden="true"></div>
    <header class="game-screen-header">
      <div class="game-screen-meta">
        <span class="game-screen-emoji">${emoji}</span>
        <div>
          <div class="game-screen-title">${title}</div>
          <div class="game-level-track">
            <span class="game-level-badge">Уровень ${level}</span>
            <div class="game-level-dots">${Array.from({ length: MAX_GAME_LEVEL }, (_, i) =>
              `<span class="game-level-dot${i < level ? ' filled' : ''}"></span>`
            ).join('')}</div>
          </div>
        </div>
      </div>
      <button type="button" class="game-close-btn" aria-label="Закрыть">✕</button>
    </header>
    <div class="game-screen-body"></div>
  `;
  const body = overlay.querySelector('.game-screen-body');
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('game-screen-visible'));

  const close = () => {
    overlay.classList.remove('game-screen-visible');
    setTimeout(() => overlay.remove(), 280);
  };
  overlay.querySelector('.game-close-btn').onclick = close;

  return { overlay, body, level, close, gameId };
}

export function showGameResult({ won, level, scoreText, onNext, onClose }) {
  const modal = document.createElement('div');
  modal.className = 'game-result-modal';
  modal.innerHTML = `
    <div class="game-result-box ${won ? 'won' : 'lost'}">
      <div class="game-result-icon">${won ? '🎉' : '💪'}</div>
      <h3>${won ? 'Уровень пройден!' : 'Почти получилось!'}</h3>
      <p>${scoreText}</p>
      ${won && level < MAX_GAME_LEVEL ? '<button type="button" class="modal-btn game-result-next">Следующий уровень →</button>' : ''}
      <button type="button" class="modal-btn secondary game-result-close">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('visible'));

  const dismiss = () => {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 250);
  };

  modal.querySelector('.game-result-close').onclick = () => { dismiss(); onClose?.(); };
  modal.querySelector('.game-result-next')?.addEventListener('click', () => {
    dismiss();
    onNext?.();
  });
}

export default { getGameLevel, recordGameWin, createGameScreen, showGameResult, MAX_GAME_LEVEL };
