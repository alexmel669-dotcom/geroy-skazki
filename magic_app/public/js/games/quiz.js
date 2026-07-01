import { appState, incrementGames, getActiveChild } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { setAvatarState } from '../ui.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';

const ALL_QUESTIONS = [
  { id: 'q_anim1', q: 'Какое животное самое высокое?', a: ['Жираф', 'Слон', 'Кит', 'Медведь'], correct: 0, level: 1 },
  { id: 'q_anim2', q: 'Кто спит вниз головой?', a: ['Сова', 'Летучая мышь', 'Пингвин', 'Попугай'], correct: 1, level: 1 },
  { id: 'q_anim3', q: 'Какая птица не летает?', a: ['Орёл', 'Воробей', 'Пингвин', 'Сокол'], correct: 2, level: 1 },
  { id: 'q_anim4', q: 'У какого животного есть хобот?', a: ['Носорог', 'Слон', 'Бегемот', 'Крокодил'], correct: 1, level: 1 },
  { id: 'q_anim5', q: 'Кто быстрее всех бегает?', a: ['Волк', 'Гепард', 'Лев', 'Заяц'], correct: 1, level: 2 },
  { id: 'q_anim6', q: 'Сколько ног у паука?', a: ['4', '6', '8', '10'], correct: 2, level: 1 },
  { id: 'q_nat1', q: 'Сколько планет в Солнечной системе?', a: ['7', '8', '9', '10'], correct: 1, level: 2 },
  { id: 'q_nat2', q: 'Какая планета самая большая?', a: ['Марс', 'Юпитер', 'Сатурн', 'Земля'], correct: 1, level: 2 },
  { id: 'q_nat3', q: 'Что падает с неба во время грозы?', a: ['Снег', 'Град', 'Молния', 'Дождь и молния'], correct: 3, level: 1 },
  { id: 'q_nat4', q: 'Какого цвета небо?', a: ['Красное', 'Синее', 'Зелёное', 'Жёлтое'], correct: 1, level: 1 },
  { id: 'q_nat5', q: 'Из чего состоит облако?', a: ['Из ваты', 'Из капель воды', 'Из песка', 'Из воздуха'], correct: 1, level: 2 },
  { id: 'q_nat6', q: 'Что такое радуга?', a: ['Отражение', 'Преломление света', 'Облако', 'Ветер'], correct: 1, level: 2 },
  { id: 'q_tale1', q: 'Кто съел Колобка?', a: ['Волк', 'Лиса', 'Медведь', 'Заяц'], correct: 1, level: 1 },
  { id: 'q_tale2', q: 'Из чего сделана карета Золушки?', a: ['Из дерева', 'Из тыквы', 'Из арбуза', 'Из камня'], correct: 1, level: 1 },
  { id: 'q_tale3', q: 'Кто нёс бабушке пирожки?', a: ['Красная Шапочка', 'Колобок', 'Буратино', 'Незнайка'], correct: 0, level: 1 },
  { id: 'q_tale4', q: 'Что потеряла Золушка?', a: ['Туфельку', 'Кольцо', 'Шляпу', 'Платье'], correct: 0, level: 1 },
  { id: 'q_sci1', q: 'Сколько будет 7 + 8?', a: ['13', '14', '15', '16'], correct: 2, level: 2 },
  { id: 'q_sci2', q: 'Что измеряют термометром?', a: ['Вес', 'Длину', 'Температуру', 'Время'], correct: 2, level: 2 },
  { id: 'q_sci3', q: 'Из чего делают бумагу?', a: ['Из камня', 'Из дерева', 'Из металла', 'Из пластика'], correct: 1, level: 2 },
  { id: 'q_sci4', q: 'Сколько минут в часе?', a: ['30', '60', '100', '120'], correct: 1, level: 1 },
  { id: 'q_adv1', q: 'Столица России?', a: ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск'], correct: 0, level: 3 },
  { id: 'q_adv2', q: 'Кто написал «Войну и мир»?', a: ['Пушкин', 'Толстой', 'Достоевский', 'Чехов'], correct: 1, level: 3 },
  { id: 'q_adv3', q: 'Формула воды?', a: ['CO2', 'H2O', 'O2', 'NaCl'], correct: 1, level: 3 },
  { id: 'q_adv4', q: 'Какая планета красная?', a: ['Венера', 'Марс', 'Юпитер', 'Меркурий'], correct: 1, level: 3 },
  { id: 'q_adv5', q: 'Что такое фотосинтез?', a: ['Дыхание', 'Питание растений светом', 'Размножение', 'Рост'], correct: 1, level: 3 }
];

const LEVEL_CONFIG = {
  1: { name: 'Лёгкий', questionsPerRound: 5 },
  2: { name: 'Средний', questionsPerRound: 7 },
  3: { name: 'Сложный', questionsPerRound: 10 }
};

class QuizGame {
  constructor(level) {
    this.level = Math.min(3, Math.max(1, level <= 3 ? level : level <= 6 ? 2 : 3));
    this.usedQuestions = new Set();
    this.score = 0;
    this.currentIndex = 0;
    this.questions = [];
  }

  getQuestionsForLevel() {
    return ALL_QUESTIONS.filter((q) => q.level <= this.level);
  }

  pickQuestion() {
    const available = this.getQuestionsForLevel().filter((q) => !this.usedQuestions.has(q.q));
    if (available.length === 0) {
      this.usedQuestions.clear();
      return this.pickQuestion();
    }
    const q = available[Math.floor(Math.random() * available.length)];
    this.usedQuestions.add(q.q);
    return q;
  }

  buildRound() {
    const count = LEVEL_CONFIG[this.level].questionsPerRound;
    this.questions = [];
    for (let i = 0; i < count; i++) {
      this.questions.push(this.pickQuestion());
    }
    this.currentIndex = 0;
    this.score = 0;
  }

  nextLevel() {
    if (this.level < 3) {
      this.level++;
      this.usedQuestions.clear();
      window.ttsEngine?.speak(`Переходим на ${LEVEL_CONFIG[this.level].name} уровень!`);
      this.buildRound();
      return true;
    }
    return false;
  }
}

export function startQuizGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('quiz');

  const quiz = new QuizGame(level);
  quiz.buildRound();
  const questions = quiz.questions;
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

  const levelLabel = document.createElement('p');
  levelLabel.style.cssText = 'margin:0 0 8px;opacity:0.85;font-size:0.9rem;';
  levelLabel.textContent = `Уровень: ${LEVEL_CONFIG[quiz.level].name}`;

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
      trackEvent('quiz_won', { level, score, quizLevel: quiz.level });
    } else {
      speak('В следующий раз получится!');
      showGameResult({
        won: false,
        level,
        scoreText: `${score} из ${passScore} нужно было.`,
        onClose: () => {}
      });
      trackEvent('quiz_lost', { level, score, quizLevel: quiz.level });
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

    item.a.forEach((opt, i) => {
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
          item.a.forEach((_, j) => {
            if (j === item.correct) opts.children[j].classList.add('correct-flash');
          });
        }
        lockOpts(i === item.correct);
      };
      opts.appendChild(btn);
    });

    panel.append(title, timerEl, q, opts);
    if (!panel.parentElement) {
      body.append(levelLabel, panel);
    }
  }

  render();
  trackEvent('quiz_started', { level, quizLevel: quiz.level });
}

export default { startQuizGame };
