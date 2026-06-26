import { appState, incrementGames, getActiveChild } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { setAvatarState } from '../ui.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';

const QUESTIONS = [
  { ages: [3, 7], q: 'Какого цвета небо?', options: ['Синее', 'Зелёное', 'Красное', 'Чёрное'], correct: 0 },
  { ages: [3, 7], q: 'Сколько лап у кошки?', options: ['2', '4', '6', '8'], correct: 1 },
  { ages: [3, 7], q: 'Что падает с неба зимой?', options: ['Снег', 'Песок', 'Листья', 'Камни'], correct: 0 },
  { ages: [8, 10], q: 'Сколько планет в Солнечной системе?', options: ['7', '8', '9', '10'], correct: 1 },
  { ages: [8, 10], q: 'Кто написал «Колобок»?', options: ['Народная сказка', 'Пушкин', 'Толстой', 'Чуковский'], correct: 0 },
  { ages: [8, 10], q: 'Какое животное мурлыкает?', options: ['Собака', 'Кошка', 'Корова', 'Лошадь'], correct: 1 },
  { ages: [8, 10], q: 'Из чего растут деревья?', options: ['Из семян', 'Из камней', 'Из песка', 'Из металла'], correct: 0 },
  { ages: [11, 14], q: 'Столица Франции?', options: ['Лондон', 'Берлин', 'Париж', 'Рим'], correct: 2 },
  { ages: [11, 14], q: 'H₂O — это...', options: ['Соль', 'Вода', 'Воздух', 'Масло'], correct: 1 },
  { ages: [11, 14], q: 'Сколько континентов на Земле?', options: ['5', '6', '7', '8'], correct: 1 },
  { ages: [11, 14], q: 'Кто был первым космонавтом?', options: ['Armstrong', 'Гагарин', 'Титов', 'Леонов'], correct: 1 },
  { ages: [11, 14], q: '2 + 2 × 2 = ?', options: ['6', '8', '4', '10'], correct: 0 }
];

function pickQuestions(age, level) {
  const minAge = level >= 4 ? 11 : level >= 2 ? 8 : 3;
  const effectiveAge = Math.max(age, minAge);
  const pool = QUESTIONS.filter((q) => effectiveAge >= q.ages[0] && effectiveAge <= q.ages[1]);
  const src = pool.length >= 3 ? pool : QUESTIONS;
  const count = Math.min(src.length, 2 + level);
  return src.sort(() => Math.random() - 0.5).slice(0, count);
}

export function startQuizGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('quiz');
  const age = getActiveChild()?.age || 8;
  const questions = pickQuestions(age, level);
  const passScore = Math.ceil(questions.length * 0.6);
  let qi = 0;
  let score = 0;
  let questionTimer = null;
  let timeLeft = 15;

  appState.gameActive = true;

  const { body, close } = createGameScreen({
    gameId: 'quiz',
    title: 'Викторина',
    emoji: '❓',
    level
  });

  const panel = document.createElement('div');
  panel.className = 'game-panel';
  panel.style.cssText = 'max-width:420px;width:100%;text-align:center;';

  function finish(won) {
    appState.gameActive = false;
    close();
    setAvatarState(null);
    if (won) {
      setAvatarState('happy');
      setTimeout(() => setAvatarState(null), 1200);
      recordGameWin('quiz', level);
      speak('Отличный результат!');
      showGameResult({
        won: true,
        level,
        scoreText: `${score} из ${questions.length} правильных!`,
        onNext: () => startQuizGame(level + 1)
      });
      trackEvent('quiz_won', { level, score });
    } else {
      speak('В следующий раз получится!');
      showGameResult({
        won: false,
        level,
        scoreText: `${score} из ${passScore} нужно было.`,
        onClose: () => {}
      });
      trackEvent('quiz_lost', { level, score });
    }
    incrementGames();
  }

  function render() {
    panel.innerHTML = '';
    if (questionTimer) clearInterval(questionTimer);
    if (qi >= questions.length) {
      finish(score >= passScore);
      return;
    }

    timeLeft = Math.max(10, 20 - level);
    const item = questions[qi];
    const title = document.createElement('h3');
    title.style.cssText = 'margin:0 0 12px;font-size:1rem;opacity:0.85;';
    title.textContent = `Вопрос ${qi + 1} / ${questions.length}`;

    const timerEl = document.createElement('div');
    timerEl.className = 'game-hud-row';
    timerEl.style.cssText = 'margin-bottom:12px;font-size:1.1rem;';
    timerEl.textContent = `⏱️ ${timeLeft}с`;

    const q = document.createElement('p');
    q.className = 'game-question-text';
    q.style.cssText = 'margin:0 0 20px;line-height:1.45;font-size:1.05rem;';
    q.textContent = item.q;

    const opts = document.createElement('div');
    opts.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;';

    const lockOpts = (correct) => {
      if (questionTimer) clearInterval(questionTimer);
      opts.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      setTimeout(() => { qi++; render(); }, correct ? 400 : 900);
    };

    questionTimer = setInterval(() => {
      timeLeft--;
      timerEl.textContent = `⏱️ ${timeLeft}с`;
      if (timeLeft <= 0) {
        clearInterval(questionTimer);
        questionTimer = null;
        lockOpts(false);
      }
    }, 1000);

    item.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'modal-btn quiz-opt-btn';
      btn.textContent = opt;
      btn.onclick = () => {
        if (questionTimer) clearInterval(questionTimer);
        if (i === item.correct) {
          score++;
          btn.classList.add('correct-flash');
        } else {
          btn.classList.add('wrong-flash');
          item.options.forEach((_, j) => {
            if (j === item.correct) opts.children[j].classList.add('correct-flash');
          });
        }
        lockOpts(i === item.correct);
      };
      opts.appendChild(btn);
    });

    panel.append(title, timerEl, q, opts);
    if (!panel.parentElement) body.appendChild(panel);
  }

  render();
  trackEvent('quiz_started', { level });
}

export default { startQuizGame };
