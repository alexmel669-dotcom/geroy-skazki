// ========================================
// pop-fears.js — Лопни страхи (v5.7.0)
// ========================================

import { appState, getActiveChild } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

// 12 страхов + те что ребёнок назвал
const BASE_FEARS = [
  { name: 'Темнота', emoji: '🌑', msg: 'Темнота — это время для звёзд. В темноте можно увидеть самые красивые сны!' },
  { name: 'Монстры', emoji: '👾', msg: 'Монстры бывают только в сказках. А в жизни — просто тени от игрушек!' },
  { name: 'Одиночество', emoji: '😔', msg: 'Ты не один! Я всегда рядом, и твои родители тебя любят.' },
  { name: 'Гроза', emoji: '⛈️', msg: 'Гром — это небо играет в барабаны! А молния — фейерверк для облаков.' },
  { name: 'Пауки', emoji: '🕷️', msg: 'Паучки — наши друзья! Они ловят вредных мух и плетут красивые узоры.' },
  { name: 'Собаки', emoji: '🐕', msg: 'Собаки — верные друзья! Если пёсик рычит, он просто хочет познакомиться поближе.' },
  { name: 'Врачи', emoji: '👨‍⚕️', msg: 'Врачи — супергерои в белых халатах! Они помогают нам быть здоровыми и сильными.' },
  { name: 'Высота', emoji: '🏔️', msg: 'Высота — это возможность увидеть мир с другой стороны. Как птицы!' },
  { name: 'Незнакомцы', emoji: '🤷', msg: 'Ты молодец что осторожен! Но многие незнакомцы — добрые люди. Главное — всегда быть с родителями.' },
  { name: 'Ошибки', emoji: '😬', msg: 'Ошибаться — это нормально! Каждая ошибка делает нас умнее и сильнее.' },
  { name: 'Насекомые', emoji: '🐛', msg: 'Маленькие жучки — часть природы. Они не хотят тебя обидеть, просто ползают по своим делам.' },
  { name: 'Вода', emoji: '🌊', msg: 'Вода — это весело! Брызги, плавание, кораблики. А с родителями — совсем не страшно.' }
];

// Редкий дракон
const DRAGON = { name: 'Дракон', emoji: '🐉', msg: 'Даже драконы бывают добрыми! Ты только что победил самого редкого страха! +3 храбрости!', rare: true };

export function startPopFearsGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  // Страхи из профиля ребёнка
  const child = getActiveChild();
  const profileFears = child?.concerns || [];
  const customFears = profileFears
    .filter(f => !BASE_FEARS.some(bf => bf.name.toLowerCase().includes(f.toLowerCase())))
    .map(f => ({ name: f, emoji: '💬', msg: `Ты говорил о "${f}". Это нормально — говорить о своих переживаниях. Я рядом!` }));

  let fears = [...BASE_FEARS, ...customFears];
  // Дракон — 10% шанс
  if (Math.random() < 0.1) fears.push(DRAGON);

  const total = fears.length;
  let popped = 0, ended = false, bravery = 0;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playPop() { const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sine';o.frequency.setValueAtTime(600,audioCtx.currentTime);o.frequency.setValueAtTime(1000,audioCtx.currentTime+0.05);g.gain.setValueAtTime(0.1,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.1);o.start();o.stop(audioCtx.currentTime+0.1); }
  function playWin() { [523,659,784,1047].forEach((f,i)=>{setTimeout(()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.12,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.start();o.stop(audioCtx.currentTime+0.2);},i*120);}); }

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;background:linear-gradient(180deg,#1a0533 0%,#2d1b69 40%,#4a2c8a 100%);';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:rgba(0,0,0,0.4);color:#fff;font-size:16px;z-index:10;';
  header.innerHTML = '<span>🫧 Лопни страхи</span><span id="pf">💪 0 | 🫧 0/'+total+'</span><button id="pc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  const container = document.createElement('div');
  container.style.cssText = 'flex:1;position:relative;overflow:hidden;';

  // Звёзды на фоне
  for (let i = 0; i < 50; i++) {
    const star = document.createElement('div');
    star.style.cssText = 'position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;opacity:'+(0.3+Math.random()*0.5)+';animation:twinkle '+(2+Math.random()*3)+'s infinite;pointer-events:none;';
    container.appendChild(star);
  }

  overlay.appendChild(header);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  function spawnBubble() {
    if (ended) return;
    const fear = fears[Math.floor(Math.random() * fears.length)];
    const size = fear.rare ? 100 : 70 + Math.random() * 20;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      position:absolute;
      left:${5+Math.random()*85}%;
      top:${10+Math.random()*75}%;
      width:${size}px;
      height:${size}px;
      border-radius:50%;
      background:radial-gradient(circle at 30% 25%,rgba(255,255,255,0.6),rgba(123,104,238,0.4) 40%,rgba(255,105,180,0.3) 70%);
      cursor:pointer;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      animation:floatBubble ${3+Math.random()*3}s ease-in-out infinite;
      box-shadow:0 8px 32px rgba(123,104,238,0.4),inset 0 2px 8px rgba(255,255,255,0.3);
      transition:transform 0.2s;
    `;
    bubble.innerHTML = `<span style="font-size:${fear.rare?'36px':'28px'};">${fear.emoji}</span><span style="font-size:${fear.rare?'11px':'10px'};color:#fff;text-align:center;margin-top:2px;">${fear.name}</span>`;

    if (fear.rare) {
      bubble.style.background = 'radial-gradient(circle at 30% 25%,rgba(255,255,255,0.7),rgba(255,215,0,0.5) 40%,rgba(255,100,0,0.4) 70%)';
      bubble.style.boxShadow = '0 8px 32px rgba(255,215,0,0.6)';
    }

    bubble.onclick = () => {
      if (ended || bubble.classList.contains('popping')) return;
      playPop();
      bubble.classList.add('popping');
      popped++;
      if (fear.rare) bravery += 3;
      else bravery++;

      document.getElementById('pf').textContent = '💪 '+bravery+' | 🫧 '+popped+'/'+total;

      // Вспышка
      const rect = bubble.getBoundingClientRect();
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;left:'+(rect.left-30)+'px;top:'+(rect.top-30)+'px;width:'+(rect.width+60)+'px;height:'+(rect.height+60)+'px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.8),transparent);animation:popFlash 0.4s ease-out forwards;pointer-events:none;z-index:1500;';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 400);

      // Частицы
      for (let i = 0; i < 8; i++) {
        const p = document.createElement('div');
        p.style.cssText = 'position:fixed;left:'+rect.left+'px;top:'+rect.top+'px;width:6px;height:6px;border-radius:50%;background:'+['#FFD700','#FF6B9D','#7B68EE','#4CAF50'][i%4]+';animation:particleBurst 0.6s ease-out forwards;pointer-events:none;z-index:1500;--dx:'+((Math.random()-0.5)*80)+'px;--dy:'+((Math.random()-0.5)*80)+'px;';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 600);
      }

      setTimeout(() => bubble.remove(), 300);

      if (popped >= total) finish();
    };

    container.appendChild(bubble);
    setTimeout(() => { if (!ended && bubble.parentNode && !bubble.classList.contains('popping')) bubble.remove(); }, 8000);
  }

  for (let i = 0; i < Math.min(total, 8); i++) spawnBubble();
  const spawnInterval = setInterval(spawnBubble, 2500);

  function finish() {
    if (ended) return;
    ended = true;
    clearInterval(spawnInterval);
    playWin();
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
    setTimeout(() => audioCtx.close(), 2000);

    recordGameResult('popFears', true, level);
    updateAchievement('brave_child');
    checkProgressAchievements();
    trackEvent('popFears_won', { level, popped, bravery });

    const best = Math.max(+(localStorage.getItem('popFears-best')||0), bravery);
    localStorage.setItem('popFears-best', best);

    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">🦸</div><h2 style="margin:12px 0;color:#222;font-size:22px;">Ты справился!</h2><p style="color:#444;font-size:16px;">💪 Храбрость: '+bravery+'</p><p style="color:#666;">🏆 Лучший: '+best+'</p><button id="pr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 Дальше</button><button id="pe" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
    document.body.appendChild(result);
    result.querySelector('#pr').onclick = () => { result.remove(); startPopFearsGame(level+1); };
    result.querySelector('#pe').onclick = () => { result.remove(); if(typeof showGamesMenu==='function') showGamesMenu(); };
  }

  document.getElementById('pc').onclick = () => {
    clearInterval(spawnInterval);
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('popFears_started', { level, total });
}

export default { startPopFearsGame };
