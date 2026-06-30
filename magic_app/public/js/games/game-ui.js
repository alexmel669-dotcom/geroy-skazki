// ========================================
// game-ui.js — полноэкранные игры с уровнями + мультяшный визуал
// ========================================

import { loadGameProgress, saveGameProgress } from '../game-progress.js';
import { getActiveChildName } from '../core.js';

const GAME_THEMES = {
  fish: { starfield: false, lucikText: 'Лови рыбку!' },
  puzzle: { starfield: false, lucikText: 'Сложи пазл!' },
  memory: { starfield: true, lucikText: 'Найди пару!' },
  riddles: { starfield: false, lucikText: 'Отгадай загадку!' },
  quest: { starfield: false, lucikText: 'Выбирай путь!' },
  maze: { starfield: true, lucikText: 'Найди выход!' },
  quiz: { starfield: false, lucikText: 'Знаешь ответ?' },
  runner: { starfield: false, lucikText: 'Беги, Люцик!' },
  drawAi: { starfield: false, lucikText: 'Рисуй красиво!' },
  musicCat: { starfield: false, lucikText: 'Пой со мной!' },
  constellation: { starfield: true, lucikText: 'Соедини звёзды!' },
  popFears: { starfield: true, lucikText: 'Лопай страхи!' }
};

/** Единые цветовые темы для всех игр */
const GAME_STYLE_THEMES = {
  fish: { bg: 'linear-gradient(180deg, #1e3a5f, #0d1b2a)', accent: '#4ECDC4' },
  puzzle: { bg: 'linear-gradient(180deg, #DEB887, #8B4513)', accent: '#FFD700' },
  memory: { bg: 'linear-gradient(180deg, #1a0a2e, #0d0618)', accent: '#7B68EE' },
  riddles: { bg: 'linear-gradient(180deg, #3e2723, #1a1008)', accent: '#FFB347' },
  quest: { bg: 'linear-gradient(180deg, #2d5a27, #1a3a15)', accent: '#FFD700' },
  maze: { bg: 'linear-gradient(180deg, #1a1a2e, #0a0a15)', accent: '#FFD700' },
  quiz: { bg: 'linear-gradient(180deg, #2C003E, #1A0025)', accent: '#FF6B9D' },
  runner: { bg: 'linear-gradient(180deg, #87CEEB, #2d5a27)', accent: '#FF8C00' },
  drawAi: { bg: 'linear-gradient(180deg, #FFF8E1, #FFECB3)', accent: '#FF6B6B' },
  musicCat: { bg: 'linear-gradient(180deg, #2C003E, #0A0015)', accent: '#FFD700' },
  constellation: { bg: 'radial-gradient(circle, #1a0533, #000008)', accent: '#FFD700' },
  popFears: { bg: 'linear-gradient(180deg, #1a0533, #2d1b69)', accent: '#7B68EE' }
};

export function applyGameStyle(gameId) {
  return GAME_STYLE_THEMES[gameId] || GAME_STYLE_THEMES.memory;
}

const starfieldControllers = new WeakMap();

export function getGameLevel(gameId) {
  const p = loadGameProgress(getActiveChildName());
  const block = p[gameId] || {};
  return Math.max(1, block.level || 1);
}

export function recordGameWin(gameId, level) {
  const name = getActiveChildName();
  const p = loadGameProgress(name);
  const block = { ...(p[gameId] || {}), wins: (p[gameId]?.wins || 0) + 1 };
  if (level >= (block.level || 1)) {
    block.level = level + 1;
  } else {
    block.level = Math.max(block.level || 1, level);
  }
  block.lastLevel = level;
  p[gameId] = block;
  saveGameProgress(p, name);
  return block.level;
}

/** Canvas-звёздное небо */
export function createStarfield(canvas) {
  const ctx = canvas.getContext('2d');
  let stars = [];
  let animId = null;

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w < 1 || h < 1) return;
    canvas.width = w;
    canvas.height = h;
    stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2 + 0.5,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.03
    }));
  }

  function draw() {
    if (!canvas.isConnected) {
      if (animId) cancelAnimationFrame(animId);
      return;
    }
    ctx.fillStyle = 'rgba(13, 27, 42, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach((s) => {
      s.twinkle += s.speed;
      const alpha = 0.3 + Math.sin(s.twinkle) * 0.4;
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
      ctx.fill();
    });

    animId = requestAnimationFrame(draw);
  }

  const onResize = () => resize();
  resize();
  draw();
  window.addEventListener('resize', onResize);

  const controller = {
    stop() {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    }
  };
  starfieldControllers.set(canvas, controller);
  return controller;
}

/** Конфетти при победе */
export function createConfetti(container) {
  const colors = ['#FF6B9D', '#FFD700', '#7B68EE', '#4CAF50', '#FF8C00'];
  const host = container || document.body;
  const layer = document.createElement('div');
  layer.className = 'game-confetti-layer';
  host.appendChild(layer);

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'game-confetti-particle';
    const rot = 360 + Math.floor(Math.random() * 720);
    const dur = 2 + Math.random() * 3;
    particle.style.cssText = `
      width: ${8 + Math.random() * 10}px;
      height: ${8 + Math.random() * 10}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      left: ${Math.random() * 100}%;
      top: -20px;
      animation-duration: ${dur}s;
      animation-delay: ${Math.random() * 0.5}s;
      --confetti-rot: ${rot}deg;
    `;
    layer.appendChild(particle);
  }

  setTimeout(() => layer.remove(), 5000);
}

/** Сердечки при совпадении (мемори) */
export function spawnMatchHearts(container, x, y) {
  const host = container || document.body;
  for (let i = 0; i < 5; i++) {
    const heart = document.createElement('span');
    heart.className = 'game-match-heart';
    heart.textContent = '💖';
    heart.style.left = `${x + (Math.random() - 0.5) * 40}px`;
    heart.style.top = `${y + (Math.random() - 0.5) * 20}px`;
    heart.style.animationDelay = `${i * 0.08}s`;
    host.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
  }
}

export function triggerGameWin(overlay) {
  if (overlay) {
    overlay.dispatchEvent(new CustomEvent('gameWin', { bubbles: true }));
    createConfetti(overlay);
  } else {
    createConfetti(document.body);
  }
}

/** Обёртка createGameScreen с красивым оформлением */
export function createBeautifulGame(title, config = {}) {
  return createGameScreen({
    gameId: config.gameId || 'memory',
    title,
    emoji: config.emoji || '🎮',
    level: config.level,
    starfield: config.starfield,
    lucik: config.lucik,
    lucikText: config.lucikText
  });
}

export function createGameScreen({
  gameId,
  title,
  emoji = '🎮',
  level: levelOverride,
  starfield,
  lucik = true,
  lucikText
} = {}) {
  const level = levelOverride ?? getGameLevel(gameId);
  const theme = GAME_THEMES[gameId] || { starfield: true, lucikText: 'Давай играть!' };
  const style = applyGameStyle(gameId);
  const useStarfield = starfield !== undefined ? starfield : theme.starfield !== false;
  const bubbleText = lucikText || theme.lucikText || 'Давай играть!';
  const filledDots = ((level - 1) % 5) + 1;

  const overlay = document.createElement('div');
  overlay.className = `game-screen game-fullscreen game-theme-${gameId}`;
  overlay.setAttribute('role', 'dialog');
  overlay.dataset.gameId = gameId;

  overlay.innerHTML = `
    <div class="game-screen-bg game-theme-bg" aria-hidden="true"></div>
    <div class="game-screen-stars game-theme-decor" aria-hidden="true"></div>
    <header class="game-screen-header game-header">
      <div class="game-screen-meta">
        <span class="game-screen-emoji">${emoji}</span>
        <div>
          <div class="game-screen-title game-title">${title}</div>
          <div class="game-level-track">
            <span class="game-level-badge game-level">Ур. ${level}</span>
            <div class="game-level-dots game-stars-counter">${Array.from({ length: 5 }, (_, i) =>
              `<span class="game-level-dot${i < filledDots ? ' filled' : ''}"></span>`
            ).join('')}</div>
          </div>
        </div>
      </div>
      <button type="button" class="game-close-btn game-close" aria-label="Закрыть">✕</button>
    </header>
    <div class="game-screen-body game-content"></div>
    <footer class="game-footer game-theme-footer" aria-hidden="true"></footer>
  `;

  const body = overlay.querySelector('.game-screen-body');
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('game-screen-visible'));

  const bgEl = overlay.querySelector('.game-screen-bg');
  if (bgEl) {
    bgEl.style.background = style.bg;
    overlay.style.setProperty('--game-theme-bg', style.bg);
    overlay.style.setProperty('--game-theme-accent', style.accent);
  }

  let starfieldCtrl = null;
  if (useStarfield) {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.className = 'game-starfield-canvas';
    bgCanvas.setAttribute('aria-hidden', 'true');
    body.insertBefore(bgCanvas, body.firstChild);
    requestAnimationFrame(() => { starfieldCtrl = createStarfield(bgCanvas); });
  }

  if (lucik !== false) {
    const lucikEl = document.createElement('div');
    lucikEl.className = 'game-lucik';
    lucikEl.innerHTML = `
      <img src="assets/images/avatar.png" alt="Люцик" width="50" height="50">
      <span class="lucik-bubble">${bubbleText}</span>
    `;
    overlay.appendChild(lucikEl);
  }

  overlay.addEventListener('gameWin', () => createConfetti(overlay));

  const close = () => {
    starfieldCtrl?.stop();
    overlay.classList.remove('game-screen-visible');
    setTimeout(() => overlay.remove(), 280);
  };
  overlay.querySelector('.game-close-btn').onclick = close;

  return { overlay, body, level, close, gameId, triggerWin: () => triggerGameWin(overlay) };
}

export function showGameResult({ won, level, scoreText, onNext, onClose }) {
  if (won) createConfetti(document.body);

  const modal = document.createElement('div');
  modal.className = 'game-result-modal';
  modal.innerHTML = `
    <div class="game-result-box ${won ? 'won' : 'lost'}">
      <div class="game-result-icon">${won ? '🎉' : '💪'}</div>
      <h3>${won ? 'Уровень пройден!' : 'Почти получилось!'}</h3>
      <p class="game-score">${scoreText}</p>
      ${won ? '<button type="button" class="modal-btn game-result-next">Следующий уровень →</button>' : ''}
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

export default {
  getGameLevel, recordGameWin, createGameScreen, createBeautifulGame,
  showGameResult, createStarfield, createConfetti, spawnMatchHearts, triggerGameWin,
  applyGameStyle
};
