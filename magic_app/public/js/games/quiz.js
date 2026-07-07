import { appState } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';

const Q = [
  { q: 'Какое животное самое высокое?', a: ['Жираф', 'Слон', 'Кит', 'Медведь'], c: 0, l: 1 },
  { q: 'Кто спит вниз головой?', a: ['Сова', 'Летучая мышь', 'Пингвин', 'Попугай'], c: 1, l: 1 },
  { q: 'Какая птица не летает?', a: ['Орёл', 'Воробей', 'Пингвин', 'Сокол'], c: 2, l: 1 },
  { q: 'У какого животного есть хобот?', a: ['Носорог', 'Слон', 'Бегемот', 'Крокодил'], c: 1, l: 1 },
  { q: 'Сколько ног у паука?', a: ['4', '6', '8', '10'], c: 2, l: 1 },
  { q: 'Кто быстрее всех бегает?', a: ['Волк', 'Гепард', 'Лев', 'Заяц'], c: 1, l: 2 },
  { q: 'Сколько планет в Солнечной системе?', a: ['7', '8', '9', '10'], c: 1, l: 2 },
  { q: 'Какая планета самая большая?', a: ['Марс', 'Юпитер', 'Сатурн', 'Земля'], c: 1, l: 2 },
  { q: 'Из чего делают бумагу?', a: ['Из камня', 'Из дерева', 'Из металла', 'Из пластика'], c: 1, l: 2 },
  { q: 'Столица России?', a: ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск'], c: 0, l: 3 },
  { q: 'Кто написал «Войну и мир»?', a: ['Пушкин', 'Толстой', 'Достоевский', 'Чехов'], c: 1, l: 3 },
  { q: 'Формула воды?', a: ['CO2', 'H2O', 'O2', 'NaCl'], c: 1, l: 3 },
  { q: 'Сколько хромосом у человека?', a: ['23', '46', '48', '64'], c: 1, l: 4 },
  { q: 'Самый большой океан?', a: ['Атлантический', 'Тихий', 'Индийский', 'Северный Ледовитый'], c: 1, l: 4 },
  { q: 'Скорость света?', a: ['300 км/с', '3000 км/с', '300 000 км/с', '3 млн км/с'], c: 2, l: 4 }
];

const TIMES = { 1: 15, 2: 10, 3: 8, 4: 6 };

export function startQuizGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('quiz');

  const pool = Q.filter((q) => q.l <= level).sort(() => Math.random() - 0.5).slice(0, 5 + level);
  let idx = 0; let score = 0; let timeLeft = TIMES[Math.min(level, 4)]; let ended = false;

  const { body, close } = createGameScreen({ gameId: 'quiz', title: '❓ Викторина', emoji: '❓', level });

  const timerEl = document.createElement('div');
  timerEl.style.cssText = 'text-align:center;font-size:24px;color:#FFD700;margin-bottom:8px;';

  const qEl = document.createElement('p');
  qEl.style.cssText = 'text-align:center;font-size:18px;color:#fff;margin:12px 0;min-height:50px;';

  const answers = document.createElement('div');
  answers.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-width:400px;margin:0 auto;';

  body.append(timerEl, qEl, answers);

  let timer;
  function startTimer() {
    timeLeft = TIMES[Math.min(level, 4)];
    timerEl.textContent = `⏱ ${timeLeft}с`;
    timer = setInterval(() => {
      timeLeft--;
      timerEl.textContent = `⏱ ${timeLeft}с`;
      if (timeLeft <= 0) { clearInterval(timer); endGame(score >= Math.ceil(pool.length * 0.6)); }
    }, 1000);
  }

  function show() {
    if (idx >= pool.length) return endGame(score >= Math.ceil(pool.length * 0.6));
    const q = pool[idx];
    qEl.textContent = q.q;
    answers.innerHTML = '';
    q.a.forEach((ans, i) => {
      const btn = document.createElement('button');
      btn.textContent = ans;
      btn.style.cssText = 'padding:12px;border-radius:8px;border:2px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);color:#fff;font-size:16px;cursor:pointer;';
      btn.onclick = () => {
        clearInterval(timer);
        if (i === q.c) { score++; btn.style.background = '#4CAF50'; speak('Правильно!'); }
        else { btn.style.background = '#F44336'; speak('Неверно.'); }
        idx++;
        setTimeout(() => { startTimer(); show(); }, 800);
      };
      answers.appendChild(btn);
    });
  }

  function endGame(won) {
    if (ended) return;
    ended = true;
    clearInterval(timer);
    appState.gameActive = false;
    close();
    recordGameResult('quiz', won, level);
    if (won) { recordGameWin('quiz', level); updateAchievement('quiz_genius'); checkProgressAchievements(); }
    trackEvent(won ? 'quiz_won' : 'quiz_lost', { level, score });
    showGameResult({
      won, level,
      scoreText: `Правильно ${score} из ${pool.length}`,
      onNext: won ? () => startQuizGame(level + 1) : null,
      onRestart: () => startQuizGame(level)
    });
    if (won && window.leaderboard) window.leaderboard.submitScore('quiz', score);
  }

  startTimer();
  show();
  trackEvent('quiz_started', { level });
}

export default { startQuizGame };
