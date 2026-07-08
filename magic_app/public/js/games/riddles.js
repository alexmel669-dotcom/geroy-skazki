import { appState } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

const RIDDLES = [
  { q: 'Зимой и летом одним цветом.', a: ['ёлка','елка'], cat: 'лес' },
  { q: 'Сидит дед, в шубе одет, нос в руке, а дышит на всех.', a: ['мороз'], cat: 'зима' },
  { q: 'Не лает, не кусает, а в дом не пускает.', a: ['замок'], cat: 'дверь' },
  { q: 'Без окон, без дверей — полна горница людей.', a: ['огурец'], cat: 'огород' },
  { q: 'Кто утром на работу входит раньше всех?', a: ['петух'], cat: 'ферма' },
  { q: 'Висит груша — нельзя скушать.', a: ['лампочка','лампа'], cat: 'дом' },
  { q: 'Что можно сломать, не трогая руками?', a: ['молчание','тишина','обещание'], cat: 'абстракция' },
  { q: 'Чем больше берёшь, тем больше становится?', a: ['яма'], cat: 'земля' },
  { q: 'Бежит без ног, а догнать нельзя.', a: ['время'], cat: 'природа' },
  { q: 'Два кольца, два конца, посередине — связь.', a: ['ножницы'], cat: 'школа' },
  { q: 'Круглое, румяное, растёт на ветке.', a: ['яблоко'], cat: 'сад' },
  { q: 'Сам не ест, а людей кормит.', a: ['хлеб'], cat: 'еда' },
  { q: 'Маленький, беленький, по лесочку прыг-прыг, по снежочку тык-тык.', a: ['заяц','зайчик'], cat: 'лес' },
  { q: 'Сто одёжек и все без застёжек.', a: ['капуста'], cat: 'огород' },
  { q: 'Красная девица сидит в темнице, а коса на улице.', a: ['морковь','морковка'], cat: 'огород' }
];

const HINTS = ['Первая буква: {first}', 'Последняя буква: {last}', 'Это {len} букв', 'Связано с: {cat}'];

export function startRiddlesGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const total = Math.min(RIDDLES.length, 5 + level * 2);
  let idx = 0, score = 0, hints = 3, attempts = 0, ended = false;
  const order = [...RIDDLES].sort(() => Math.random() - 0.5).slice(0, total);

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;background:linear-gradient(180deg,#3e2723,#1a1008);';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;padding:10px 16px;background:rgba(0,0,0,0.5);color:#fff;font-size:16px;';
  header.innerHTML = '<span>❓ Загадки</span><span id="rs">✅ 0/'+total+' | 💡 '+hints+'</span><button id="rc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  const panel = document.createElement('div');
  panel.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;color:#fff;';

  const qEl = document.createElement('div');
  qEl.style.cssText = 'font-size:clamp(18px,5vw,24px);text-align:center;margin-bottom:16px;min-height:60px;';

  const hintEl = document.createElement('div');
  hintEl.style.cssText = 'color:#FFD700;min-height:24px;margin-bottom:12px;text-align:center;';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Твой ответ...';
  input.style.cssText = 'width:80%;max-width:300px;padding:12px;border-radius:8px;border:none;font-size:16px;text-align:center;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;';

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'Ответить';
  submitBtn.style.cssText = 'padding:10px 24px;border-radius:8px;border:none;background:#FFD700;color:#333;font-size:16px;cursor:pointer;';

  const hintBtn = document.createElement('button');
  hintBtn.textContent = '💡 Подсказка';
  hintBtn.style.cssText = 'padding:10px 24px;border-radius:8px;border:2px solid #FFD700;background:transparent;color:#FFD700;font-size:16px;cursor:pointer;';

  btnRow.append(submitBtn, hintBtn);
  panel.append(qEl, hintEl, input, btnRow);
  overlay.appendChild(header);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  function show() {
    if (idx >= order.length) return finish(score >= Math.ceil(total * 0.6));
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
    if (ok) { score++; idx++; show(); return; }
    attempts++;
    const ans = order[idx].a[0];
    hintEl.textContent = '❌ '+HINTS[Math.min(attempts-1,3)].replace('{first}',ans[0].toUpperCase()).replace('{last}',ans[ans.length-1].toUpperCase()).replace('{len}',ans.length).replace('{cat}',order[idx].cat);
    if (attempts >= 3 && !document.getElementById('showAnswer')) {
      const showBtn = document.createElement('button');
      showBtn.id = 'showAnswer';
      showBtn.textContent = '💡 Показать ответ';
      showBtn.style.cssText = 'margin-top:8px;padding:8px 16px;border-radius:8px;border:none;background:#FF6B6B;color:#fff;cursor:pointer;';
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
    if (won) { recordGameWin('riddles', level); updateAchievement('riddle_master'); checkProgressAchievements(); }
    trackEvent(won?'riddles_won':'riddles_lost', { level, score });
    const best = Math.max(+(localStorage.getItem('riddles-best')||0), score);
    localStorage.setItem('riddles-best', best);
    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">'+(won?'🎉':'😅')+'</div><h2 style="margin:12px 0;color:#222;font-size:22px;">'+(won?'Молодец!':'Попробуй ещё!')+'</h2><p style="color:#444;font-size:16px;">Отгадано '+score+' из '+total+'</p><p style="color:#666;">🏆 Лучший: '+best+'</p><button id="rr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 '+(won?'Дальше':'Ещё раз')+'</button><button id="re" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
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
