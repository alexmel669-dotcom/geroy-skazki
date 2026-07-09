// ========================================
// draw-ai.js — Рисовалка с ИИ (v5.6.9)
// ========================================

import { appState } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

const TASKS = {
  1: { hint: 'Нарисуй солнышко ☀️', check: (g) => g.includes('солнц') || g.includes('солнышк') || g.includes('круг') && g.includes('жёлт') },
  2: { hint: 'Нарисуй домик 🏠', check: (g) => g.includes('дом') || g.includes('домик') || g.includes('квадрат') },
  3: { hint: 'Нарисуй котика 🐱', check: (g) => g.includes('кот') || g.includes('кошк') || g.includes('животн') },
  4: { hint: 'Нарисуй дерево 🌳', check: (g) => g.includes('дерев') || g.includes('ствол') },
  5: { hint: 'Нарисуй машину 🚗', check: (g) => g.includes('машин') || g.includes('авто') || g.includes('транспорт') }
};

const COLORS = ['#333','#F44336','#E91E63','#9C27B0','#2196F3','#4CAF50','#FFEB3B','#FF9800','#795548','#607D8B','#00BCD4','#fff'];
const BRUSH_SIZES = [4, 8, 14];

export function startDrawAIGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const task = TASKS[Math.min(level, 5)] || TASKS[1];
  let currentColor = '#333';
  let brushSize = BRUSH_SIZES[1];
  let drawing = false;
  let ended = false;
  let guessing = false;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playDraw() { if (Math.random() > 0.5) return; const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sine';o.frequency.value=800+Math.random()*400;g.gain.setValueAtTime(0.02,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.05);o.start();o.stop(audioCtx.currentTime+0.05); }
  function playWin() { [523,659,784,1047].forEach((f,i)=>{setTimeout(()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.12,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.start();o.stop(audioCtx.currentTime+0.2);},i*120);}); }

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;background:linear-gradient(180deg,#8B4513,#5d2e0c);align-items:center;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 16px;background:rgba(0,0,0,0.5);color:#fff;font-size:16px;z-index:10;';
  header.innerHTML = '<span>🎨 Рисовалка</span><span id="dh">'+task.hint+'</span><button id="dc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  // Мольберт
  const easel = document.createElement('div');
  easel.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;padding:10px;';

  const frame = document.createElement('div');
  frame.style.cssText = 'position:relative;background:#DEB887;padding:20px;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.5),inset 0 0 20px rgba(0,0,0,0.2);';

  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 300;
  canvas.style.cssText = 'display:block;background:#FFFEF5;border-radius:4px;cursor:crosshair;box-shadow:inset 0 2px 8px rgba(0,0,0,0.1);';

  frame.appendChild(canvas);
  easel.appendChild(frame);

  // Панель инструментов
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:8px 16px;align-items:center;';

  // Цвета
  const palette = document.createElement('div');
  palette.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;justify-content:center;';
  COLORS.forEach(c => {
    const s = document.createElement('div');
    s.style.cssText = 'width:26px;height:26px;border-radius:50%;background:'+c+';border:2px solid '+(c==='#fff'?'#ccc':'#fff')+';cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
    if (c === currentColor) s.style.border = '3px solid #FFD700';
    s.onclick = () => {
      currentColor = c;
      palette.querySelectorAll('div').forEach(d => d.style.border = d.style.border.replace('3px solid #FFD700','2px solid '+(c==='#fff'?'#ccc':'#fff')));
      s.style.border = '3px solid #FFD700';
    };
    palette.appendChild(s);
  });

  // Размер кисти
  const sizes = document.createElement('div');
  sizes.style.cssText = 'display:flex;gap:6px;align-items:center;margin:0 8px;';
  BRUSH_SIZES.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = ['●','●●','●●●'][i];
    b.style.cssText = 'padding:6px 10px;border-radius:6px;border:2px solid '+(s===brushSize?'#FFD700':'rgba(255,255,255,0.3)')+';background:rgba(255,255,255,0.1);color:#fff;font-size:14px;cursor:pointer;';
    b.onclick = () => {
      brushSize = s;
      sizes.querySelectorAll('button').forEach(btn => btn.style.border = '2px solid rgba(255,255,255,0.3)');
      b.style.border = '2px solid #FFD700';
    };
    sizes.appendChild(b);
  });

  // Ластик
  const eraserBtn = document.createElement('button');
  eraserBtn.textContent = '🧹 Ластик';
  eraserBtn.style.cssText = 'padding:6px 12px;border-radius:6px;border:2px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);color:#fff;font-size:14px;cursor:pointer;';
  eraserBtn.onclick = () => { currentColor = '#FFFEF5'; };

  // Очистить
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '🗑️ Очистить';
  clearBtn.style.cssText = 'padding:6px 12px;border-radius:6px;border:2px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);color:#fff;font-size:14px;cursor:pointer;';
  clearBtn.onclick = () => { ctx.fillStyle = '#FFFEF5'; ctx.fillRect(0, 0, 300, 300); };

  // Угадай
  const guessBtn = document.createElement('button');
  guessBtn.textContent = '🤔 Угадай!';
  guessBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:#FFD700;color:#333;font-size:16px;font-weight:bold;cursor:pointer;';
  
  const resultEl = document.createElement('div');
  resultEl.style.cssText = 'color:#FFD700;font-size:16px;margin-left:8px;min-width:120px;text-align:center;';

  toolbar.append(palette, sizes, eraserBtn, clearBtn, guessBtn, resultEl);
  overlay.appendChild(header);
  overlay.appendChild(easel);
  overlay.appendChild(toolbar);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFEF5'; ctx.fillRect(0, 0, 300, 300);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  function drawAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = (clientX - r.left) * (300 / r.width);
    const y = (clientY - r.top) * (300 / r.height);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.arc(x, y, brushSize/2, 0, Math.PI*2);
    ctx.fillStyle = currentColor;
    ctx.fill();
    playDraw();
  }

  canvas.onmousedown = (e) => { drawing = true; drawAt(e.clientX, e.clientY); };
  canvas.onmouseup = () => drawing = false;
  canvas.onmouseleave = () => drawing = false;
  canvas.onmousemove = (e) => { if (drawing) drawAt(e.clientX, e.clientY); };

  canvas.ontouchstart = (e) => { drawing = true; const t = e.touches[0]; drawAt(t.clientX, t.clientY); };
  canvas.ontouchend = () => drawing = false;
  canvas.ontouchmove = (e) => { if (drawing) { const t = e.touches[0]; drawAt(t.clientX, t.clientY); } };

  guessBtn.onclick = async () => {
    if (ended || guessing) return;
    guessing = true;
    guessBtn.disabled = true;
    resultEl.textContent = '🤔 Думаю...';
    const dataUrl = canvas.toDataURL('image/png');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Посмотри на рисунок. Ответь ОДНИМ словом — что нарисовано. Только существительное в именительном падеже. Не говори "мурр", "мяу", "привет", "не знаю", "задумался", "думаю". Если не можешь определить — ответь "непонятно".',
          type: 'chat',
          image: dataUrl,
          systemPrompt: 'Ты — программа распознавания изображений. Ты не кот. Ты не Люцик. Ты просто алгоритм компьютерного зрения. Отвечай одним словом без эмоций.'
        })
      });
      const data = await res.json();
      const guess = (data.reply || data.message || 'непонятно').toLowerCase().trim().replace(/[^а-яё]/g, '');
      resultEl.textContent = '🤔 ' + (guess || 'непонятно');

      if (task.check(guess)) {
        playWin();
        ended = true;
        appState.gameActive = false;
        setTimeout(() => {
          overlay.remove();
          document.body.classList.remove('game-active');
          recordGameResult('drawAi', true, level);
          updateAchievement('artist');
          checkProgressAchievements();
          trackEvent('drawAi_won', { level });
          const best = Math.max(+(localStorage.getItem('drawAi-best') || 0), level);
          localStorage.setItem('drawAi-best', best);
          const result = document.createElement('div');
          result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
          result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">🎉</div><h2 style="margin:12px 0;color:#222;font-size:22px;">ИИ угадал!</h2><p style="color:#444;font-size:16px;">Это ' + guess + '!</p><button id="dr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 Дальше</button><button id="de" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
          document.body.appendChild(result);
          result.querySelector('#dr').onclick = () => { result.remove(); startDrawAIGame(level + 1); };
          result.querySelector('#de').onclick = () => { result.remove(); if (typeof showGamesMenu === 'function') showGamesMenu(); };
        }, 500);
      }
    } catch {
      resultEl.textContent = '❌ Ошибка';
    } finally {
      guessing = false;
      if (!ended) guessBtn.disabled = false;
    }
  };

  document.getElementById('dc').onclick = () => {
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('drawAi_started', { level });
}

export default { startDrawAIGame };
