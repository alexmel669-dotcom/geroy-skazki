// ========================================
// quiz.js — Викторина (v5.6.8)
// ========================================

import { appState } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { addXP } from '../progression.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

const ALL_QUESTIONS = [
  { q: 'Сколько ног у кошки?', a: '4', wrong: ['2','6','8'], level: 1 },
  { q: 'Какого цвета небо?', a: 'Синее', wrong: ['Красное','Зелёное','Жёлтое'], level: 1 },
  { q: 'Сколько минут в часе?', a: '60', wrong: ['30','100','120'], level: 1 },
  { q: 'Кто говорит "мяу"?', a: 'Кошка', wrong: ['Собака','Корова','Утка'], level: 1 },
  { q: 'Сколько пальцев на руке?', a: '5', wrong: ['4','6','10'], level: 1 },
  { q: 'Столица России?', a: 'Москва', wrong: ['Питер','Казань','Сочи'], level: 2 },
  { q: 'Сколько планет в системе?', a: '8', wrong: ['7','9','10'], level: 2 },
  { q: 'Кто написал про рыбку?', a: 'Пушкин', wrong: ['Лермонтов','Толстой','Чехов'], level: 2 },
  { q: 'Какая планета красная?', a: 'Марс', wrong: ['Венера','Юпитер','Сатурн'], level: 2 },
  { q: 'Сколько будет 7×8?', a: '56', wrong: ['48','64','72'], level: 2 },
  { q: 'Формула воды?', a: 'H2O', wrong: ['CO2','O2','NaCl'], level: 3 },
  { q: 'Хромосом у человека?', a: '46', wrong: ['23','48','64'], level: 3 },
  { q: 'Кто написал "Войну и мир"?', a: 'Толстой', wrong: ['Пушкин','Достоевский','Чехов'], level: 3 },
  { q: 'Самый большой океан?', a: 'Тихий', wrong: ['Атлантический','Индийский','Северный'], level: 3 },
  { q: 'Скорость света?', a: '300 000 км/с', wrong: ['300 км/с','3 000 км/с','3 млн км/с'], level: 3 },
  { q: 'Символ золота?', a: 'Au', wrong: ['Ag','Fe','Cu'], level: 4 },
  { q: 'Столица Японии?', a: 'Токио', wrong: ['Пекин','Сеул','Ханой'], level: 4 },
  { q: 'Закон тяготения открыл?', a: 'Ньютон', wrong: ['Эйнштейн','Галилей','Коперник'], level: 4 },
  { q: 'Сколько континентов?', a: '6', wrong: ['5','7','8'], level: 4 },
  { q: 'Наука о звёздах?', a: 'Астрономия', wrong: ['Биология','Химия','Геология'], level: 4 }
];

const LEVEL_BG = {
  1: 'linear-gradient(180deg, #1a3a15, #0d1a08)',
  2: 'linear-gradient(180deg, #1a2a4a, #0d1520)',
  3: 'linear-gradient(180deg, #2C003E, #1A0025)',
  4: 'linear-gradient(180deg, #4a0010, #1a0005)'
};
const LEVEL_TIME = { 1: 15, 2: 10, 3: 8, 4: 6 };

export function startQuizGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const maxLevel = Math.min(level, 4);
  const pool = ALL_QUESTIONS.filter(q => q.level <= maxLevel).sort(() => Math.random() - 0.5).slice(0, 5 + level);
  let idx = 0, score = 0, ended = false, timeLeft = LEVEL_TIME[maxLevel];
  const totalTime = timeLeft;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playCorrect() { const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sine';o.frequency.setValueAtTime(523,audioCtx.currentTime);o.frequency.setValueAtTime(784,audioCtx.currentTime+0.1);g.gain.setValueAtTime(0.12,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.3);o.start();o.stop(audioCtx.currentTime+0.3); }
  function playWrong() { const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='square';o.frequency.value=150;g.gain.setValueAtTime(0.08,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.start();o.stop(audioCtx.currentTime+0.2); }
  function playWin() { [523,659,784,1047].forEach((f,i)=>{setTimeout(()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(0.12,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.start();o.stop(audioCtx.currentTime+0.2);},i*120);}); }

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;transition:background 0.5s;background:'+LEVEL_BG[maxLevel];

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:rgba(0,0,0,0.5);color:#fff;font-size:16px;';
  header.innerHTML = '<span>❓ Викторина</span><span id="qs">✅ '+score+'/'+pool.length+'</span><button id="qc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  const panel = document.createElement('div');
  panel.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;color:#fff;';

  const timerEl = document.createElement('div');
  timerEl.style.cssText = 'font-size:24px;color:#FFD700;margin-bottom:8px;font-weight:bold;';

  const progressBar = document.createElement('div');
  progressBar.style.cssText = 'width:80%;max-width:400px;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;margin-bottom:16px;overflow:hidden;';
  progressBar.innerHTML = '<div id="qp" style="height:100%;background:#FFD700;border-radius:3px;transition:width 0.3s;width:0%;"></div>';

  const qEl = document.createElement('div');
  qEl.style.cssText = 'font-size:clamp(18px,5vw,22px);text-align:center;margin-bottom:20px;min-height:50px;line-height:1.5;';

  const answersEl = document.createElement('div');
  answersEl.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;max-width:400px;';

  panel.append(timerEl, progressBar, qEl, answersEl);
  overlay.appendChild(header);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  let timerInterval;

  function show() {
    if (idx >= pool.length) return finish(score >= Math.ceil(pool.length * 0.6));
    const q = pool[idx];
    qEl.textContent = q.q;
    document.getElementById('qs').textContent = '✅ '+score+'/'+pool.length;
    document.getElementById('qp').style.width = ((idx / pool.length) * 100) + '%';
    answersEl.innerHTML = '';

    timeLeft = LEVEL_TIME[maxLevel];
    timerEl.textContent = '⏱ ' + timeLeft + 'с';
    timerEl.style.color = '#FFD700';
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeLeft--;
      timerEl.textContent = '⏱ ' + timeLeft + 'с';
      if (timeLeft <= 3) timerEl.style.color = '#F44336';
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        playWrong();
        idx++;
        show();
      }
    }, 1000);

    // Варианты ответов
    const options = [q.a, ...q.wrong].sort(() => Math.random() - 0.5);

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.style.cssText = 'padding:14px;border-radius:12px;border:2px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);color:#fff;font-size:clamp(14px,4vw,18px);cursor:pointer;transition:all 0.3s;';
      btn.onclick = () => {
        if (ended) return;
        clearInterval(timerInterval);
        if (opt === q.a) {
          playCorrect();
          score++;
          btn.style.background = '#4CAF50';
          btn.style.borderColor = '#4CAF50';
        } else {
          playWrong();
          btn.style.background = '#F44336';
          btn.style.borderColor = '#F44336';
          answersEl.querySelectorAll('button').forEach(b => {
            if (b.textContent === q.a) {
              b.style.background = '#4CAF50';
              b.style.borderColor = '#4CAF50';
            }
          });
        }
        idx++;
        setTimeout(show, 800);
      };
      answersEl.appendChild(btn);
    });
  }

  function finish(won) {
    if (ended) return;
    ended = true;
    clearInterval(timerInterval);
    if (won) playWin();
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
    setTimeout(() => audioCtx.close(), 2000);
    recordGameResult('quiz', won, level);
    if (won) { addXP('game_win'); updateAchievement('quiz_genius'); checkProgressAchievements(); }
    trackEvent(won?'quiz_won':'quiz_lost', { level, score });
    const best = Math.max(+(localStorage.getItem('quiz-best')||0), score);
    localStorage.setItem('quiz-best', best);
    window.leaderboard?.submitScore('quiz', score);
    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">'+(won?'🎉':'😅')+'</div><h2 style="margin:12px 0;color:#222;font-size:22px;">'+(won?'Эрудит!':'Время вышло!')+'</h2><p style="color:#444;font-size:16px;">Правильно '+score+' из '+pool.length+'</p><p style="color:#666;">🏆 Лучший: '+best+'</p><button id="qr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 '+(won?'Дальше':'Ещё раз')+'</button><button id="qe" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
    document.body.appendChild(result);
    result.querySelector('#qr').onclick = () => { result.remove(); startQuizGame(won?level+1:level); };
    result.querySelector('#qe').onclick = () => { result.remove(); if(typeof showGamesMenu==='function') showGamesMenu(); };
  }

  document.getElementById('qc').onclick = () => {
    clearInterval(timerInterval);
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  show();
  trackEvent('quiz_started', { level });
}

export default { startQuizGame };
