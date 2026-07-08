import { appState, showGamesMenu } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

export function startPuzzleGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const sizes = [3, 4, 6];
  const size = sizes[Math.min(level, 3) - 1] || 3;
  let moves = 0;
  let emptyIdx = size * size - 1;
  let ended = false;

  const tiles = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      tiles.push({ r, c, tr: r, tc: c });
    }
  }
  const emptyTile = tiles[tiles.length - 1];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 300;
  canvas.height = 340;
  canvas.style.cssText = 'border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.4);cursor:pointer;';
  const ts = Math.floor(300 / size);
  const img = new Image();
  let imgFallbackTried = false;
  let started = false;

  function draw() {
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(0, 0, 300, 300);

    tiles.forEach((t) => {
      if (t === emptyTile) return;
      const x = t.c * ts;
      const y = t.r * ts;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 2, y + 2, ts - 2, ts - 2);

      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, t.tc * (120 / size), t.tr * (120 / size), 120 / size, 120 / size, x, y, ts - 2, ts - 2);
      } else {
        ctx.fillStyle = `hsl(${(t.tr * size + t.tc) * 37},55%,55%)`;
        ctx.fillRect(x, y, ts - 2, ts - 2);
      }

      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, ts - 4, ts - 4);
    });

    const e = emptyTile;
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(e.c * ts, e.r * ts, ts, ts);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Ходы: ${moves}`, 10, 325);
  }

  function validMoves() {
    const e = emptyTile;
    return tiles.filter((t) => t !== e && (
      (Math.abs(t.r - e.r) === 1 && t.c === e.c)
      || (Math.abs(t.c - e.c) === 1 && t.r === e.r)
    ));
  }

  function swap(tile, count = true) {
    const e = emptyTile;
    [tile.r, e.r] = [e.r, tile.r];
    [tile.c, e.c] = [e.c, tile.c];
    emptyIdx = e.r * size + e.c;
    if (count) {
      moves++;
      document.getElementById('pm').textContent = moves;
    }
    draw();
    if (count && tiles.every((t) => t.r === t.tr && t.c === t.tc)) finish();
  }

  function shuffleAndDraw() {
    if (started) return;
    started = true;
    for (let i = 0; i < 100; i++) {
      const m = validMoves();
      if (m.length) swap(m[Math.floor(Math.random() * m.length)], false);
    }
    moves = 0;
    draw();
  }

  img.onload = shuffleAndDraw;
  img.onerror = () => {
    if (!imgFallbackTried) {
      imgFallbackTried = true;
      img.src = 'assets/images/kid1.png';
    } else {
      shuffleAndDraw();
    }
  };
  img.src = 'assets/images/avatar.png';
  if (img.complete) shuffleAndDraw();

  setTimeout(() => {
    if (!started && tiles.every((t) => t.r === t.tr && t.c === t.tc)) {
      shuffleAndDraw();
    }
  }, 2000);

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;background:linear-gradient(180deg,#DEB887,#8B4513);align-items:center;justify-content:center;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;width:100%;padding:12px 16px;background:rgba(0,0,0,0.3);color:#fff;font-size:18px;';
  header.innerHTML = `<span>🧩 Пазл ${size}×${size}</span><span>Ходы: <b id="pm">0</b></span><button id="pc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>`;

  overlay.appendChild(header);
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  canvas.onclick = (ev) => {
    if (ended) return;
    const r = canvas.getBoundingClientRect();
    const mx = (ev.clientX - r.left) * (300 / r.width);
    const my = (ev.clientY - r.top) * (300 / r.height);
    if (my > 300) return;
    const c = Math.floor(mx / ts);
    const row = Math.floor(my / ts);
    const tile = tiles.find((t) => t.r === row && t.c === c && t !== emptyTile);
    if (tile && validMoves().includes(tile)) swap(tile);
  };

  function finish() {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();

    recordGameResult('puzzle', true, level);
    updateAchievement('puzzle_solver');
    checkProgressAchievements();
    trackEvent('puzzle_end', { level, moves, size });

    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
        <div style="font-size:48px;">🧩</div>
        <h2 style="margin:12px 0;color:#222;font-size:22px;">Пазл собран!</h2>
        <p style="color:#444;font-size:16px;">За ${moves} ходов</p>
        <button id="pr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 Ещё раз</button>
        <button id="pe" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button>
      </div>
    `;
    document.body.appendChild(result);
    result.querySelector('#pr').onclick = () => { result.remove(); startPuzzleGame(level + 1); };
    result.querySelector('#pe').onclick = () => { result.remove(); showGamesMenu(); };
  }

  document.getElementById('pc').onclick = () => {
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('puzzle_started', { level, size });
}

export default { startPuzzleGame };
