import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';

const TEMPLATES = [
  {
    name: 'Большая Медведица',
    stars: [{ x: 100, y: 50 }, { x: 130, y: 80 }, { x: 160, y: 70 }, { x: 180, y: 100 }, { x: 150, y: 130 }, { x: 120, y: 120 }, { x: 100, y: 150 }],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]]
  },
  {
    name: 'Орион',
    stars: [{ x: 150, y: 40 }, { x: 140, y: 80 }, { x: 160, y: 80 }, { x: 130, y: 130 }, { x: 150, y: 120 }, { x: 170, y: 130 }],
    lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]]
  },
  {
    name: 'Кассиопея',
    stars: [{ x: 100, y: 100 }, { x: 130, y: 80 }, { x: 160, y: 100 }, { x: 190, y: 80 }, { x: 220, y: 100 }],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
  }
];

export function startConstellationGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('constellation');

  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const drawn = []; let next = 0; let ended = false;

  const { body, close } = createGameScreen({ gameId: 'constellation', title: '🌟 Созвездия', emoji: '🌟', level });

  const label = document.createElement('p');
  label.style.cssText = 'text-align:center;color:#fff;font-size:16px;';
  label.textContent = `Соедини: ${template.name}`;

  const canvas = document.createElement('canvas');
  canvas.width = 280; canvas.height = 180;
  canvas.style.cssText = 'display:block;margin:0 auto;border-radius:12px;cursor:pointer;max-width:100%;';

  body.append(label, canvas);

  const ctx = canvas.getContext('2d');

  function draw() {
    ctx.fillStyle = '#0d0618'; ctx.fillRect(0, 0, 280, 180);

    template.lines.forEach(([a, b]) => {
      if (drawn.includes(a) && drawn.includes(b)) {
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(template.stars[a].x, template.stars[a].y); ctx.lineTo(template.stars[b].x, template.stars[b].y); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    });

    template.stars.forEach((s, i) => {
      ctx.fillStyle = drawn.includes(i) ? '#FFD700' : 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(s.x, s.y, drawn.includes(i) ? 7 : 4, 0, Math.PI * 2); ctx.fill();
    });

    if (next < template.stars.length) {
      const s = template.stars[next];
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(s.x, s.y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  canvas.onclick = (e) => {
    if (ended) return;
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (280 / r.width); const my = (e.clientY - r.top) * (180 / r.height);

    const s = template.stars[next];
    if (Math.hypot(s.x - mx, s.y - my) < 25) {
      drawn.push(next); next++; draw();
      if (next >= template.stars.length) {
        ended = true;
        appState.gameActive = false; close();
        recordGameResult('constellation', true, level);
        recordGameWin('constellation', level);
        updateAchievement('stargazer');
        checkProgressAchievements();
        speak(`Созвездие ${template.name} собрано!`);
        showGameResult({ won: true, level, onNext: () => startConstellationGame(level + 1), onRestart: () => startConstellationGame(level) });
      }
    }
  };

  canvas.ontouchstart = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    canvas.dispatchEvent(new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
  };

  draw();
  trackEvent('constellation_started', { level });
}

export default { startConstellationGame };
