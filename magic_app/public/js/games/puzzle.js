import { appState, getActiveChild, getActiveChildName } from '../core.js';
import { updateAchievement } from '../achievements.js';
import { recordPuzzleWin } from '../game-progress.js';
import { setAvatarState } from '../ui.js';
import { trackEvent } from '../analytics.js';
import {
  createGameScreen, showGameResult, recordGameWin, getGameLevel,
  createConfetti, triggerGameWin, resetGameSession, loadImageForCanvas
} from './game-ui.js';
import { avatarUrl } from '../config.js';
import { getPuzzleGrid } from './game-difficulty.js';

class PuzzleGame {
  constructor(size, level, overlay, onWin) {
    this.size = size;
    this.level = level;
    this.overlay = overlay;
    this.onWin = onWin;
    this.tiles = [];
    this.emptyIndex = size * size - 1;
    this.moves = 0;
    this.solved = false;
    this.image = new Image();
    this.imageLoaded = false;
  }

  async loadImage() {
    try {
      this.image = await loadImageForCanvas(avatarUrl('lucik', 'svg'));
      this.imageLoaded = true;
    } catch {
      this.imageLoaded = false;
    }
  }

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvasSize = 300;
    this.tileSize = this.canvasSize / this.size;
    canvas.width = this.canvasSize;
    canvas.height = this.canvasSize + 36;

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const index = row * this.size + col;
        this.tiles.push({
          index,
          correctRow: row,
          correctCol: col,
          currentRow: row,
          currentCol: col
        });
      }
    }

    this.shuffle();
    this.draw();

    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left) * (canvas.width / r.width);
      const my = (e.clientY - r.top) * (canvas.height / r.height);
      if (my > this.canvasSize) return;
      this.handleClick(mx, my);
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      const mx = (t.clientX - r.left) * (canvas.width / r.width);
      const my = (t.clientY - r.top) * (canvas.height / r.height);
      if (my > this.canvasSize) return;
      this.handleClick(mx, my);
    }, { passive: false });
  }

  shuffle() {
    for (let i = 0; i < 100; i++) {
      const neighbors = this.getValidMoves();
      if (neighbors.length > 0) {
        const tile = neighbors[Math.floor(Math.random() * neighbors.length)];
        this.moveTile(tile, false);
      }
    }
    this.moves = 0;
    this.solved = false;
  }

  getValidMoves() {
    const empty = this.tiles[this.emptyIndex];
    return this.tiles.filter((t) => {
      if (t.index === this.emptyIndex) return false;
      const dr = Math.abs(t.currentRow - empty.currentRow);
      const dc = Math.abs(t.currentCol - empty.currentCol);
      return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    });
  }

  moveTile(tile, animate = true) {
    const empty = this.tiles[this.emptyIndex];
    [tile.currentRow, empty.currentRow] = [empty.currentRow, tile.currentRow];
    [tile.currentCol, empty.currentCol] = [empty.currentCol, tile.currentCol];
    this.emptyIndex = tile.index;
    if (animate) this.moves++;

    if (animate && this.canvas) {
      this.canvas.style.transform = 'scale(1.02)';
      setTimeout(() => { this.canvas.style.transform = 'scale(1)'; }, 150);
    }

    if (this.checkWin()) {
      this.onWinAction();
    } else {
      this.draw();
    }
  }

  checkWin() {
    return this.tiles.every(
      (t) => t.currentRow === t.correctRow && t.currentCol === t.correctCol
    );
  }

  onWinAction() {
    if (this.solved) return;
    this.solved = true;
    this.draw();
    triggerGameWin(this.overlay);
    window.ttsEngine?.speak(`Ура! Ты собрал пазл! Всего за ${this.moves} ходов!`);
    this.onWin(this.moves);
  }

  drawWoodBackground(ctx) {
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);
    ctx.strokeStyle = 'rgba(139,90,43,0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.canvasSize; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, i + Math.sin(i * 0.1) * 3);
      ctx.lineTo(this.canvasSize, i + Math.cos(i * 0.1) * 3);
      ctx.stroke();
    }
  }

  draw() {
    const ctx = this.ctx;
    const ts = this.tileSize;
    if (!ctx) return;

    this.drawWoodBackground(ctx);

    const imgReady = this.imageLoaded && this.image?.complete;

    this.tiles.forEach((tile) => {
      if (tile.index === this.emptyIndex) return;

      const x = tile.currentCol * ts;
      const y = tile.currentRow * ts;

      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 3, y + 3, ts - 2, ts - 2);

      if (imgReady) {
        const iw = this.image.naturalWidth || this.image.width || 300;
        const ih = this.image.naturalHeight || this.image.height || 300;
        const sw = iw / this.size;
        const sh = ih / this.size;
        ctx.drawImage(
          this.image,
          tile.correctCol * sw,
          tile.correctRow * sh,
          sw,
          sh,
          x + 1,
          y + 1,
          ts - 3,
          ts - 3
        );
      } else {
        const hue = (tile.index * 37) % 360;
        ctx.fillStyle = `hsl(${hue}, 55%, 55%)`;
        ctx.fillRect(x + 1, y + 1, ts - 3, ts - 3);
      }

      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, ts - 5, ts - 5);
    });

    const empty = this.tiles[this.emptyIndex];
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(empty.currentCol * ts, empty.currentRow * ts, ts, ts);

    ctx.fillStyle = '#8B4513';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText(`Ходы: ${this.moves}`, 10, this.canvasSize + 24);
  }

  handleClick(mx, my) {
    if (this.solved) return;
    const col = Math.floor(mx / this.tileSize);
    const row = Math.floor(my / this.tileSize);
    const tile = this.tiles.find(
      (t) => t.currentRow === row && t.currentCol === col && t.index !== this.emptyIndex
    );
    if (tile && this.getValidMoves().includes(tile)) {
      this.moveTile(tile);
    }
  }
}

export function startPuzzleGame(level) {
  resetGameSession();
  level = level || getGameLevel('puzzle');
  runPuzzle(level);
}

async function runPuzzle(level) {
  const age = getActiveChild()?.age || 7;
  const size = getPuzzleGrid(age, level);

  const { body, close, overlay } = createGameScreen({
    gameId: 'puzzle',
    title: `Пазл ${size}×${size}`,
    emoji: '🧩',
    level
  });

  const wrap = document.createElement('div');
  wrap.className = 'puzzle-canvas-wrap';
  wrap.style.cssText = 'padding:12px;background:linear-gradient(180deg,#DEB887,#8B4513);border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,0.35);';

  const canvas = document.createElement('canvas');
  canvas.className = 'puzzle-pixar-canvas';
  canvas.style.cssText = 'display:block;border-radius:12px;max-width:100%;touch-action:none;';
  wrap.appendChild(canvas);
  body.appendChild(wrap);

  const game = new PuzzleGame(size, level, overlay, (moves) => {
    updateAchievement('puzzle_solver');
    recordPuzzleWin(getActiveChildName());
    recordGameWin('puzzle', level);
    setAvatarState('happy');
    appState.gameActive = false;
    close();
    setTimeout(() => setAvatarState(null), 800);
    showGameResult({
      won: true,
      level,
      scoreText: `Собрано за ${moves} ходов!`,
      onNext: () => startPuzzleGame(level + 1)
    });
    trackEvent('puzzle_won', { level, moves, gridSize: size });
  });

  await game.loadImage();
  game.init(canvas);
  trackEvent('puzzle_started', { level, gridSize: size });
}

export default { startPuzzleGame };
