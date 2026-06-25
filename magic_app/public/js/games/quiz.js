import { appState, incrementGames, getActiveChild } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { setAvatarState } from '../ui.js';

const QUESTIONS = [
  { ages: [8, 10], q: 'Сколько планет в Солнечной системе?', options: ['7', '8', '9', '10'], correct: 1 },
  { ages: [8, 10], q: 'Кто написал «Колобок»?', options: ['Народная сказка', 'Пушкин', 'Толстой', 'Чуковский'], correct: 0 },
  { ages: [8, 10], q: 'Какое животное мурлыкает?', options: ['Собака', 'Кошка', 'Корова', 'Лошадь'], correct: 1 },
  { ages: [8, 10], q: 'Из чего растут деревья?', options: ['Из семян', 'Из камней', 'Из песка', 'Из металла'], correct: 0 },
  { ages: [11, 14], q: 'Столица Франции?', options: ['Лондон', 'Берлин', 'Париж', 'Рим'], correct: 2 },
  { ages: [11, 14], q: 'H₂O — это...', options: ['Соль', 'Вода', 'Воздух', 'Масло'], correct: 1 },
  { ages: [11, 14], q: 'Сколько континентов на Земле?', options: ['5', '6', '7', '8'], correct: 1 },
  { ages: [11, 14], q: 'Кто был первым космонавтом?', options: ['Армstrong', 'Гагarin', 'Титов', 'Леонов'], correct: 1 }
];

function pickQuestions(age) {
  const pool = QUESTIONS.filter((q) => age >= q.ages[0] && age <= q.ages[1]);
  const src = pool.length ? pool : QUESTIONS;
  return src.sort(() => Math.random() - 0.5).slice(0, 5);
}

export function startQuizGame() {
  if (appState.gameActive) return;
  const age = getActiveChild()?.age || 10;
  const questions = pickQuestions(age);
  let qi = 0;
  let score = 0;

  appState.gameActive = true;
  const overlay = document.createElement('div');
  overlay.className = 'game-overlay';

  function render() {
    if (qi >= questions.length) {
      overlay.innerHTML = `
        <div style="text-align:center;padding:24px;max-width:360px;">
          <h2>❓ Викторина</h2>
          <p style="font-size:1.4rem;">⭐ ${score} / ${questions.length}</p>
          <p>${score >= 3 ? 'Мурр! Ты молодец!' : 'Ничего, попробуем ещё!'}</p>
          <button class="modal-btn" id="quizClose">Готово</button>
        </div>`;
      overlay.querySelector('#quizClose').onclick = close;
      if (score >= 3) setAvatarState('happy');
      speak(score >= 3 ? 'Отличный результат!' : 'В следующий раз получится!');
      incrementGames();
      trackEvent('game_complete', 'quiz');
      return;
    }

    const item = questions[qi];
    overlay.innerHTML = `
      <div style="padding:20px;max-width:400px;text-align:center;">
        <h2>❓ Вопрос ${qi + 1}/${questions.length}</h2>
        <p style="margin:16px 0;line-height:1.4;">${item.q}</p>
        <div style="display:flex;flex-direction:column;gap:10px;" id="quizOpts"></div>
      </div>`;

    const opts = overlay.querySelector('#quizOpts');
    item.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'modal-btn';
      btn.textContent = opt;
      btn.onclick = () => {
        if (i === item.correct) score++;
        qi++;
        render();
      };
      opts.appendChild(btn);
    });
  }

  function close() {
    appState.gameActive = false;
    overlay.remove();
    setAvatarState(null);
  }

  document.body.appendChild(overlay);
  render();
  trackEvent('game_selected', 'quiz');
}

export default { startQuizGame };
