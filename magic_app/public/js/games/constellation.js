import { appState } from '../core.js';
import { ttsEngine } from '../audio.js';
import { createGameScreen, getGameLevel, triggerGameWin, recordGameWin, showGameResult, resetGameSession } from './game-ui.js';

const CONSTELLATIONS = [
  {
    name: 'Большая Медведица',
    stars: [
      { x: 100, y: 50 }, { x: 130, y: 80 }, { x: 160, y: 70 },
      { x: 180, y: 100 }, { x: 150, y: 130 }, { x: 120, y: 120 }, { x: 100, y: 150 }
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]]
  },
  {
    name: 'Орион',
    stars: [
      { x: 150, y: 40 }, { x: 140, y: 80 }, { x: 160, y: 80 },
      { x: 130, y: 130 }, { x: 150, y: 120 }, { x: 170, y: 130 }
    ],
    lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]]
  },
  {
    name: 'Кассиопея',
    stars: [
      { x: 100, y: 100 }, { x: 130, y: 80 }, { x: 160, y: 100 },
      { x: 190, y: 80 }, { x: 220, y: 100 }
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
  }
];

const REF_W = 280;
const REF_H = 180;

function scaleStars(stars, w, h) {
  return stars.map((s) => ({
    x: s.x * (w / REF_W),
    y: s.y * (h / REF_H)
  }));
}

function makeBgStars(w, h, count = 48) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.5,
      alpha: 0.2 + Math.random() * 0.5
    });
  }
  return stars;
}

function drawSpaceBg(ctx, w, h, bgStars) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h));
  grad.addColorStop(0, '#1a0533');
  grad.addColorStop(1, '#000008');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  bgStars.forEach((s) => {
    ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function redrawCanvas(ctx, canvas, constellation, drawnStars, bgStars, nextStar = 0) {
  const w = canvas.width;
  const h = canvas.height;
  drawSpaceBg(ctx, w, h, bgStars);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 10;

  constellation.lines.forEach(([from, to]) => {
    if (drawnStars.includes(from) && drawnStars.includes(to)) {
      const s1 = constellation.stars[from];
      const s2 = constellation.stars[to];
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
    }
  });
  ctx.shadowBlur = 0;

  constellation.stars.forEach((star, i) => {
    const active = drawnStars.includes(i);
    if (active) {
      const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 18);
      glow.addColorStop(0, 'rgba(255,255,255,0.4)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(star.x, star.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = active ? '#FFD700' : 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(star.x, star.y, active ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (nextStar < constellation.stars.length) {
    const star = constellation.stars[nextStar];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(star.x, star.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function startConstellationGame(level) {
  resetGameSession();
  level = level || getGameLevel('constellation');

  const template = CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
  let drawnStars = [];
  let nextStar = 0;
  let completed = false;

  const { body, close, overlay, onClose } = createGameScreen({
    gameId: 'constellation',
    title: 'Созвездия',
    emoji: '🌟',
    level
  });

  const canvas = document.createElement('canvas');
  canvas.id = 'constCanvas';
  canvas.className = 'constellation-pixar-canvas';
  canvas.style.cssText = 'display:block;max-width:100%;border-radius:12px;touch-action:none;';

  const label = document.createElement('p');
  label.id = 'constName';
  label.className = 'constellation-pixar-label';
  label.textContent = `Соедини звёзды: ${template.name}`;

  body.append(canvas, label);

  const ctx = canvas.getContext('2d');
  let currentConstellation = null;
  let bgStars = [];

  const resize = () => {
    canvas.width = Math.min(window.innerWidth - 32, 520);
    canvas.height = Math.min(window.innerHeight - 220, 360);
    bgStars = makeBgStars(canvas.width, canvas.height);
    currentConstellation = {
      ...template,
      stars: scaleStars(template.stars, canvas.width, canvas.height)
    };
    redrawCanvas(ctx, canvas, currentConstellation, drawnStars, bgStars, nextStar);
  };
  const onResize = () => resize();
  resize();
  window.addEventListener('resize', onResize);

  onClose(() => window.removeEventListener('resize', onResize));

  function onComplete() {
    if (completed) return;
    completed = true;
    label.textContent = `✨ ${template.name} — готово!`;
    triggerGameWin(overlay);
    ttsEngine.speak('Какое красивое созвездие! Ты настоящий звездочёт!').catch(() => {});
    appState.gameActive = false;
    setTimeout(() => {
      window.removeEventListener('resize', onResize);
      close();
      recordGameWin('constellation', level);
      showGameResult({
        won: true,
        level,
        scoreText: `Созвездие «${template.name}» собрано!`,
        onNext: () => startConstellationGame(level + 1)
      });
    }, 1200);
  }

  const handleTap = (clientX, clientY) => {
    if (completed || !currentConstellation) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) * (canvas.width / rect.width);
    const my = (clientY - rect.top) * (canvas.height / rect.height);

    let closest = null;
    let minDist = 30;

    currentConstellation.stars.forEach((star, i) => {
      const dist = Math.hypot(star.x - mx, star.y - my);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });

    if (closest !== null && closest === nextStar) {
      drawnStars.push(closest);
      nextStar++;
      redrawCanvas(ctx, canvas, currentConstellation, drawnStars, bgStars, nextStar);
      if (drawnStars.length === currentConstellation.stars.length) {
        onComplete();
      }
    }
  };

  canvas.addEventListener('click', (e) => handleTap(e.clientX, e.clientY));
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    handleTap(t.clientX, t.clientY);
  }, { passive: false });
}

export default { startConstellationGame };
