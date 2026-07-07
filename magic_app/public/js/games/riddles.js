import { appState, getActiveChildName } from '../core.js';
import { setAvatarState } from '../ui.js';
import { updateAchievement } from '../achievements.js';
import { trackEvent } from '../analytics.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel, resetGameSession } from './game-ui.js';
import { getRiddlesConfig } from './game-difficulty.js';

const HINTS = [
  'Первая буква: {first}',
  'Последняя буква: {last}',
  'Это {length} букв',
  'Связано с: {category}'
];

const RIDDLES = [
  { q: 'Зимой и летом одним цветом.', a: ['ёлка', 'елка', 'ёлочка', 'елочка'], category: 'лесом' },
  { q: 'Сидит дед, в шубе одет, нос в руке, а дышит на всех.', a: ['мороз', 'морозец', 'зима'], category: 'зимой' },
  { q: 'Не лает, не кусает, а в дом не пускает.', a: ['замок', 'замочек'], category: 'дверью' },
  { q: 'Без окон, без дверей — полна горница людей.', a: ['огурец', 'огурчик'], category: 'огородом' },
  { q: 'Кто утром на работу всходит раньше всех?', a: ['петух', 'петушок'], category: 'фермой' },
  { q: 'Висит груша — нельзя скушать.', a: ['лампочка', 'лампа', 'свет'], category: 'домом' },
  { q: 'Что можно сломать, не трогая руками?', a: ['молчание', 'тишина', 'обещание', 'слово'], category: 'абстракцией' },
  { q: 'Чем больше берёшь, тем больше становится?', a: ['яма', 'яму', 'ямы'], category: 'землёй' },
  { q: 'Бежит без ног, а догнать нельзя.', a: ['время', 'река', 'вода'], category: 'природой' },
  { q: 'Два кольца, два конца, посередине — связь.', a: ['ножницы', 'ножниц'], category: 'школой' },
  { q: 'Круглое, румяное, растёт на ветке.', a: ['яблоко', 'яблочко'], category: 'садом' },
  { q: 'Сам не ест, а людей кормит.', a: ['хлеб', 'хлебушек', 'пекарь'], category: 'еда' }
];

function getHint(riddle, attempt) {
  const answer = riddle.a[0];
  const hintIndex = (attempt - 1) % HINTS.length;
  let hint = HINTS[hintIndex];
  hint = hint.replace('{first}', answer[0].toUpperCase());
  hint = hint.replace('{last}', answer[answer.length - 1].toUpperCase());
  hint = hint.replace('{length}', String(answer.length));
  hint = hint.replace('{category}', riddle.category || 'природой');
  return hint;
}

export function startRiddlesGame(level) {
  resetGameSession();
  level = level || getGameLevel('riddles');

  const { total: rawTotal, hintsLeft, needToWin } = getRiddlesConfig(level);
  const total = Math.min(RIDDLES.length, rawTotal);

  let index = 0;
  let score = 0;
  let hints = hintsLeft;
  let attempts = 0;
  let showAnswerBtn = null;
  const order = [...RIDDLES].sort(() => Math.random() - 0.5).slice(0, total);

  const { body, close } = createGameScreen({
    gameId: 'riddles',
    title: 'Загадки',
    emoji: '❓',
    level
  });

  const panel = document.createElement('div');
  panel.className = 'game-panel game-panel-riddles';

  const question = document.createElement('p');
  question.className = 'game-question-text';
  question.style.cssText = 'font-size:1.15rem;line-height:1.5;margin:12px 0;min-height:3em;';

  const hintEl = document.createElement('p');
  hintEl.id = 'riddleHint';
  hintEl.style.cssText = 'opacity:0.85;font-size:0.9rem;min-height:1.4em;color:var(--yellow);';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Твой ответ...';
  input.className = 'game-text-input';

  const scoreEl = document.createElement('div');
  scoreEl.className = 'game-hud-row';
  scoreEl.style.cssText = 'margin:10px 0;font-weight:600;';

  const answerEl = document.createElement('p');
  answerEl.id = 'riddleAnswer';
  answerEl.style.cssText = 'display:none;color:var(--green);font-weight:600;margin:8px 0;';

  const btnRow = document.createElement('div');
  btnRow.id = 'riddleControls';
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px;';

  function showAnswerButton() {
    if (showAnswerBtn) return;
    showAnswerBtn = document.createElement('button');
    showAnswerBtn.type = 'button';
    showAnswerBtn.textContent = '💡 Показать ответ';
    showAnswerBtn.className = 'modal-btn secondary';
    showAnswerBtn.onclick = () => {
      const ans = order[index].a[0];
      answerEl.textContent = `Ответ: ${ans.charAt(0).toUpperCase() + ans.slice(1)}`;
      answerEl.style.display = 'block';
      showAnswerBtn.remove();
      showAnswerBtn = null;
    };
    btnRow.appendChild(showAnswerBtn);
  }

  function finish(won) {
    appState.gameActive = false;
    close();
    if (won) {
      updateAchievement('riddle_master');
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
        onRestart: () => startRiddlesGame(level),
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
    answerEl.style.display = 'none';
    answerEl.textContent = '';
    attempts = 0;
    if (showAnswerBtn) {
      showAnswerBtn.remove();
      showAnswerBtn = null;
    }
    input.value = '';
    scoreEl.textContent = `✅ ${score} · ${index + 1}/${total} · 💡 ${hints}`;
    input.focus();
  }

  function showHint() {
    if (hints <= 0) {
      hintEl.textContent = 'Подсказки закончились';
      return;
    }
    hints--;
    attempts++;
    const hint = getHint(order[index], attempts);
    hintEl.textContent = `💡 Подсказка: ${hint}`;
    scoreEl.textContent = `✅ ${score} · ${index + 1}/${total} · 💡 ${hints}`;
    if (attempts >= 3) showAnswerButton();
  }

  function checkAnswer() {
    const val = input.value.trim().toLowerCase();
    if (!val || val.length < 2) return;
    const ok = order[index].a.some((a) => val === a || (val.length > 2 && val.includes(a)));
    if (ok) {
      score++;
      setAvatarState('happy');
      setTimeout(() => setAvatarState(null), 1200);
      index++;
      showCurrent();
    } else {
      attempts++;
      const hint = getHint(order[index], attempts);
      hintEl.textContent = `💡 Подсказка: ${hint}`;
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      if (attempts >= 3) showAnswerButton();
    }
  }

  const submitBtn = document.createElement('button');
  submitBtn.className = 'modal-btn';
  submitBtn.textContent = 'Ответить';
  submitBtn.onclick = checkAnswer;

  const hintBtn = document.createElement('button');
  hintBtn.className = 'modal-btn secondary';
  hintBtn.textContent = 'Подсказка';
  hintBtn.onclick = showHint;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAnswer();
  });

  btnRow.append(submitBtn, hintBtn);
  panel.append(question, hintEl, answerEl, input, scoreEl, btnRow);
  body.appendChild(panel);
  showCurrent();
  trackEvent('riddles_started', { level, total });
}

export default startRiddlesGame;
