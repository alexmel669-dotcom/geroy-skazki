import { appState, getActiveChild } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';

const FEARS = [
  { name: 'Темнота', emoji: '🌑', msg: 'Темнота — это время для звёзд. В темноте можно увидеть самые красивые сны!' },
  { name: 'Монстры', emoji: '👾', msg: 'Монстры бывают только в сказках. А в жизни — просто тени от игрушек!' },
  { name: 'Одиночество', emoji: '😔', msg: 'Ты не один! Я всегда рядом, и твои родители тебя любят.' },
  { name: 'Гроза', emoji: '⛈️', msg: 'Гром — это небо играет в барабаны! А молния — фейерверк для облаков.' },
  { name: 'Пауки', emoji: '🕷️', msg: 'Паучки — наши друзья! Они ловят вредных мух и плетут красивые узоры.' }
];

export function startPopFearsGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('popFears');

  const child = getActiveChild();
  const concerns = child?.concerns || [];
  const fears = concerns.length > 0 ? FEARS.filter((f) => concerns.some((c) => f.name.toLowerCase().includes(String(c).toLowerCase()))) : FEARS;
  if (fears.length === 0) fears.push(...FEARS);

  const total = fears.length; let popped = 0; let ended = false;

  const { body, close } = createGameScreen({ gameId: 'popFears', title: '🫧 Лопни страхи', emoji: '🫧', level });

  const container = document.createElement('div');
  container.style.cssText = 'position:relative;width:100%;height:65vh;background:linear-gradient(180deg,#1a0533,#2d1b69);border-radius:20px;overflow:hidden;';

  const counter = document.createElement('p');
  counter.style.cssText = 'text-align:center;color:#fff;font-size:16px;';
  counter.textContent = `Страхов лопнуто: 0/${total}`;

  body.append(counter, container);

  function spawn() {
    if (ended) return;
    const fear = fears[Math.floor(Math.random() * fears.length)];
    const bubble = document.createElement('div');
    bubble.style.cssText = `position:absolute;left:${10 + Math.random() * 70}%;top:${10 + Math.random() * 70}%;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,0.7),rgba(123,104,238,0.4) 40%,rgba(255,105,180,0.3) 70%);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:floatBubble 4s ease-in-out infinite;box-shadow:0 8px 32px rgba(123,104,238,0.4);`;
    bubble.innerHTML = `<span style="font-size:30px;">${fear.emoji}</span><span style="font-size:11px;color:#fff;">${fear.name}</span>`;

    bubble.onclick = () => {
      if (ended || bubble.classList.contains('popping')) return;
      bubble.classList.add('popping');
      speak(fear.msg);
      popped++;
      counter.textContent = `Страхов лопнуто: ${popped}/${total}`;
      setTimeout(() => bubble.remove(), 300);

      if (popped >= total) {
        ended = true;
        clearInterval(spawnTimer);
        appState.gameActive = false; close();
        recordGameResult('popFears', true, level);
        recordGameWin('popFears', level);
        updateAchievement('brave_child');
        checkProgressAchievements();
        speak('Ты справился со всеми страхами! Ты очень смелый!');
        showGameResult({ won: true, level, onNext: () => startPopFearsGame(level + 1), onRestart: () => startPopFearsGame(level) });
      }
    };

    container.appendChild(bubble);
    setTimeout(() => { if (!ended && bubble.parentNode && !bubble.classList.contains('popping')) bubble.remove(); }, 8000);
  }

  for (let i = 0; i < Math.min(total, 5); i++) spawn();
  const spawnTimer = setInterval(spawn, 4000);

  trackEvent('popFears_started', { level });
}

export default { startPopFearsGame };
