import { appState } from '../core.js';
import { ttsEngine } from '../audio.js';
import { createGameScreen, getGameLevel } from './game-ui.js';

const FEARS = [
  { name: 'Темнота', emoji: '🌑', message: 'Темнота — это просто время для звёзд. В темноте можно увидеть самые красивые сны!' },
  { name: 'Монстры', emoji: '👾', message: 'Монстры бывают только в сказках. А в жизни — просто тени от игрушек!' },
  { name: 'Одиночество', emoji: '😔', message: 'Ты не один! Я всегда рядом, и твои родители тебя любят.' },
  { name: 'Гроза', emoji: '⛈️', message: 'Гром — это небо играет в барабаны! А молния — фейерверк для облаков.' },
  { name: 'Пауки', emoji: '🕷️', message: 'Паучки — наши друзья! Они ловят вредных мух и плетут красивые узоры.' }
];

const PARTICLE_COLORS = ['#FFD700', '#FF6B9D', '#7B68EE', '#4CAF50'];

function popBubble(bubble, fear, onPopped) {
  const rect = bubble.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const flash = document.createElement('div');
  flash.className = 'pop-flash';
  flash.style.left = `${cx - 60}px`;
  flash.style.top = `${cy - 60}px`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'pop-particle';
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 200}px`);
    p.style.setProperty('--dy', `${(Math.random() - 0.5) * 200}px`);
    p.style.background = PARTICLE_COLORS[i % 4];
    document.body.appendChild(p);
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
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('popFears');

  const { body, close } = createGameScreen({ gameId: 'popFears', title: 'Лопни страхи', emoji: '🫧', level });

  const container = document.createElement('div');
  container.id = 'bubblesContainer';
  container.className = 'fear-forest';

  const counter = document.createElement('p');
  counter.className = 'fear-pop-counter';
  counter.innerHTML = 'Страхов лопнуто: <span id="popCount">0</span>';

  body.appendChild(container);
  body.appendChild(counter);

  let popped = 0;
  let spawnTimer = null;

  function updateCounter() {
    counter.innerHTML = `Страхов лопнуто: <span id="popCount">${popped}</span>`;
  }

  function spawnBubble() {
    const fear = FEARS[Math.floor(Math.random() * FEARS.length)];
    const bubble = document.createElement('div');
    bubble.className = 'fear-bubble';
    bubble.innerHTML = `<span class="fear-emoji">${fear.emoji}</span><small>${fear.name}</small>`;
    bubble.style.left = `${Math.random() * 80 + 10}%`;
    bubble.style.top = `${Math.random() * 70 + 10}%`;
    bubble.style.animationDelay = `${Math.random() * 2}s`;

    bubble.addEventListener('click', () => {
      if (bubble.classList.contains('popping')) return;
      popBubble(bubble, fear, () => {
        popped += 1;
        updateCounter();
        if (popped % 5 === 0) spawnBubble();
      });
    });

    container.appendChild(bubble);
    setTimeout(() => { if (bubble.parentNode && !bubble.classList.contains('popping')) bubble.remove(); }, 8000);
  }

  for (let i = 0; i < 5; i++) spawnBubble();
  spawnTimer = setInterval(spawnBubble, 4000);

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    clearInterval(spawnTimer);
    appState.gameActive = false;
  }, { once: true });
}

export default { startPopFearsGame };
