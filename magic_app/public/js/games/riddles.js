import { appState, getActiveChildName } from '../core.js';
import { showModal } from '../ui.js';
import { setAvatarState } from '../ui.js';
import { updateAchievement } from '../achievements.js';

const RIDDLES = [
  { q: 'Зимой и летом одним цветом.', a: ['ёлка', 'елка', 'ёлочка', 'елочка'], hint: 'Растёт в лесу, зелёная' },
  { q: 'Сидит дед, в шубе одет, нос в руке, а дышит на всех.', a: ['мороз', 'морозец', 'зима'], hint: 'Приходит зимой' },
  { q: 'Не лает, не кусает, а в дом не пускает.', a: ['замок', 'замочек'], hint: 'На двери' },
  { q: 'Без окон, без дверей — полна горница людей.', a: ['огурец', 'огурчик'], hint: 'Зелёный овощ' },
  { q: 'Кто утром на работу всходит раньше всех?', a: ['петух', 'петушок'], hint: 'Живёт на farm, кричит ку-ка-ре-ку' },
  { q: 'Висит груша — нельзя скушать.', a: ['лампочка', 'лампа', 'свет'], hint: 'Светится вечером' },
  { q: 'Что можно сломать, не трогая руками?', a: ['молчание', 'тишина', 'обещание', 'слово'], hint: 'Это не предмет' },
  { q: 'Чем больше берёшь, тем больше становится?', a: ['яма', 'яму', 'ямы', 'hole'], hint: 'Копают лопатой' },
  { q: 'Бежит без ног, а догнать нельзя.', a: ['время', 'река', 'вода'], hint: 'Тикает на часах' },
  { q: 'Два кольца, два конца, посередине — связь.', a: ['ножницы', 'ножниц'], hint: 'Режут бумагу' }
];

export function startRiddlesGame() {
  if (appState.gameActive) return;
  appState.gameActive = true;

  let index = 0;
  let score = 0;
  let hintsLeft = 3;
  const order = [...RIDDLES].sort(() => Math.random() - 0.5).slice(0, 10);

  const container = document.createElement('div');
  container.className = 'game-overlay';

  const title = document.createElement('h2');
  title.textContent = '❓ Загадки';

  const question = document.createElement('p');
  question.style.cssText = 'font-size:1.1rem;line-height:1.5;margin:12px 0;';

  const hintEl = document.createElement('p');
  hintEl.style.cssText = 'opacity:0.7;font-size:0.85rem;min-height:1.2em;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Твой ответ...';
  input.style.cssText = 'width:100%;max-width:280px;padding:12px;border-radius:12px;border:none;margin:8px 0;font-size:1rem;';

  const scoreEl = document.createElement('div');
  scoreEl.style.cssText = 'margin:8px 0;font-weight:600;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:10px;';

  function showCurrent() {
    if (index >= order.length) {
      updateAchievement('emotion_master');
      showModal('Победа!', `🎉 Ты отгадал ${score} из ${order.length} загадок!`);
      container.remove();
      appState.gameActive = false;
      return;
    }
    question.textContent = order[index].q;
    hintEl.textContent = '';
    input.value = '';
    scoreEl.textContent = `Очки: ${score} · Загадка ${index + 1}/${order.length} · Подсказок: ${hintsLeft}`;
    input.focus();
  }

  function checkAnswer() {
    const val = input.value.trim().toLowerCase();
    if (!val) return;
    const ok = order[index].a.some((a) => val.includes(a) || a.includes(val));
    if (ok) {
      score++;
      setAvatarState('happy');
      setTimeout(() => setAvatarState(null), 1600);
      index++;
      showCurrent();
    } else {
      hintEl.textContent = 'Попробуй ещё раз!';
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
    if (hintsLeft <= 0) return;
    hintsLeft--;
    hintEl.textContent = '💡 ' + order[index].hint;
    scoreEl.textContent = `Очки: ${score} · Загадка ${index + 1}/${order.length} · Подсказок: ${hintsLeft}`;
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAnswer();
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn secondary';
  closeBtn.textContent = 'Закрыть';
  closeBtn.onclick = () => {
    container.remove();
    appState.gameActive = false;
  };

  btnRow.append(submitBtn, hintBtn, closeBtn);
  container.append(title, question, hintEl, input, scoreEl, btnRow);
  document.body.appendChild(container);
  showCurrent();
}

export default startRiddlesGame;
