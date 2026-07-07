import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';

const RIDDLES = [
  { q: 'Зимой и летом одним цветом.', a: ['ёлка', 'елка'], cat: 'лес' },
  { q: 'Сидит дед, в шубе одет, нос в руке, а дышит на всех.', a: ['мороз'], cat: 'зима' },
  { q: 'Не лает, не кусает, а в дом не пускает.', a: ['замок'], cat: 'дверь' },
  { q: 'Без окон, без дверей — полна горница людей.', a: ['огурец'], cat: 'огород' },
  { q: 'Кто утром на работу входит раньше всех?', a: ['петух'], cat: 'ферма' },
  { q: 'Висит груша — нельзя скушать.', a: ['лампочка', 'лампа'], cat: 'дом' },
  { q: 'Что можно сломать, не трогая руками?', a: ['молчание', 'тишина', 'обещание'], cat: 'абстракция' },
  { q: 'Чем больше берёшь, тем больше становится?', a: ['яма'], cat: 'земля' },
  { q: 'Бежит без ног, а догнать нельзя.', a: ['время'], cat: 'природа' },
  { q: 'Два кольца, два конца, посередине — связь.', a: ['ножницы'], cat: 'школа' },
  { q: 'Круглое, румяное, растёт на ветке.', a: ['яблоко'], cat: 'сад' },
  { q: 'Сам не ест, а людей кормит.', a: ['хлеб'], cat: 'еда' }
];

const HINTS = ['Первая буква: {first}', 'Последняя буква: {last}', 'Это {len} букв', 'Связано с: {cat}'];

function formatHint(template, ans, cat) {
  return template
    .replace('{first}', ans[0].toUpperCase())
    .replace('{last}', ans[ans.length - 1].toUpperCase())
    .replace('{len}', ans.length)
    .replace('{cat}', cat);
}

export function startRiddlesGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('riddles');
  const total = Math.min(RIDDLES.length, 5 + level * 2);

  let idx = 0; let score = 0; let hints = 3; let attempts = 0; let ended = false;
  const order = [...RIDDLES].sort(() => Math.random() - 0.5).slice(0, total);

  const { body, close } = createGameScreen({ gameId: 'riddles', title: '❓ Загадки', emoji: '❓', level });

  const panel = document.createElement('div');
  panel.style.cssText = 'text-align:center;color:#fff;max-width:400px;margin:0 auto;';

  const qEl = document.createElement('p');
  qEl.style.cssText = 'font-size:20px;margin:16px 0;min-height:50px;';

  const hintEl = document.createElement('p');
  hintEl.style.cssText = 'color:#FFD700;min-height:24px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Твой ответ...';
  input.style.cssText = 'width:100%;padding:12px;border-radius:8px;border:none;font-size:16px;text-align:center;';

  const scoreEl = document.createElement('p');
  scoreEl.style.cssText = 'margin:8px 0;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:8px;';

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Ответить';
  submitBtn.style.cssText = 'padding:10px 24px;border-radius:8px;border:none;background:#FFD700;color:#333;font-size:16px;cursor:pointer;';

  const hintBtn = document.createElement('button');
  hintBtn.textContent = '💡 Подсказка';
  hintBtn.style.cssText = 'padding:10px 24px;border-radius:8px;border:2px solid #FFD700;background:transparent;color:#FFD700;font-size:16px;cursor:pointer;';

  btnRow.append(submitBtn, hintBtn);
  panel.append(qEl, hintEl, input, scoreEl, btnRow);
  body.appendChild(panel);

  function show() {
    if (idx >= order.length) return endGame(score >= Math.ceil(total * 0.6));
    qEl.textContent = order[idx].q;
    hintEl.textContent = '';
    attempts = 0;
    input.value = '';
    scoreEl.textContent = `✅ ${score} | ${idx + 1}/${total} | 💡 ${hints}`;
    input.focus();
  }

  submitBtn.onclick = () => {
    const val = input.value.trim().toLowerCase();
    if (!val || val.length < 2) return;
    if (order[idx].a.some((a) => val === a || (val.length > 2 && val.includes(a)))) {
      score++;
      idx++;
      show();
    } else {
      attempts++;
      const ans = order[idx].a[0];
      hintEl.textContent = `❌ Неверно. ${formatHint(HINTS[Math.min(attempts - 1, 3)], ans, order[idx].cat)}`;
      if (attempts >= 3 && !document.getElementById('showAnswer')) {
        const showBtn = document.createElement('button');
        showBtn.id = 'showAnswer';
        showBtn.textContent = '💡 Показать ответ';
        showBtn.style.cssText = 'margin-top:8px;padding:8px 16px;border-radius:8px;border:none;background:#FF6B6B;color:#fff;cursor:pointer;';
        showBtn.onclick = () => { input.value = ans; showBtn.remove(); };
        btnRow.appendChild(showBtn);
      }
    }
  };

  hintBtn.onclick = () => {
    if (hints <= 0) return;
    hints--;
    const ans = order[idx].a[0];
    hintEl.textContent = formatHint(HINTS[Math.min(attempts, 3)], ans, order[idx].cat);
    scoreEl.textContent = `✅ ${score} | ${idx + 1}/${total} | 💡 ${hints}`;
  };

  input.onkeydown = (e) => { if (e.key === 'Enter') submitBtn.click(); };

  function endGame(won) {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    close();
    recordGameResult('riddles', won, level);
    if (won) { recordGameWin('riddles', level); updateAchievement('riddle_master'); checkProgressAchievements(); }
    trackEvent(won ? 'riddles_won' : 'riddles_lost', { level, score });
    speak(won ? 'Молодец!' : 'Попробуй ещё раз!');
    showGameResult({
      won, level,
      scoreText: `Отгадано ${score} из ${total}`,
      onNext: won ? () => startRiddlesGame(level + 1) : null,
      onRestart: () => startRiddlesGame(level)
    });
  }

  show();
  trackEvent('riddles_started', { level });
}

export default { startRiddlesGame };
