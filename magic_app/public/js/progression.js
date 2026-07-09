import { getActiveChild } from './core.js';

const XP_ACTIONS = {
  dialog: 10,
  game_win: 50,
  game_play: 20,
  daily_login: 25,
  fear_pop: 15,
  constellation: 30
};

const LEVELS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 250 },
  { level: 5, xp: 500 },
  { level: 10, xp: 1000 },
  { level: 20, xp: 2500 }
];

function getLevel(xp) {
  let level = 1;
  for (const l of LEVELS) {
    if (xp >= l.xp) level = l.level;
  }
  return level;
}

export function addXP(action) {
  const child = getActiveChild();
  if (!child || (child.age || 7) < 8) return;

  const xp = XP_ACTIONS[action] || 0;
  if (!xp) return;

  const progress = JSON.parse(localStorage.getItem('geroy-progress') || '{}');
  const oldLevel = progress.level || getLevel(progress.xp || 0);
  const total = (progress.xp || 0) + xp;
  progress.xp = total;

  const currentLevel = getLevel(total);
  progress.level = currentLevel;
  if (currentLevel > oldLevel) showLevelUp(currentLevel);

  localStorage.setItem('geroy-progress', JSON.stringify(progress));
  updateXPBar();
}

export function updateXPBar() {
  const age = getActiveChild()?.age || 7;
  const bar = document.getElementById('xpBar');
  if (!bar || age < 8) { if (bar) bar.style.display = 'none'; return; }

  bar.style.display = 'block';
  const progress = JSON.parse(localStorage.getItem('geroy-progress') || '{}');
  const xp = progress.xp || 0;
  const level = progress.level || getLevel(xp);

  const nextLevel = LEVELS.find(l => l.xp > xp) || { xp: xp + 1000 };
  const prevXp = [...LEVELS].reverse().find(l => l.xp <= xp)?.xp || 0;
  const percent = Math.min(100, ((xp - prevXp) / (nextLevel.xp - prevXp)) * 100);

  const levelEl = document.getElementById('xpLevel');
  const fillEl = document.getElementById('xpFill');
  const textEl = document.getElementById('xpText');
  if (levelEl) levelEl.textContent = level;
  if (fillEl) fillEl.style.width = percent + '%';
  if (textEl) textEl.textContent = xp + '/' + nextLevel.xp + ' XP';
}

function showLevelUp(level) {
  const popup = document.createElement('div');
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#FFD700;color:#333;padding:20px 30px;border-radius:16px;font-size:24px;font-weight:bold;z-index:5000;animation:levelUp 2s ease forwards;text-align:center;';
  popup.innerHTML = '🎉 Уровень ' + level + '!<br><small>Новая награда!</small>';
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 2000);
}

export default { addXP, updateXPBar };
