import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel, createConfetti } from './game-ui.js';
import { getPuzzleGrid } from './game-difficulty.js';
import { avatarUrl } from '../config.js';

class Puzzle {
  constructor(size, onWin) {
    this.size = size;
    this.tiles = [];
    this.empty = size * size - 1;
    this.moves = 0;
    this.solved = false;
    this.onWin = onWin;
  }

  init(canvas, img) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.img = img;
    this.ts = Math.floor(300 / this.size);

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        this.tiles.push({ cr: r, cc: c, tr: r, tc: c, i: r * this.size + c });
      }
    }

    for (let i = 0; i < 100; i++) {
      const moves = this.validMoves();
      if (moves.length) this.swap(moves[Math.floor(Math.random() * moves.length)], false);
    }
    this.moves = 0;
    this.draw();
  }

  validMoves() {
    const e = this.tiles[this.empty];
    return this.tiles.filter((t) => t !== e && ((Math.abs(t.cr - e.cr) === 1 && t.cc === e.cc) || (Math.abs(t.cc - e.cc) === 1 && t.cr === e.cr)));
  }

  swap(tile, count = true) {
    const e = this.tiles[this.empty];
    [tile.cr, e.cr] = [e.cr, tile.cr];
    [tile.cc, e.cc] = [e.cc, tile.cc];
    this.empty = tile.i;
    if (count) this.moves++;
    this.draw();
    if (this.tiles.every((t) => t.cr === t.tr && t.cc === t.tc)) this.win();
  }

  draw() {
    const ctx = this.ctx; const ts = this.ts;
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, 0, 300, 300);

    this.tiles.forEach((t) => {
      if (t.i === this.empty) return;
      const x = t.cc * ts; const y = t.cr * ts;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 2, y + 2, ts - 2, ts - 2);
      ctx.drawImage(this.img, t.tc * (120 / this.size), t.tr * (120 / this.size), 120 / this.size, 120 / this.size, x, y, ts - 2, ts - 2);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, ts - 4, ts - 4);
    });

    const e = this.tiles[this.empty];
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(e.cc * ts, e.cr * ts, ts, ts);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px Georgia';
    ctx.fillText(`Ходы: ${this.moves}`, 10, 320);
  }

  click(mx, my) {
    if (this.solved) return;
    const c = Math.floor(mx / this.ts); const r = Math.floor(my / this.ts);
    const tile = this.tiles.find((t) => t.cr === r && t.cc === c && t.i !== this.empty);
    if (tile && this.validMoves().includes(tile)) this.swap(tile);
  }

  win() {
    if (this.solved) return;
    this.solved = true;
    createConfetti(document.querySelector('.game-fullscreen') || document.body);
    speak('Ура! Пазл собран!');
    this.onWin?.(this.moves);
  }
}

export function startPuzzleGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('puzzle');
  const size = getPuzzleGrid(7, level);

  const { body, close } = createGameScreen({ gameId: 'puzzle', title: `🧩 Пазл ${size}×${size}`, emoji: '🧩', level });

  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:16px;background:linear-gradient(180deg,#DEB887,#8B4513);border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,0.4);';

  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 340;
  canvas.style.cssText = 'display:block;border-radius:12px;cursor:pointer;max-width:100%;';
  wrap.appendChild(canvas);
  body.appendChild(wrap);

  const img = new Image();
  img.src = avatarUrl('lucik', 'svg');

  const game = new Puzzle(size, (moves) => {
    appState.gameActive = false;
    close();
    recordGameResult('puzzle', true, level);
    recordGameWin('puzzle', level);
    updateAchievement('puzzle_solver');
    checkProgressAchievements();
    trackEvent('puzzle_won', { level, moves, gridSize: size });
    showGameResult({
      won: true, level,
      scoreText: `Собрано за ${moves} ходов!`,
      onNext: () => startPuzzleGame(level + 1),
      onRestart: () => startPuzzleGame(level)
    });
  });

  img.onload = () => { game.init(canvas, img); };
  img.onerror = () => { img.src = avatarUrl('lucik', 'png'); };
  setTimeout(() => { if (!img.complete) game.init(canvas, img); }, 1000);

  canvas.onclick = (e) => {
    const r = canvas.getBoundingClientRect();
    game.click((e.clientX - r.left) * (300 / r.width), (e.clientY - r.top) * (300 / r.height));
  };

  trackEvent('puzzle_started', { level, gridSize: size });
}

export default { startPuzzleGame };
