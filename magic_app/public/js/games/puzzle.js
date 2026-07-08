import { appState } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

export function startPuzzleGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const sizes = [3, 4, 6];
  const size = sizes[Math.min(level, 3) - 1] || 3;
  const PUZZLE_IMAGES = ['avatar.png', 'mom.png', 'dad.png', 'kid1.png', 'kid2.png'];
  let moves = 0, ended = false;
  const totalTiles = size * size;
  const emptyIdx = totalTiles - 1;

  let tiles = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) tiles.push({ r, c, tr: r, tc: c });

  function validMoves() {
    const e = tiles[emptyIdx];
    return tiles.filter(t => t !== e && ((Math.abs(t.r - e.r) === 1 && t.c === e.c) || (Math.abs(t.c - e.c) === 1 && t.r === e.r)));
  }

  function swap(tile, count = true) {
    const e = tiles[emptyIdx];
    const er = e.r, ec = e.c;
    e.r = tile.r; e.c = tile.c;
    tile.r = er; tile.c = ec;
    if (count) moves++;
  }

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;background:linear-gradient(180deg,#DEB887,#8B4513);align-items:center;justify-content:center;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;width:100%;padding:12px 16px;background:rgba(0,0,0,0.3);color:#fff;font-size:18px;';
  header.innerHTML = '<span>🧩 Пазл ' + size + '×' + size + '</span><span>Ходы: <b id="pm">0</b></span><button id="pc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 340;
  canvas.style.cssText = 'border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.4);cursor:pointer;';

  overlay.appendChild(header);
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const ctx = canvas.getContext('2d');
  const ts = Math.floor(300 / size);
  const img = new Image();
  let imgReady = false, gameInited = false;

  function draw() {
    ctx.fillStyle = '#D2B48C';
    ctx.fillRect(0, 0, 300, 300);

    ctx.strokeStyle = 'rgba(139,90,43,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 300; i += 6) {
      ctx.beginPath();
      ctx.moveTo(0, i + Math.sin(i * 0.05) * 4);
      ctx.lineTo(300, i + Math.cos(i * 0.07) * 4);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(160,120,70,0.1)';
    for (let i = 0; i < 300; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i + Math.sin(i) * 3, 0);
      ctx.lineTo(i + Math.cos(i) * 3, 300);
      ctx.stroke();
    }

    const knots = [{ x: 50, y: 40 }, { x: 240, y: 120 }, { x: 150, y: 260 }];
    knots.forEach((k) => {
      ctx.fillStyle = 'rgba(139,90,43,0.2)';
      ctx.beginPath();
      ctx.arc(k.x, k.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,70,30,0.3)';
      ctx.beginPath();
      ctx.arc(k.x, k.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    tiles.forEach(t => {
      const idx = t.r * size + t.c;
      if (idx === emptyIdx) return;
      const x = t.c * ts, y = t.r * ts;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x+2, y+2, ts-2, ts-2);
      if (imgReady && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, t.tc*(img.naturalWidth/size), t.tr*(img.naturalHeight/size), img.naturalWidth/size, img.naturalHeight/size, x, y, ts-2, ts-2);
      }
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.strokeRect(x+1, y+1, ts-4, ts-4);
    });
    const e = tiles[emptyIdx];
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(e.c * ts, e.r * ts, ts, ts);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('Ходы: '+moves, 10, 325);
  }

  function initGame() {
    if (gameInited) return;
    gameInited = true;
    for (let i = 0; i < 100; i++) { const m = validMoves(); if (m.length) swap(m[Math.floor(Math.random()*m.length)], false); }
    moves = 0;
    draw();
  }

  img.onload = () => { imgReady = true; initGame(); };
  img.onerror = () => { img.src = 'assets/images/kid1.png'; img.onerror = () => { imgReady = true; initGame(); }; };
  img.src = 'assets/images/' + PUZZLE_IMAGES[(level-1) % 5];
  if (img.complete) { imgReady = true; initGame(); }
  setTimeout(() => { if (!imgReady) { imgReady = true; initGame(); } }, 3000);

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
    result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">🧩</div><h2 style="margin:12px 0;color:#222;font-size:22px;">Пазл собран!</h2><p style="color:#444;font-size:16px;">За '+moves+' ходов</p><button id="pr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 Ещё раз</button><button id="pe" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
    document.body.appendChild(result);
    result.querySelector('#pr').onclick = () => { result.remove(); startPuzzleGame(level+1); };
    result.querySelector('#pe').onclick = () => { result.remove(); if(typeof showGamesMenu==='function') showGamesMenu(); };
  }

  canvas.onclick = function(e) {
    if (ended || !gameInited) return;
    var r = canvas.getBoundingClientRect();
    var mx = (e.clientX - r.left) * (300 / r.width);
    var my = (e.clientY - r.top) * (300 / r.height);
    if (my > 300) return;
    var c = Math.floor(mx / ts), row = Math.floor(my / ts);
    var tile = tiles.find(function(t) { return t.r === row && t.c === c && (t.r*size+t.c) !== emptyIdx; });
    if (tile && validMoves().includes(tile)) {
      swap(tile);
      draw();
      var pmEl = document.getElementById('pm');
      if (pmEl) pmEl.textContent = moves;
      if (tiles.every(function(t) { return t.r === t.tr && t.c === t.tc; })) finish();
    }
  };

  document.getElementById('pc').onclick = function() {
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('puzzle_started', { level, size });
}

export default { startPuzzleGame };
