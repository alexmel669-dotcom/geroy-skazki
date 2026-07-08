// ========================================
// maze.js — Лабиринт в стиле Гарри Поттера (v5.6.6)
// ========================================

import { appState } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

const SIZES = [7, 11, 15];
const MAX_STEPS = [40, 70, 100];

function generateMaze(size) {
  const m = Array(size).fill().map(() => Array(size).fill(1));
  const v = Array(size).fill().map(() => Array(size).fill(false));
  function carve(x, y) {
    v[y][x] = true; m[y][x] = 0;
    const dirs = [[0,-2],[2,0],[0,2],[-2,0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && !v[ny][nx]) {
        m[y + dy/2][x + dx/2] = 0; carve(nx, ny);
      }
    }
  }
  carve(1, 1);
  m[1][0] = 0; m[size-2][size-1] = 0;
  if (m[size-2][size-2] === 1) m[size-2][size-2] = 0;
  return m;
}

export function startMazeGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const size = SIZES[Math.min(level, 3) - 1] || 7;
  const maxSteps = MAX_STEPS[Math.min(level, 3) - 1] || 40;
  const maze = generateMaze(size);
  let px = 0, py = 1, steps = 0, ended = false;
  const exitX = size - 1, exitY = size - 2;
  const visited = [[px, py]];

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playStep() { const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sine';o.frequency.value=300;g.gain.setValueAtTime(0.05,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.1);o.start();o.stop(audioCtx.currentTime+0.1); }
  function playWin() { [523,659,784,1047].forEach((f,i)=>{setTimeout(()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.12,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.start();o.stop(audioCtx.currentTime+0.2);},i*120);}); }

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;background:#0a0a15;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:rgba(0,0,0,0.6);color:#fff;font-size:16px;z-index:10;';
  header.innerHTML = '<span>🌀 Лабиринт</span><span id="ml">Шаги: 0/'+maxSteps+'</span><button id="mc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  const gameArea = document.createElement('div');
  gameArea.style.cssText = 'flex:1;position:relative;display:flex;align-items:center;justify-content:center;';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'border-radius:12px;box-shadow:0 0 40px rgba(0,0,0,0.6);';

  // Мини-карта
  const miniCanvas = document.createElement('canvas');
  miniCanvas.width = 120; miniCanvas.height = 120;
  miniCanvas.style.cssText = 'position:absolute;bottom:10px;right:10px;border-radius:8px;border:2px solid #8B4513;box-shadow:0 0 20px rgba(0,0,0,0.6);z-index:5;background:#f4e4c1;';
  const miniCtx = miniCanvas.getContext('2d');

  gameArea.appendChild(canvas);
  gameArea.appendChild(miniCanvas);
  overlay.appendChild(header);
  overlay.appendChild(gameArea);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const ctx = canvas.getContext('2d');
  let cs;

  const torches = [];
  for (let i = 0; i < 8; i++) {
    torches.push({ x: 0, y: 0, flicker: Math.random() * Math.PI * 2 });
  }

  function drawMiniMap() {
    const mcs = 120 / size;
    miniCtx.fillStyle = '#f4e4c1'; miniCtx.fillRect(0, 0, 120, 120);
    miniCtx.strokeStyle = 'rgba(139,69,19,0.3)';
    for (let i = 0; i < 120; i += 8) { miniCtx.beginPath(); miniCtx.moveTo(i, 0); miniCtx.lineTo(i+4, 120); miniCtx.stroke(); }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (maze[y][x] === 1) {
          miniCtx.fillStyle = '#5D4037'; miniCtx.fillRect(x*mcs, y*mcs, mcs, mcs);
        }
      }
    }
    visited.forEach(([x, y]) => {
      miniCtx.fillStyle = 'rgba(255,140,0,0.6)'; miniCtx.beginPath();
      miniCtx.arc(x*mcs+mcs/2, y*mcs+mcs/2, mcs/3, 0, Math.PI*2); miniCtx.fill();
    });
    miniCtx.fillStyle = '#FF8C00'; miniCtx.beginPath();
    miniCtx.arc(px*mcs+mcs/2, py*mcs+mcs/2, mcs/2.5, 0, Math.PI*2); miniCtx.fill();
    miniCtx.fillStyle = '#FFD700'; miniCtx.font = (mcs*0.8)+'px serif'; miniCtx.textAlign = 'center';
    miniCtx.fillText('🏆', exitX*mcs+mcs/2, exitY*mcs+mcs*0.8);
  }

  function draw() {
    ctx.fillStyle = '#0a0a15'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Туман
    ctx.fillStyle = 'rgba(200,200,220,0.03)';
    for (let i = 0; i < 20; i++) {
      ctx.beginPath(); ctx.arc(Math.random()*canvas.width, Math.random()*canvas.height, 40+Math.random()*60, 0, Math.PI*2); ctx.fill();
    }

    // Факелы
    torches.forEach(t => {
      const alpha = 0.3 + Math.sin(Date.now()/500 + t.flicker) * 0.2;
      const glow = ctx.createRadialGradient(t.x, t.y, 5, t.x, t.y, 30);
      glow.addColorStop(0, 'rgba(255,150,50,'+alpha+')'); glow.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(t.x, t.y, 30, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#FFA000'; ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, Math.PI*2); ctx.fill();
    });

    // Стены — живая изгородь
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (maze[y][x] === 1) {
          const grad = ctx.createLinearGradient(x*cs, y*cs, (x+1)*cs, (y+1)*cs);
          grad.addColorStop(0, '#1a3a15'); grad.addColorStop(0.5, '#2d5a27'); grad.addColorStop(1, '#1a3a15');
          ctx.fillStyle = grad; ctx.fillRect(x*cs, y*cs, cs, cs);
          // Листья
          ctx.fillStyle = 'rgba(50,120,50,0.4)';
          for (let l = 0; l < 3; l++) {
            ctx.beginPath(); ctx.arc(x*cs+Math.random()*cs, y*cs+Math.random()*cs, cs/6, 0, Math.PI*2); ctx.fill();
          }
          // Паутина в тупиках
          const neighbors = [[0,1],[0,-1],[1,0],[-1,0]].filter(([dx,dy]) => {
            const nx=x+dx, ny=y+dy;
            return nx>=0 && nx<size && ny>=0 && ny<size && maze[ny][nx]===1;
          }).length;
          if (neighbors >= 3) {
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(x*cs+cs*0.2, y*cs+cs*0.2);
            ctx.lineTo(x*cs+cs*0.5, y*cs+cs*0.5); ctx.lineTo(x*cs+cs*0.8, y*cs+cs*0.3); ctx.stroke();
          }
        }
      }
    }

    // Кубок на финише
    const ex = exitX * cs + cs/2, ey = exitY * cs + cs/2;
    const exitGlow = ctx.createRadialGradient(ex, ey, 5, ex, ey, cs*1.5);
    exitGlow.addColorStop(0, 'rgba(255,215,0,0.8)'); exitGlow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = exitGlow; ctx.beginPath(); ctx.arc(ex, ey, cs*1.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = (cs*0.6)+'px serif'; ctx.textAlign = 'center';
    ctx.fillText('🏆', ex, ey + cs*0.2);

    // Люцик
    const lx = px * cs + cs/2, ly = py * cs + cs/2;
    const lucikGlow = ctx.createRadialGradient(lx, ly, cs*0.2, lx, ly, cs*0.8);
    lucikGlow.addColorStop(0, 'rgba(255,180,50,0.9)'); lucikGlow.addColorStop(1, 'rgba(255,140,0,0)');
    ctx.fillStyle = lucikGlow; ctx.beginPath(); ctx.arc(lx, ly, cs*0.8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#FF8C00'; ctx.beginPath(); ctx.arc(lx, ly, cs*0.35, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(lx-cs*0.1, ly-cs*0.1, cs*0.12, 0, Math.PI*2); ctx.fill();

    // Счёт
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Шаги: '+steps+'/'+maxSteps, 8, canvas.height - 8);
    ctx.textAlign = 'center';

    drawMiniMap();
  }

  function resize() {
    const maxW = Math.min(gameArea.clientWidth - 20, 500);
    const maxH = gameArea.clientHeight - 20;
    cs = Math.floor(Math.min(maxW, maxH) / size);
    canvas.width = cs * size;
    canvas.height = cs * size;
    for (let i = 0; i < torches.length; i++) {
      torches[i].x = Math.random() * canvas.width;
      torches[i].y = Math.random() * canvas.height;
    }
    draw();
  }
  resize();
  window.addEventListener('resize', resize);

  function move(dx, dy) {
    if (ended) return;
    const nx = px + dx, ny = py + dy;
    if (nx >= 0 && nx < size && ny >= 0 && ny < size && maze[ny][nx] === 0) {
      px = nx; py = ny; steps++;
      visited.push([px, py]);
      playStep(); draw();
      document.getElementById('ml').textContent = 'Шаги: '+steps+'/'+maxSteps;
      if (px === exitX && py === exitY) endGame(true);
      else if (steps >= maxSteps) endGame(false);
    }
  }

  const handleKey = (e) => {
    const keys = { ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0] };
    if (keys[e.key]) { e.preventDefault(); move(...keys[e.key]); }
  };
  document.addEventListener('keydown', handleKey);

  let touchX = 0, touchY = 0;
  canvas.onpointerdown = (e) => { touchX = e.clientX; touchY = e.clientY; };
  canvas.onpointerup = (e) => {
    const dx = e.clientX - touchX, dy = e.clientY - touchY;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy > 0 ? 1 : -1);
  };

  function endGame(won) {
    if (ended) return;
    ended = true;
    document.removeEventListener('keydown', handleKey);
    window.removeEventListener('resize', resize);
    if (won) playWin();
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
    recordGameResult('maze', won, level);
    if (won) { updateAchievement('maze_runner'); checkProgressAchievements(); }
    trackEvent(won?'maze_won':'maze_lost', { level, steps });
    const best = Math.min(+(localStorage.getItem('maze-best')||999), steps);
    if (won) localStorage.setItem('maze-best', best);
    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">'+(won?'🏆':'😅')+'</div><h2 style="margin:12px 0;color:#222;font-size:22px;">'+(won?'Выход найден!':'Слишком много шагов!')+'</h2><p style="color:#444;font-size:16px;">За '+steps+' шагов</p><p style="color:#666;">🏆 Лучший: '+best+'</p><button id="mr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 '+(won?'Дальше':'Ещё раз')+'</button><button id="me" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
    document.body.appendChild(result);
    result.querySelector('#mr').onclick = () => { result.remove(); startMazeGame(won?level+1:level); };
    result.querySelector('#me').onclick = () => { result.remove(); if(typeof showGamesMenu==='function') showGamesMenu(); };
  }

  document.getElementById('mc').onclick = () => {
    document.removeEventListener('keydown', handleKey);
    window.removeEventListener('resize', resize);
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('maze_started', { level, size });
}

export default { startMazeGame };
