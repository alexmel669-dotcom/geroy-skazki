import { appState, getActiveChild } from '../core.js';
import { ttsEngine } from '../audio.js';
import { FEAR_LABELS } from '../config.js';
import { updateAchievement } from '../achievements.js';
import { createGameScreen, getGameLevel, resetGameSession, showGameResult, recordGameWin } from './game-ui.js';

const DEFAULT_FEARS = [
  { name: 'Темнота', emoji: '🌑', message: 'Темнота — это просто время для звёзд. В темноте можно увидеть самые красивые сны!' },
  { name: 'Монстры', emoji: '👾', message: 'Монстры бывают только в сказках. А в жизни — просто тени от игрушек!' },
  { name: 'Одиночество', emoji: '😔', message: 'Ты не один! Я всегда рядом, и твои родители тебя любят.' },
  { name: 'Гроза', emoji: '⛈️', message: 'Гром — это небо играет в барабаны! А молния — фейерверк для облаков.' },
  { name: 'Пауки', emoji: '🕷️', message: 'Паучки — наши друзья! Они ловят вредных мух и плетут красивые узоры.' }
];

const FEAR_KEY_TO_DEFAULT = {
  darkness: 'Темнота',
  monsters: 'Монстры',
  separation: 'Одиночество',
  loud_noises: 'Гроза',
  strangers: 'Незнакомцы',
  school: 'Школа',
  peers: 'Сверстники'
};

const PARTICLE_COLORS = ['#FFD700', '#FF6B9D', '#7B68EE', '#4CAF50'];

function getPersonalizedFears() {
  const child = getActiveChild();
  let concerns = [];
  try {
    concerns = JSON.parse(localStorage.getItem('parentConcerns') || '[]');
  } catch { /* ignore */ }

  const fearStats = child?.fearStats || {};
  const activeKeys = Object.entries(fearStats).filter(([, v]) => v > 0).map(([k]) => k);

  if (activeKeys.length) {
    const fromStats = activeKeys.map((key) => {
      const label = FEAR_LABELS[key];
      const defaultName = FEAR_KEY_TO_DEFAULT[key];
      const base = DEFAULT_FEARS.find((f) => f.name === defaultName || f.name === label?.name);
      if (base) return base;
      if (label) {
        return { name: label.name, emoji: label.icon, message: `Ты смелый! ${label.name} не страшно!` };
      }
      return null;
    }).filter(Boolean);
    if (fromStats.length) return fromStats;
  }

  if (concerns.length) {
    const matched = DEFAULT_FEARS.filter((f) =>
      concerns.some((c) => {
        const cLower = String(c).toLowerCase();
        const fLower = f.name.toLowerCase();
        return fLower.includes(cLower) || cLower.includes(fLower.slice(0, 4));
      })
    );
    if (matched.length) return matched;
  }

  return DEFAULT_FEARS;
}

function popBubble(bubble, fear, container, onPopped) {
  const containerRect = container.getBoundingClientRect();
  const rect = bubble.getBoundingClientRect();
  const cx = rect.left - containerRect.left + rect.width / 2;
  const cy = rect.top - containerRect.top + rect.height / 2;

  const flash = document.createElement('div');
  flash.className = 'pop-flash';
  flash.style.left = `${cx - 60}px`;
  flash.style.top = `${cy - 60}px`;
  container.appendChild(flash);
  setTimeout(() => flash.remove(), 400);

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'pop-particle';
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 200}px`);
    p.style.setProperty('--dy', `${(Math.random() - 0.5) * 200}px`);
    p.style.background = PARTICLE_COLORS[i % 4];
    container.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }

  bubble.classList.add('popping');
  ttsEngine.speak(fear.message).catch(() => {});
  setTimeout(() => {
    bubble.remove();
    onPopped();
  }, 300);
}

export function startPopFearsGame(level) {
  resetGameSession();
  level = level || getGameLevel('popFears');

  const fears = getPersonalizedFears();
  const totalFears = fears.length;
  let poppedFears = 0;
  let won = false;

  const { body, close, onClose } = createGameScreen({ gameId: 'popFears', title: 'Лопни страхи', emoji: '🫧', level });

  const container = document.createElement('div');
  container.id = 'bubblesContainer';
  container.className = 'fear-forest';

  const counter = document.createElement('p');
  counter.className = 'fear-pop-counter';
  counter.innerHTML = `Страхов лопнуто: <span id="popCount">0</span> / ${totalFears}`;

  body.appendChild(container);
  body.appendChild(counter);

  function updateCounter() {
    counter.innerHTML = `Страхов лопнуто: <span id="popCount">${poppedFears}</span> / ${totalFears}`;
  }

  function onWin() {
    if (won) return;
    won = true;
    ttsEngine.speak('Ты справился со всеми страхами! Ты очень смелый!').catch(() => {});
    appState.gameActive = false;
    close();
    recordGameWin('popFears', level);
    updateAchievement('brave_child');
    showGameResult({
      won: true,
      level,
      scoreText: `Все ${totalFears} страхов побеждены!`,
      onNext: () => startPopFearsGame(level + 1)
    });
  }

  function spawnBubble(fear, index) {
    const bubble = document.createElement('div');
    bubble.className = 'fear-bubble';
    bubble.dataset.fearIndex = String(index);
    bubble.innerHTML = `<span class="fear-emoji">${fear.emoji}</span><small>${fear.name}</small>`;
    bubble.style.left = `${Math.random() * 70 + 15}%`;
    bubble.style.top = `${Math.random() * 60 + 15}%`;
    bubble.style.animationDelay = `${Math.random() * 2}s`;

    bubble.addEventListener('click', () => {
      if (bubble.classList.contains('popping') || won) return;
      popBubble(bubble, fear, container, () => {
        poppedFears++;
        updateCounter();
        if (poppedFears >= totalFears) onWin();
      });
    });

    container.appendChild(bubble);
    setTimeout(() => {
      if (bubble.parentNode && !bubble.classList.contains('popping') && !won) bubble.remove();
    }, 12000);
  }

  fears.forEach((fear, i) => spawnBubble(fear, i));

  onClose(() => {});
}

export default { startPopFearsGame };
