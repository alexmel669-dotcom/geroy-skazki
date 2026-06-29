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

export function startPopFearsGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('popFears');

  const { body, close } = createGameScreen({ gameId: 'popFears', title: 'Лопни страхи', emoji: '🫧', level });

  const container = document.createElement('div');
  container.id = 'bubblesContainer';
  container.style.cssText = 'position:relative;width:100%;min-height:50vh;';
  const counter = document.createElement('p');
  counter.innerHTML = 'Страхов лопнуто: <span id="popCount">0</span>';
  counter.style.textAlign = 'center';
  body.appendChild(container);
  body.appendChild(counter);

  let popped = 0;
  let spawnTimer = null;

  function spawnBubble() {
    const fear = FEARS[Math.floor(Math.random() * FEARS.length)];
    const bubble = document.createElement('div');
    bubble.className = 'fear-bubble';
    bubble.innerHTML = `<span>${fear.emoji}</span><small>${fear.name}</small>`;
    bubble.style.cssText = `
      position:absolute;left:${Math.random() * 80 + 10}%;top:${Math.random() * 70 + 10}%;
      width:100px;height:100px;border-radius:50%;background:rgba(123,104,238,0.4);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      cursor:pointer;font-size:14px;color:#fff;
    `;
    bubble.addEventListener('click', () => {
      bubble.remove();
      popped += 1;
      container.querySelector('#popCount')?.remove();
      counter.innerHTML = `Страхов лопнуто: <span id="popCount">${popped}</span>`;
      ttsEngine.speak(fear.message).catch(() => {});
      if (popped % 5 === 0) spawnBubble();
    });
    container.appendChild(bubble);
    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 8000);
  }

  for (let i = 0; i < 5; i++) spawnBubble();
  spawnTimer = setInterval(spawnBubble, 4000);

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    clearInterval(spawnTimer);
    appState.gameActive = false;
  }, { once: true });
}

export default { startPopFearsGame };
