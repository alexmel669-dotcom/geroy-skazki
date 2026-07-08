import { appState, getActiveChild, showGamesMenu } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { getChildGender, formatChildText } from '../gender.js';

const ELEMENTS = ['🔥', '🧊', '💧', '🌿'];
const ELEMENT_NAMES = ['Огонь', 'Лёд', 'Вода', 'Природа'];

function battleResult(player, dragon) {
  if (player === dragon) return 'draw';
  if ((player === 0 && dragon === 1) || (player === 1 && dragon === 3) || (player === 3 && dragon === 2) || (player === 2 && dragon === 0)) return 'player';
  return 'dragon';
}

const CHAPTERS = {
  forest: {
    start: {
      text: '🌲 Люцик потерял кристалл в лесу. Поможешь найти?\n\nТы у лесной тропинки.',
      bg: 'linear-gradient(180deg, #2d5a27, #1a3a15)', emoji: '🌲',
      choices: [{ label: '🦉 К дубу совы', next: 'owl' }, { label: '🌊 К ручью', next: 'stream' }]
    },
    owl: {
      text: '🦉 Сова: «Отгадай загадку — получишь кристалл! Зимой и летом одним цветом.»',
      bg: 'linear-gradient(180deg, #1a3a15, #0d1a08)', emoji: '🦉', isRiddle: true, answer: 'ёлка', crystal: true,
      choices: [{ label: '🎯 Ответить', next: 'owl_answer' }]
    },
    owl_answer: { text: '', bg: '', emoji: '🎯', isResult: true, nextOk: 'owl_win', nextFail: 'owl_fail' },
    owl_win: {
      text: '🦉 Сова: «Верно! Держи кристалл!» (+1💎)', bg: 'linear-gradient(180deg, #FFD700, #8B4513)', emoji: '💎', crystal: true,
      choices: [{ label: '🌊 К ручью', next: 'stream' }, { label: '🏘️ В деревню', next: 'village' }]
    },
    owl_fail: {
      text: '🦉 Сова: «Неверно. Приходи ещё.»', bg: 'linear-gradient(180deg, #8B0000, #4a0000)', emoji: '😿',
      choices: [{ label: '🌊 К ручью', next: 'stream' }]
    },
    stream: {
      text: '🐟 Рыбка запуталась в водорослях. Поможешь?',
      bg: 'linear-gradient(180deg, #1a5276, #0d1b2a)', emoji: '🐟', crystal: true,
      choices: [{ label: '🤝 Помочь (+1💎)', next: 'stream_help' }, { label: '🚶 Пройти мимо', next: 'bridge' }]
    },
    stream_help: {
      text: '🐟 Рыбка: «Спасибо! Вот тебе ключ от моста!» (+1💎)', bg: 'linear-gradient(180deg, #FFD700, #1a5276)', emoji: '🔑', crystal: true,
      choices: [{ label: '🌉 К мосту', next: 'bridge' }]
    },
    bridge: {
      text: '🌉 Мост через реку. Впереди деревня.',
      bg: 'linear-gradient(180deg, #5d4037, #3e2723)', emoji: '🌉',
      choices: [{ label: '🏘️ В деревню', next: 'village' }]
    },
    village: {
      text: '👴 Старик: «Я видел кристалл! Он у дракона в замке. Вот карта.»',
      bg: 'linear-gradient(180deg, #8B4513, #5d2e0c)', emoji: '🗺️',
      choices: [{ label: '🏰 В замок!', next: 'castle_enter' }]
    },
    castle_enter: {
      text: '🏰 Ты у ворот замка. Дракон внутри!',
      bg: 'linear-gradient(180deg, #4a0030, #1a0010)', emoji: '🏰',
      choices: [{ label: '⚔️ Войти', next: 'dragon_battle' }]
    },
    dragon_battle: {
      text: '🐉 Дракон: «Сразись со мной! Выбери стихию!» (3❤️ у дракона)',
      bg: 'linear-gradient(180deg, #1a0010, #0a0005)', emoji: '🐉', isBattle: true,
      choices: ELEMENTS.map((e, i) => ({ label: `${e} ${ELEMENT_NAMES[i]}`, next: 'battle_result', value: i }))
    },
    battle_result: { text: '', bg: '', emoji: '⚔️', isResult: true, nextOk: 'dragon_win', nextFail: 'dragon_lose' },
    dragon_win: {
      text: '🐉 Дракон повержен! Кристалл твой! (+3💎)', bg: 'linear-gradient(180deg, #FFD700, #8B4513)', emoji: '👑', crystal: true,
      choices: [{ label: '🎉 Забрать кристалл', next: 'win_castle' }]
    },
    dragon_lose: {
      text: '🐉 Дракон оказался сильнее... Но ты {смелый}!', bg: 'linear-gradient(180deg, #8B0000, #4a0000)', emoji: '😿',
      choices: [{ label: '🏃 Бежать', next: 'lose_castle' }]
    },
    win_castle: { end: true, text: '', emoji: '👑', win: true, bg: 'linear-gradient(180deg, #FFD700, #8B4513)' },
    lose_castle: { end: true, text: '', emoji: '😿', win: false, bg: 'linear-gradient(180deg, #8B0000, #4a0000)' }
  }
};

export function startQuestGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  let step = 'start';
  let moves = 0;
  const maxMoves = 8 + level;
  let ended = false;
  let crystals = 0;
  let dragonHP = 3;
  let lastAnswer = false;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playStep() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(400, audioCtx.currentTime);
    o.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    o.start();
    o.stop(audioCtx.currentTime + 0.2);
  }

  function playMagic() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, audioCtx.currentTime);
    o.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.3);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    o.start();
    o.stop(audioCtx.currentTime + 0.3);
  }

  function playWin() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.12, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        o.start();
        o.stop(audioCtx.currentTime + 0.2);
      }, i * 120);
    });
  }

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;transition:background 0.5s;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;padding:10px 16px;background:rgba(0,0,0,0.5);color:#fff;font-size:16px;z-index:10;';
  header.innerHTML = `<span>🗺️ Квест</span><span id="qi">💎 ${crystals} | Шаги: 0/${maxMoves}</span><button id="qc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>`;

  const panel = document.createElement('div');
  panel.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;color:#fff;text-align:center;transition:opacity 0.3s;';

  const art = document.createElement('div');
  art.style.cssText = 'font-size:clamp(48px,15vw,80px);margin-bottom:12px;transition:transform 0.3s;';

  const textEl = document.createElement('p');
  textEl.style.cssText = 'font-size:clamp(14px,4vw,18px);line-height:1.6;margin:0 0 20px;max-width:400px;';

  const hpBar = document.createElement('div');
  hpBar.style.cssText = 'display:none;margin-bottom:12px;font-size:18px;';

  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;max-width:350px;';

  panel.append(art, textEl, hpBar, choicesEl);
  overlay.appendChild(header);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const SCENES = CHAPTERS.forest;

  function checkRiddleAnswer(val, answer) {
    const v = val.trim().toLowerCase();
    const variants = [answer, answer.replace('ё', 'е')];
    return variants.some((a) => v === a || v.includes(a));
  }

  function render() {
    const node = SCENES[step];
    if (!node) return;
    panel.style.opacity = '0';
    setTimeout(() => {
      if (node.bg) overlay.style.background = node.bg;
      art.textContent = node.emoji || '🗺️';
      if (step === 'dragon_battle') {
        textEl.textContent = `🐉 Дракон: «Выбери стихию!» (${'❤️'.repeat(dragonHP)})`;
      } else if (node.text) {
        const gender = getChildGender(getActiveChild());
        textEl.textContent = formatChildText(node.text, gender);
      }
      document.getElementById('qi').textContent = `💎 ${crystals} | Шаги: ${moves}/${maxMoves}`;
      hpBar.style.display = step === 'dragon_battle' ? 'block' : 'none';
      choicesEl.innerHTML = '';

      if (node.isBattle) {
        node.choices.forEach((c) => {
          const btn = document.createElement('button');
          btn.textContent = c.label;
          btn.style.cssText = 'padding:14px;border-radius:12px;border:2px solid #FFD700;background:rgba(255,215,0,0.15);color:#FFD700;font-size:clamp(14px,4vw,18px);cursor:pointer;';
          btn.onclick = () => {
            playMagic();
            const dragonChoice = Math.floor(Math.random() * 4);
            const result = battleResult(c.value, dragonChoice);
            if (result === 'player') {
              dragonHP--;
              textEl.textContent = `🎯 Попал! (${'❤️'.repeat(Math.max(0, dragonHP))})`;
            } else if (result === 'dragon') {
              textEl.textContent = '😱 Дракон попал в тебя!';
            } else {
              textEl.textContent = '🤝 Ничья!';
            }
            if (dragonHP <= 0) {
              crystals += 3;
              step = 'dragon_win';
            }
            setTimeout(render, 800);
          };
          choicesEl.appendChild(btn);
        });
      } else if (node.isRiddle) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Твой ответ...';
        input.style.cssText = 'width:100%;padding:12px;border-radius:8px;border:2px solid #FFD700;background:rgba(255,215,0,0.1);color:#FFD700;font-size:16px;text-align:center;';
        const btn = document.createElement('button');
        btn.textContent = '🎯 Ответить';
        btn.style.cssText = 'padding:14px;border-radius:12px;border:none;background:#FFD700;color:#333;font-size:18px;cursor:pointer;';
        btn.onclick = () => {
          if (checkRiddleAnswer(input.value, node.answer)) {
            crystals++;
            lastAnswer = true;
            step = 'owl_win';
            playStep();
          } else {
            lastAnswer = false;
            step = 'owl_fail';
          }
          render();
        };
        choicesEl.append(input, btn);
        input.onkeydown = (e) => { if (e.key === 'Enter') btn.click(); };
        input.focus();
      } else if (node.isResult) {
        step = lastAnswer ? node.nextOk : node.nextFail;
        if (lastAnswer && SCENES[step]?.crystal) crystals++;
        lastAnswer = false;
        render();
      } else if (node.end) {
        const ending = crystals >= 6 ? '👑 Легендарная концовка! Люцик — король!' :
          crystals >= 4 ? '🎉 Кристалл сияет! Люцик счастлив!' :
            crystals >= 2 ? '🙂 Кристалл найден, но не весь.' :
              '😿 Кристалл потерян...';
        const btn = document.createElement('button');
        btn.textContent = node.win ? '🎉 Ура!' : '🔄 Ещё раз';
        btn.style.cssText = 'padding:14px 32px;border-radius:12px;border:none;background:#FFD700;color:#333;font-size:18px;cursor:pointer;';
        btn.onclick = () => endGame(node.win, ending);
        choicesEl.appendChild(btn);
      } else if (moves >= maxMoves) {
        const btn = document.createElement('button');
        btn.textContent = '⏱ Время вышло';
        btn.style.cssText = 'padding:14px 32px;border-radius:12px;border:none;background:#c0392b;color:#fff;font-size:18px;cursor:pointer;';
        btn.onclick = () => endGame(false, '⏱ Время вышло!');
        choicesEl.appendChild(btn);
      } else {
        node.choices.forEach((c) => {
          const btn = document.createElement('button');
          btn.textContent = c.label;
          btn.style.cssText = 'padding:14px;border-radius:12px;border:2px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.1);color:#fff;font-size:clamp(14px,4vw,18px);cursor:pointer;';
          btn.onclick = () => {
            moves++;
            if (node.crystal) crystals++;
            step = c.next;
            playStep();
            render();
          };
          choicesEl.appendChild(btn);
        });
      }
      panel.style.opacity = '1';
    }, 300);
  }

  function endGame(won, endingText) {
    if (ended) return;
    ended = true;
    if (won) playWin();
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
    audioCtx.close();

    recordGameResult('quest', won, level);
    if (won) {
      updateAchievement('quest_hero');
      checkProgressAchievements();
    }
    trackEvent(won ? 'quest_won' : 'quest_lost', { level, crystals });

    const best = Math.max(+(localStorage.getItem('quest-best') || 0), crystals);
    localStorage.setItem('quest-best', String(best));
    window.leaderboard?.submitScore('quest', crystals);

    const emoji = SCENES[step]?.emoji || (won ? '🗺️' : '😅');
    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:340px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
        <div style="font-size:48px;">${emoji}</div>
        <h2 style="margin:12px 0;color:#222;font-size:20px;">${endingText}</h2>
        <p style="color:#444;font-size:16px;">💎 Кристаллов: ${crystals}</p>
        <p style="color:#666;">🏆 Лучший: ${best}</p>
        <button id="qr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 ${won ? 'Дальше' : 'Ещё раз'}</button>
        <button id="qe" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button>
      </div>
    `;
    document.body.appendChild(result);
    result.querySelector('#qr').onclick = () => { result.remove(); startQuestGame(won ? level + 1 : level); };
    result.querySelector('#qe').onclick = () => { result.remove(); showGamesMenu(); };
  }

  document.getElementById('qc').onclick = () => {
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
    audioCtx.close();
  };

  render();
  trackEvent('quest_started', { level });
}

export default { startQuestGame };
