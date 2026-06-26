import { appState, getActiveChildName } from '../core.js';
import { setAvatarState } from '../ui.js';
import { updateAchievement } from '../achievements.js';
import { trackEvent } from '../analytics.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';

const RIDDLES = [
  { q: 'Зимой и летом одним цветом.', a: ['ёлка', 'елка', 'ёлочка', 'елочка'], hint: 'Растёт в лесу, зелёная' },
  { q: 'Сидит дед, в шубе одет, нос в руке, а дышит на всех.', a: ['мороз', 'морозец', 'зима'], hint: 'Приходит зимой' },
  { q: 'Не лает, не кусает, а в дом не пускает.', a: ['замок', 'замочек'], hint: 'На двери' },
  { q: 'Без окон, без дверей — полна горница людей.', a: ['огурец', 'огурчик'], hint: 'Зелёный овощ' },
  { q: 'Кто утром на работу всходит раньше всех?', a: ['петух', 'петушок'], hint: 'Кричит ку-ка-ре-ку' },
  { q: 'Висит груша — нельзя скушать.', a: ['лампочка', 'лампа', 'свет'], hint: 'Светится вечером' },
  { q: 'Что можно сломать, не трогая руками?', a: ['молчание', 'тишина', 'обещание', 'слово'], hint: 'Это не предмет' },
  { q: 'Чем больше берёшь, тем больше становится?', a: ['яма', 'яму', 'ямы'], hint: 'Копают лопатой' },
  { q: 'Бежит без ног, а догнать нельзя.', a: ['время', 'река', 'вода'], hint: 'Тикает на часах' },
  { q: 'Два кольца, два конца, посередине — связь.', a: ['ножницы', 'ножниц'], hint: 'Режут бумагу' },
  { q: 'Круглое, румяное, растёт на ветке.', a: ['яблоко', 'яблочко'], hint: 'Фрукт' },
  { q: 'Сам не ест, а людей кормит.', a: ['хлеб', 'хлебушек', 'пекарь'], hint: 'Из печи' }
];

export function startRiddlesGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('riddles');

  const total = Math.min(RIDDLES.length, 2 + level * 2);
  const hintsLeft = Math.max(0, 4 - level);
  const needToWin = Math.max(2, total - Math.floor(level / 2));

  appState.gameActive = true;
  let index = 0;
  let score = 0;
  let hints = hintsLeft;
  const order = [...RIDDLES].sort(() => Math.random() - 0.5).slice(0, total);

  const { body, close } = createGameScreen({
    gameId: 'riddles',
    title: 'Загадки',
    emoji: '❓',
    level
  });

  const panel = document.createElement('div');
  panel.className = 'game-panel';
  panel.style.cssText = 'max-width:400px;width:100%;text-align:center;';

  const question = document.createElement('p');
  question.className = 'game-question-text';
  question.style.cssText = 'font-size:1.15rem;line-height:1.5;margin:12px 0;min-height:3em;';

  const hintEl = document.createElement('p');
  hintEl.style.cssText = 'opacity:0.75;font-size:0.9rem;min-height:1.4em;color:var(--yellow);';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Твой ответ...';
  input.className = 'game-text-input';

  const scoreEl = document.createElement('div');
  scoreEl.className = 'game-hud-row';
  scoreEl.style.cssText = 'margin:10px 0;font-weight:600;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px;';

  function finish(won) {
    appState.gameActive = false;
    close();
    if (won) {
      updateAchievement('emotion_master');
      recordGameWin('riddles', level);
      showGameResult({
        won: true,
        level,
        scoreText: `Отгадано ${score} из ${total}!`,
        onNext: () => startRiddlesGame(level + 1)
      });
      trackEvent('riddles_won', { level, score, total });
    } else {
      showGameResult({
        won: false,
        level,
        scoreText: `Отгадано ${score} из ${needToWin} нужных.`,
        onClose: () => {}
      });
      trackEvent('riddles_lost', { level, score });
    }
  }

  function showCurrent() {
    if (index >= order.length) {
      finish(score >= needToWin);
      return;
    }
    question.textContent = order[index].q;
    hintEl.textContent = '';
    input.value = '';
    scoreEl.textContent = `✅ ${score} · ${index + 1}/${total} · 💡 ${hints}`;
    input.focus();
  }

  function checkAnswer() {
    const val = input.value.trim().toLowerCase();
    if (!val) return;
    const ok = order[index].a.some((a) => val.includes(a) || a.includes(val));
    if (ok) {
      score++;
      setAvatarState('happy');
      setTimeout(() => setAvatarState(null), 1200);
      index++;
      showCurrent();
    } else {
      hintEl.textContent = '🔄 Попробуй ещё раз!';
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
    }
  }

  const submitBtn = document.createElement('button');
  submitBtn.className = 'modal-btn';
  submitBtn.textContent = 'Ответить';
  submitBtn.onclick = checkAnswer;

  const hintBtn = document.createElement('button');
  hintBtn.className = 'modal-btn secondary';
  hintBtn.textContent = 'Подсказка';
  hintBtn.onclick = () => {
    if (hints <= 0) {
      hintEl.textContent = 'Подсказки закончились';
      return;
    }
    hints--;
    hintEl.textContent = '💡 ' + order[index].hint;
    scoreEl.textContent = `✅ ${score} · ${index + 1}/${total} · 💡 ${hints}`;
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAnswer();
  });

  btnRow.append(submitBtn, hintBtn);
  panel.append(question, hintEl, input, scoreEl, btnRow);
  body.appendChild(panel);
  showCurrent();
  trackEvent('riddles_started', { level, total });
}

export default startRiddlesGame;
