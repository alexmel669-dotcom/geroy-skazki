// ========================================
// constellation.js — Созвездия (v5.7.3)
// ========================================

import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

const ALL = [
  { name: 'Большая Медведица', stars: [{x:80,y:35},{x:110,y:60},{x:140,y:50},{x:160,y:75},{x:130,y:100},{x:100,y:90},{x:80,y:110}], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]], level: 1, myth: 'Нимфа Каллисто, которую Зевс превратил в медведицу и поместил на небо, чтобы спасти от охотников.' },
  { name: 'Орион', stars: [{x:130,y:30},{x:120,y:60},{x:140,y:60},{x:110,y:100},{x:130,y:95},{x:150,y:100}], lines: [[0,1],[0,2],[1,3],[2,4],[3,5],[4,5]], level: 1, myth: 'Великий охотник, помещённый на небо вместе со своими собаками.' },
  { name: 'Кассиопея', stars: [{x:75,y:75},{x:100,y:55},{x:125,y:75},{x:150,y:55},{x:175,y:75}], lines: [[0,1],[1,2],[2,3],[3,4]], level: 1, myth: 'Царица, наказанная богами за хвастовство — помещена на небо вверх ногами.' },
  { name: 'Дельфин', stars: [{x:95,y:45},{x:120,y:40},{x:135,y:60},{x:110,y:75},{x:85,y:65}], lines: [[0,1],[1,2],[2,3],[3,4],[4,0]], level: 1, myth: 'Посланник Посейдона, помогший богу найти невесту.' },
  { name: 'Малая Медведица', stars: [{x:55,y:25},{x:70,y:50},{x:85,y:40},{x:95,y:60},{x:80,y:80},{x:60,y:70},{x:50,y:80}], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]], level: 2, myth: 'Сын Каллисто, превращённый в медвежонка и помещённый рядом с мамой.' },
  { name: 'Лев', stars: [{x:95,y:25},{x:80,y:50},{x:65,y:75},{x:95,y:65},{x:120,y:50},{x:135,y:75}], lines: [[0,1],[1,2],[1,3],[3,4],[4,5]], level: 2, myth: 'Немейский лев, побеждённый Гераклом в первом подвиге.' },
  { name: 'Лебедь', stars: [{x:90,y:30},{x:110,y:40},{x:130,y:35},{x:120,y:60},{x:100,y:75},{x:80,y:65}], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]], level: 2, myth: 'Зевс превратился в лебедя, чтобы спуститься к царице Леде.' },
  { name: 'Пегас', stars: [{x:70,y:35},{x:90,y:25},{x:110,y:40},{x:95,y:60},{x:75,y:55},{x:105,y:75},{x:120,y:60}], lines: [[0,1],[1,2],[2,3],[3,4],[4,0],[3,5],[5,6]], level: 2, myth: 'Крылатый конь, родившийся из крови Медузы. Символ вдохновения и свободы.' },
  { name: 'Дракон', stars: [{x:80,y:25},{x:100,y:20},{x:120,y:30},{x:110,y:50},{x:130,y:65},{x:105,y:80},{x:85,y:70},{x:70,y:55}], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]], level: 3, myth: 'Ладон — дракон, охранявший золотые яблоки в саду Гесперид. Побеждён Гераклом.' },
  { name: 'Геркулес', stars: [{x:70,y:30},{x:90,y:25},{x:110,y:35},{x:95,y:50},{x:80,y:65},{x:105,y:70},{x:120,y:55},{x:130,y:75}], lines: [[0,1],[1,2],[2,3],[3,4],[4,0],[3,5],[5,6],[6,7]], level: 3, myth: 'Геракл — величайший герой Греции, совершивший 12 подвигов.' },
  { name: 'Скорпион', stars: [{x:90,y:25},{x:110,y:35},{x:105,y:55},{x:125,y:65},{x:100,y:80},{x:80,y:70},{x:70,y:55}], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]], level: 3, myth: 'Скорпион, посланный Артемидой чтобы убить Ориона. Теперь они на разных сторонах неба.' },
  { name: 'Феникс', stars: [{x:100,y:20},{x:120,y:35},{x:115,y:55},{x:100,y:70},{x:80,y:55},{x:75,y:35}], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,3]], level: 3, myth: 'Феникс — волшебная птица, которая сгорает и возрождается из пепла. Символ вечной жизни.' }
];

export function startConstellationGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const pool = ALL.filter(c => c.level <= Math.ceil(level / 2) + 1);
  const template = pool[Math.floor(Math.random() * pool.length)];
  let drawn = [], next = 0, ended = false;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playConnect() { const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sine';o.frequency.setValueAtTime(600,audioCtx.currentTime);o.frequency.setValueAtTime(900,audioCtx.currentTime+0.1);g.gain.setValueAtTime(0.08,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.start();o.stop(audioCtx.currentTime+0.2); }
  function playWin() { [523,659,784,1047].forEach((f,i)=>{setTimeout(()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.12,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.start();o.stop(audioCtx.currentTime+0.2);},i*120);}); }

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;background:radial-gradient(ellipse at center,#1a0533,#000008);';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:rgba(0,0,0,0.5);color:#fff;font-size:16px;z-index:10;';
  header.innerHTML = '<span>🌟 Созвездия</span><span id="cl">'+template.name+'</span><button id="cc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'flex:1;display:block;width:100%;cursor:pointer;';
  overlay.appendChild(header);
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const ctx = canvas.getContext('2d');
  let w, h;
  const bgStars = [];
  let animId = 0;

  function resize() {
    w = canvas.width = overlay.clientWidth;
    h = canvas.height = overlay.clientHeight - header.offsetHeight;
    bgStars.length = 0;
    for (let i = 0; i < 100; i++) bgStars.push({ x: Math.random()*w, y: Math.random()*h, r: Math.random()*2+0.5, twinkle: Math.random()*Math.PI*2, speed: 0.01+Math.random()*0.02 });
  }
  resize();
  window.addEventListener('resize', resize);

  function draw() {
    // Космос
    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, w, h);

    // Туманность
    const nebula = ctx.createRadialGradient(w*0.3, h*0.4, 20, w*0.3, h*0.4, w*0.5);
    nebula.addColorStop(0, 'rgba(123,104,238,0.15)');
    nebula.addColorStop(0.5, 'rgba(255,105,180,0.08)');
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, w, h);

    // Звёзды фона
    bgStars.forEach(s => {
      s.twinkle += s.speed;
      const alpha = 0.3 + Math.sin(s.twinkle) * 0.3;
      ctx.fillStyle = 'rgba(255,255,255,'+alpha+')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
    });

    // Падающая звезда (редко)
    if (Math.random() < 0.005) {
      const sx = Math.random()*w, sy = Math.random()*h*0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx+60, sy+40); ctx.stroke();
    }

    // Масштабирование созвездия
    const sx = w / 280, sy = h / 200;
    const stars = template.stars.map(s => ({ x: s.x * sx, y: s.y * sy }));

    // Линии
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 10;
    template.lines.forEach(([a, b]) => {
      if (drawn.includes(a) && drawn.includes(b)) {
        ctx.beginPath();
        ctx.moveTo(stars[a].x, stars[a].y);
        ctx.lineTo(stars[b].x, stars[b].y);
        ctx.stroke();
      }
    });
    ctx.shadowBlur = 0;

    // Звёзды
    stars.forEach((s, i) => {
      const active = drawn.includes(i);
      ctx.fillStyle = active ? '#FFD700' : 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(s.x, s.y, active ? 7 : 4, 0, Math.PI*2); ctx.fill();

      if (active) {
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 15);
        glow.addColorStop(0, 'rgba(255,215,0,0.3)');
        glow.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(s.x, s.y, 15, 0, Math.PI*2); ctx.fill();
      }
    });

    // Подсказка — мигающая следующая звезда
    if (next < stars.length) {
      const s = stars[next];
      const pulse = Math.sin(Date.now()/300) * 0.4 + 0.6;
      ctx.strokeStyle = 'rgba(255,255,255,'+pulse+')';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(s.x, s.y, 16, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Счётчик
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(template.name + ' | ' + drawn.length + '/' + template.stars.length, 12, h - 8);
  }

  function animate() {
    draw();
    animId = requestAnimationFrame(animate);
  }

  function cleanup() {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    setTimeout(() => audioCtx.close(), 500);
  }

  canvas.onclick = (e) => {
    if (ended) return;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (w / r.width);
    const my = (e.clientY - r.top) * (h / r.height);
    const sx = w / 280, sy = h / 200;
    const stars = template.stars.map(s => ({ x: s.x * sx, y: s.y * sy }));

    const s = stars[next];
    if (Math.hypot(s.x - mx, s.y - my) < 30) {
      playConnect();
      drawn.push(next);
      next++;
      if (next >= template.stars.length) {
        ended = true;
        playWin();
        setTimeout(() => {
          cleanup();
          overlay.remove();
          recordGameResult('constellation', true, level);
          updateAchievement('stargazer');
          checkProgressAchievements();
          trackEvent('constellation_won', { level });
          speak(template.myth);
          const best = Math.max(+(localStorage.getItem('constellation-best')||0), level);
          localStorage.setItem('constellation-best', best);
          const result = document.createElement('div');
          result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
          result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:340px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">🌟</div><h2 style="margin:12px 0;color:#222;font-size:20px;">'+template.name+'</h2><p style="color:#444;font-size:14px;">'+template.myth+'</p><button id="cr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 Дальше</button><button id="ce" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
          document.body.appendChild(result);
          result.querySelector('#cr').onclick = () => { result.remove(); startConstellationGame(level+1); };
          result.querySelector('#ce').onclick = () => { result.remove(); if(typeof showGamesMenu==='function') showGamesMenu(); };
        }, 500);
      }
    }
  };

  document.getElementById('cc').onclick = () => {
    cleanup();
    overlay.remove();
  };

  animate();
  trackEvent('constellation_started', { level });
}

export default { startConstellationGame };
