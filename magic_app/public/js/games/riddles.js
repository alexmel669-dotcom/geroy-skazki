import { appState } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { addXP } from '../progression.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

const RIDDLES = [
  { q: 'Зимой и летом одним цветом.', a: ['ёлка','елка'], cat: '🌲 Лес' },
  { q: 'Сидит дед, в шубе одет, нос в руке, а дышит на всех.', a: ['мороз'], cat: '❄️ Зима' },
  { q: 'Не лает, не кусает, а в дом не пускает.', a: ['замок'], cat: '🚪 Дом' },
  { q: 'Без окон, без дверей — полна горница людей.', a: ['огурец'], cat: '🥒 Огород' },
  { q: 'Кто утром на работу входит раньше всех?', a: ['петух'], cat: '🐔 Ферма' },
  { q: 'Висит груша — нельзя скушать.', a: ['лампочка','лампа'], cat: '💡 Дом' },
  { q: 'Что можно сломать, не трогая руками?', a: ['молчание','тишина','обещание'], cat: '🤔 Абстракция' },
  { q: 'Чем больше берёшь, тем больше становится?', a: ['яма'], cat: '🏔️ Земля' },
  { q: 'Бежит без ног, а догнать нельзя.', a: ['время'], cat: '⏰ Природа' },
  { q: 'Два кольца, два конца, посередине — связь.', a: ['ножницы'], cat: '✂️ Школа' },
  { q: 'Круглое, румяное, растёт на ветке.', a: ['яблоко'], cat: '🍎 Сад' },
  { q: 'Сам не ест, а людей кормит.', a: ['хлеб'], cat: '🍞 Еда' },
  { q: 'Маленький, беленький, по лесочку прыг-прыг.', a: ['заяц','зайчик'], cat: '🌲 Лес' },
  { q: 'Сто одёжек и все без застёжек.', a: ['капуста'], cat: '🥬 Огород' },
  { q: 'Красная девица сидит в темнице, а коса на улице.', a: ['морковь','морковка'], cat: '🥕 Огород' }
];

const HINTS = ['Первая буква: {first}', 'Последняя буква: {last}', 'Это {len} букв', 'Связано с: {cat}'];

export function startRiddlesGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const total = Math.min(RIDDLES.length, 5 + level * 2);
  let idx = 0, score = 0, hints = 3, attempts = 0, ended = false, streak = 0;
  const order = [...RIDDLES].sort(() => Math.random() - 0.5).slice(0, total);

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playCorrect() { const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='sine';o.frequency.setValueAtTime(523,audioCtx.currentTime);o.frequency.setValueAtTime(784,audioCtx.currentTime+0.1);g.gain.setValueAtTime(0.15,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.3);o.start();o.stop(audioCtx.currentTime+0.3); }
  function playWrong() { const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='square';o.frequency.value=150;g.gain.setValueAtTime(0.1,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.start();o.stop(audioCtx.currentTime+0.2); }

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:Georgia,serif;background:linear-gradient(180deg,#2c1810,#1a0a05);';

  // Свеча
  const candle = document.createElement('div');
  candle.style.cssText = 'position:absolute;top:20px;right:30px;font-size:40px;animation:flicker 2s infinite;pointer-events:none;z-index:5;';
  candle.textContent = '🕯️';
  overlay.appendChild(candle);

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;padding:10px 16px;background:rgba(0,0,0,0.5);color:#fff;font-size:16px;z-index:10;';
  header.innerHTML = '<span>❓ Загадки</span><span id="rs">✅ 0/'+total+' | 💡 '+hints+'</span><button id="rc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  // Пергамент
  const parchment = document.createElement('div');
  parchment.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 20px;margin:20px;background:linear-gradient(135deg,#f4e4c1,#e8d5a3);border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.5),inset 0 0 30px rgba(0,0,0,0.1);color:#3e2723;';

  const catEl = document.createElement('div');
  catEl.style.cssText = 'font-size:14px;opacity:0.7;margin-bottom:8px;';

  const qEl = document.createElement('div');
  qEl.style.cssText = 'font-size:clamp(18px,5vw,22px);text-align:center;margin-bottom:16px;min-height:50px;line-height:1.5;';

  const hintEl = document.createElement('div');
  hintEl.style.cssText = 'color:#8B4513;min-height:24px;margin-bottom:12px;text-align:center;font-style:italic;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Твой ответ...';
  input.style.cssText = 'width:80%;max-width:300px;padding:12px;border-radius:8px;border:2px solid #8B4513;font-size:16px;text-align:center;background:#fffef5;font-family:Georgia,serif;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:center;';

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Ответить';
  submitBtn.style.cssText = 'padding:10px 24px;border-radius:8px;border:none;background:#8B4513;color:#f4e4c1;font-size:16px;cursor:pointer;font-family:Georgia,serif;';

  const hintBtn = document.createElement('button');
  hintBtn.textContent = '💡 Подсказка';
  hintBtn.style.cssText = 'padding:10px 24px;border-radius:8px;border:2px solid #8B4513;background:transparent;color:#8B4513;font-size:16px;cursor:pointer;font-family:Georgia,serif;';

  btnRow.append(submitBtn, hintBtn);
  parchment.append(catEl, qEl, hintEl, input, btnRow);
  overlay.appendChild(header);
  overlay.appendChild(parchment);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  function show() {
    if (idx >= order.length) return finish(score >= Math.ceil(total * 0.6));
    catEl.textContent = order[idx].cat;
    qEl.textContent = order[idx].q;
    hintEl.textContent = '';
    attempts = 0;
    input.value = '';
    document.getElementById('rs').textContent = '✅ '+score+'/'+total+' | 💡 '+hints;
    const oldShow = document.getElementById('showAnswer');
    if (oldShow) oldShow.remove();
    input.focus();
  }

  submitBtn.onclick = () => {
    const val = input.value.trim().toLowerCase();
    if (!val || val.length < 2) return;
    const ok = order[idx].a.some(a => val === a || (val.length > 2 && val.includes(a)));
    if (ok) {
      playCorrect();
      score++;
      if (attempts === 0) score++; // бонус за скорость
      streak++;
      idx++;
      show();
      return;
    }
    playWrong();
    attempts++;
    streak = 0;
    const ans = order[idx].a[0];
    hintEl.textContent = '❌ '+HINTS[Math.min(attempts-1,3)].replace('{first}',ans[0].toUpperCase()).replace('{last}',ans[ans.length-1].toUpperCase()).replace('{len}',ans.length).replace('{cat}',order[idx].cat);
    if (attempts >= 3 && !document.getElementById('showAnswer')) {
      const showBtn = document.createElement('button');
      showBtn.id = 'showAnswer';
      showBtn.textContent = '💡 Показать ответ';
      showBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:#c0392b;color:#fff;cursor:pointer;font-family:Georgia,serif;';
      showBtn.onclick = () => { input.value = ans; showBtn.remove(); };
      btnRow.appendChild(showBtn);
    }
  };

  hintBtn.onclick = () => {
    if (hints <= 0) return;
    hints--;
    const ans = order[idx].a[0];
    hintEl.textContent = '💡 '+HINTS[Math.min(attempts,3)].replace('{first}',ans[0].toUpperCase()).replace('{last}',ans[ans.length-1].toUpperCase()).replace('{len}',ans.length).replace('{cat}',order[idx].cat);
    document.getElementById('rs').textContent = '✅ '+score+'/'+total+' | 💡 '+hints;
  };

  input.onkeydown = (e) => { if (e.key === 'Enter') submitBtn.click(); };

  function finish(won) {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
    recordGameResult('riddles', won, level);
    if (won) { addXP('game_win'); updateAchievement('riddle_master'); checkProgressAchievements(); }
    trackEvent(won?'riddles_won':'riddles_lost', { level, score });
    const best = Math.max(+(localStorage.getItem('riddles-best')||0), score);
    localStorage.setItem('riddles-best', best);
    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">'+(won?'🎉':'😅')+'</div><h2 style="margin:12px 0;color:#222;font-size:22px;">'+(won?'Мудрец!':'Попробуй ещё!')+'</h2><p style="color:#444;font-size:16px;">Отгадано '+score+' из '+total+'</p><p style="color:#666;">🏆 Лучший: '+best+'</p><button id="rr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 '+(won?'Дальше':'Ещё раз')+'</button><button id="re" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
    document.body.appendChild(result);
    result.querySelector('#rr').onclick = () => { result.remove(); startRiddlesGame(won?level+1:level); };
    result.querySelector('#re').onclick = () => { result.remove(); if(typeof showGamesMenu==='function') showGamesMenu(); };
  }

  document.getElementById('rc').onclick = () => {
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  show();
  trackEvent('riddles_started', { level, total });
}

export default { startRiddlesGame };
