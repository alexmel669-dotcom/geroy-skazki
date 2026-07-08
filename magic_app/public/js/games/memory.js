// ========================================
// memory.js — Мемори (v5.6.7)
// Самодостаточный, без game-ui.js
// ========================================

import { appState } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

export function startMemoryGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const pairsByLevel = [4, 6, 8, 10, 12];
  const pairs = pairsByLevel[Math.min(level, 5) - 1] || 4;
  const total = pairs * 2;
  const cols = total <= 8 ? 4 : total <= 12 ? 4 : 5;

  // Отсылки: эмодзи с персонажами
  const emojis = ['🐱','👩','👨','👧','👦','🌟','🎈','🦋','🌈','🍎','🎹','⚽','🦊','🐼','🐸','🦄'];
  const cards = [...emojis.slice(0, pairs), ...emojis.slice(0, pairs)].sort(() => Math.random() - 0.5);

  let flipped = [], matched = 0, attempts = 0, locked = false, ended = false;

  // Audio
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playFlip() { const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sine';o.frequency.value=600;g.gain.setValueAtTime(0.1,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.1);o.start();o.stop(audioCtx.currentTime+0.1); }
  function playMatch() { const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='triangle';o.frequency.setValueAtTime(800,audioCtx.currentTime);o.frequency.setValueAtTime(1200,audioCtx.currentTime+0.15);g.gain.setValueAtTime(0.12,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.3);o.start();o.stop(audioCtx.currentTime+0.3); }
  function playWin() { [523,659,784,1047].forEach((f,i)=>{setTimeout(()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.12,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.start();o.stop(audioCtx.currentTime+0.2);},i*120);}); }

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;background:radial-gradient(ellipse at center,#1a0a2e,#0d0618);';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:rgba(0,0,0,0.4);color:#fff;font-size:16px;';
  header.innerHTML = '<span>🧠 Мемори</span><span id="mi">Пары: 0/'+pairs+' | Попытки: 0</span><button id="mc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  // Board
  const board = document.createElement('div');
  board.style.cssText = 'display:grid;grid-template-columns:repeat('+cols+',1fr);gap:8px;max-width:400px;margin:20px auto;padding:0 16px;width:100%;';

  overlay.appendChild(header);
  overlay.appendChild(board);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  // Stars background
  for (let i = 0; i < 40; i++) {
    const star = document.createElement('div');
    star.style.cssText = 'position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;opacity:'+(0.2+Math.random()*0.5)+';animation:twinkle '+(2+Math.random()*3)+'s infinite;pointer-events:none;';
    overlay.appendChild(star);
  }

  // Cards
  cards.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.style.cssText = 'aspect-ratio:1;background:linear-gradient(135deg,#7B68EE,#4a3a8a);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:clamp(28px,8vw,40px);cursor:pointer;transition:all 0.3s;box-shadow:0 4px 16px rgba(0,0,0,0.3);';
    card.textContent = '?';

    card.onclick = () => {
      if (locked || flipped.includes(i) || ended) return;

      playFlip();
      card.textContent = emoji;
      card.style.background = 'rgba(255,255,255,0.15)';
      flipped.push(i);

      if (flipped.length === 2) {
        attempts++;
        document.getElementById('mi').textContent = 'Пары: '+matched+'/'+pairs+' | Попытки: '+attempts;
        locked = true;

        const [a, b] = flipped;
        const cardA = board.children[a], cardB = board.children[b];

        if (cards[a] === cards[b]) {
          playMatch();
          matched++;
          cardA.classList.add('matched'); cardB.classList.add('matched');
          flipped = []; locked = false;
          document.getElementById('mi').textContent = 'Пары: '+matched+'/'+pairs+' | Попытки: '+attempts;

          // Сердечки
          for (let j = 0; j < 4; j++) {
            const heart = document.createElement('div');
            heart.textContent = '💖';
            heart.style.cssText = 'position:fixed;left:'+(cardA.getBoundingClientRect().left+20+Math.random()*30)+'px;top:'+(cardA.getBoundingClientRect().top-10)+'px;font-size:16px;animation:heartFloat 1s ease forwards;pointer-events:none;z-index:1500;';
            document.body.appendChild(heart);
            setTimeout(() => heart.remove(), 1000);
          }

          if (matched === pairs) finish();
        } else {
          setTimeout(() => {
            cardA.textContent = '?'; cardA.style.background = 'linear-gradient(135deg,#7B68EE,#4a3a8a)';
            cardB.textContent = '?'; cardB.style.background = 'linear-gradient(135deg,#7B68EE,#4a3a8a)';
            flipped = []; locked = false;
          }, 800);
        }
      }
    };
    board.appendChild(card);
  });

  function finish() {
    if (ended) return;
    ended = true;
    playWin();
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();

    recordGameResult('memory', true, level);
    updateAchievement('memory_champion');
    checkProgressAchievements();
    trackEvent('memory_end', { level, attempts });

    const best = Math.min(+(localStorage.getItem('memory-best')||99), attempts);
    localStorage.setItem('memory-best', best);
    window.leaderboard?.submitScore('memory', attempts);

    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">🧠</div><h2 style="margin:12px 0;color:#222;font-size:22px;">Все пары найдены!</h2><p style="color:#444;font-size:16px;">За '+attempts+' попыток</p><p style="color:#666;">🏆 Лучший: '+best+'</p><button id="mr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 Ещё раз</button><button id="me" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
    document.body.appendChild(result);
    result.querySelector('#mr').onclick = () => { result.remove(); startMemoryGame(level+1); };
    result.querySelector('#me').onclick = () => { result.remove(); if(typeof showGamesMenu==='function') showGamesMenu(); };
  }

  document.getElementById('mc').onclick = () => {
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('memory_started', { level, pairs });
}

export default { startMemoryGame };
