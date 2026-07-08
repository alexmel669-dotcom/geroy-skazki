import { appState, getActiveChild, showGamesMenu } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { getChildGender, formatChildText } from '../gender.js';

const SCENES = {
  start: {
    text: '🗺️ Люцик потерял волшебный кристалл! Поможешь найти?\n\nВы стоите у лесной тропинки. Куда пойдёте?',
    bg: 'linear-gradient(180deg, #2d5a27, #1a3a15)',
    emoji: '🌲',
    choices: [{ label: '⛰️ В горы', next: 'mountain' }, { label: '🌊 К реке', next: 'river' }]
  },
  mountain: {
    text: '⛰️ В горах ветрено. На скале сидит мудрая сова.',
    bg: 'linear-gradient(180deg, #4a4a4a, #2c2c2c)',
    emoji: '🦉',
    choices: [{ label: '🗣️ Спросить сову', next: 'owl' }, { label: '🕳️ Осмотреть пещеру', next: 'cave' }]
  },
  river: {
    text: '🌊 У реки плещется рыбка. Она что-то знает!',
    bg: 'linear-gradient(180deg, #1a5276, #0d1b2a)',
    emoji: '🐟',
    choices: [{ label: '💬 Поговорить с рыбкой', next: 'fish_talk' }, { label: '🌉 Перейти мост', next: 'bridge' }]
  },
  owl: {
    text: '🦉 Сова шепчет: «Кристалл там, где светит луна и поют сверчки.»',
    bg: 'linear-gradient(180deg, #2c1810, #1a0a05)',
    emoji: '🌙',
    choices: [{ label: '🌿 Идти к поляне', next: 'meadow' }, { label: '🏘️ Вернуться в деревню', next: 'village' }]
  },
  cave: {
    text: '🕳️ В пещере темно, но ты {смелый}! Там светится что-то...',
    bg: 'linear-gradient(180deg, #1a1a2e, #0a0a15)',
    emoji: '💎',
    choices: [{ label: '✨ Взять кристалл', next: 'win_cave' }, { label: '↩️ Назад', next: 'mountain' }]
  },
  fish_talk: {
    text: '🐟 Рыбка говорит: «Кристалл спрятан под мостом, где растут цветы.»',
    bg: 'linear-gradient(180deg, #1a5276, #0d1b2a)',
    emoji: '🌸',
    choices: [{ label: '🌉 К мосту', next: 'bridge' }]
  },
  bridge: {
    text: '🌉 Под мостом блестит кристалл! Но его охраняет маленький дракончик.',
    bg: 'linear-gradient(180deg, #5d4037, #3e2723)',
    emoji: '🐉',
    choices: [{ label: '🎁 Подарить яблоко', next: 'dragon_fight' }, { label: '🏃 Убежать', next: 'lose_run' }]
  },
  dragon_fight: {
    text: '🐉 Дракончик хочет сыграть в камень-ножницы-бумагу! Выбери:',
    bg: 'linear-gradient(180deg, #4a0030, #1a0010)',
    emoji: '⚔️',
    choices: [
      { label: '🪨 Камень', next: 'dragon_result', value: 0 },
      { label: '📄 Бумага', next: 'dragon_result', value: 1 },
      { label: '✂️ Ножницы', next: 'dragon_result', value: 2 }
    ],
    isBattle: true
  },
  dragon_result: {
    text: '', bg: 'linear-gradient(180deg, #4a0030, #1a0010)', emoji: '🎲', isResult: true
  },
  meadow: {
    text: '🌿 На поляне сверчки поют. Кристалл лежит среди цветов!',
    bg: 'linear-gradient(180deg, #4a7c3f, #2d5a27)',
    emoji: '💎',
    choices: [{ label: '🎉 Забрать кристалл', next: 'win_meadow' }]
  },
  village: {
    text: '🏘️ В деревне старик даёт карту. Она ведёт к мосту!',
    bg: 'linear-gradient(180deg, #8B4513, #5d2e0c)',
    emoji: '🗺️',
    choices: [{ label: '🌉 К мосту', next: 'bridge' }]
  },
  win_cave: { end: true, text: '🎉 Ты {нашёл} кристалл в пещере! Люцик сияет от радости!', emoji: '✨', win: true, bg: 'linear-gradient(180deg, #FFD700, #8B4513)' },
  win_kind: { end: true, text: '🎉 Дракончик отдал кристалл за яблоко! Вы — настоящие друзья!', emoji: '💎', win: true, bg: 'linear-gradient(180deg, #FFD700, #8B4513)' },
  win_meadow: { end: true, text: '🎉 Кристалл на поляне найден! Люцик может творить волшебство снова!', emoji: '🌟', win: true, bg: 'linear-gradient(180deg, #FFD700, #8B4513)' },
  lose_run: { end: true, text: '😅 Дракончик спрятал кристалл. Но ты {смелый} — попробуй ещё раз!', emoji: '🐉', win: false, bg: 'linear-gradient(180deg, #8B0000, #4a0000)' }
};

const STARTS = { 1: 'start', 2: 'mountain', 3: 'river', 4: 'village', 5: 'bridge' };

export function startQuestGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  let step = STARTS[Math.min(level, 5)] || 'start';
  let moves = 0;
  const maxMoves = 5 + level * 2;
  let ended = false;
  let crystals = 0;

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
  header.innerHTML = `<span>🗺️ Квест</span><span id="qm">Шагов: 0/${maxMoves}</span><button id="qc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>`;

  const panel = document.createElement('div');
  panel.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;color:#fff;text-align:center;transition:opacity 0.3s;';

  const art = document.createElement('div');
  art.style.cssText = 'font-size:clamp(48px,15vw,80px);margin-bottom:12px;transition:transform 0.3s;';

  const textEl = document.createElement('p');
  textEl.style.cssText = 'font-size:clamp(14px,4vw,18px);line-height:1.6;margin:0 0 20px;max-width:400px;';

  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;max-width:350px;';

  panel.append(art, textEl, choicesEl);
  overlay.appendChild(header);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  function render() {
    const node = SCENES[step];
    if (!node) return;
    panel.style.opacity = '0';
    setTimeout(() => {
      overlay.style.background = node.bg;
      art.textContent = node.emoji || '🗺️';
      const gender = getChildGender(getActiveChild());
      textEl.textContent = formatChildText(node.text, gender);
      document.getElementById('qm').textContent = `Шагов: ${moves}/${maxMoves}`;
      choicesEl.innerHTML = '';

      if (node.isBattle) {
        node.choices.forEach((c) => {
          const btn = document.createElement('button');
          btn.textContent = c.label;
          btn.style.cssText = 'padding:14px;border-radius:12px;border:2px solid #FFD700;background:rgba(255,215,0,0.15);color:#FFD700;font-size:clamp(14px,4vw,18px);cursor:pointer;';
          btn.onclick = () => {
            const dragonChoice = Math.floor(Math.random() * 3);
            const playerChoice = c.value;
            let win;
            if (playerChoice === dragonChoice) win = 'draw';
            else if ((playerChoice === 0 && dragonChoice === 2) || (playerChoice === 1 && dragonChoice === 0) || (playerChoice === 2 && dragonChoice === 1)) win = 'player';
            else win = 'dragon';
            if (win === 'player' || win === 'draw') { crystals++; step = 'win_kind'; }
            else step = 'lose_run';
            playStep();
            render();
          };
          choicesEl.appendChild(btn);
        });
      } else if (node.isResult) {
        step = 'win_kind';
        render();
      } else if (node.end) {
        const btn = document.createElement('button');
        btn.textContent = node.win ? '🎉 Ура!' : '🔄 Ещё раз';
        btn.style.cssText = 'padding:14px 32px;border-radius:12px;border:none;background:#FFD700;color:#333;font-size:18px;cursor:pointer;';
        btn.onclick = () => endGame(node.win);
        choicesEl.appendChild(btn);
      } else if (moves >= maxMoves) {
        const btn = document.createElement('button');
        btn.textContent = '⏱ Время вышло';
        btn.style.cssText = 'padding:14px 32px;border-radius:12px;border:none;background:#c0392b;color:#fff;font-size:18px;cursor:pointer;';
        btn.onclick = () => endGame(false);
        choicesEl.appendChild(btn);
      } else {
        node.choices.forEach((c) => {
          const btn = document.createElement('button');
          btn.textContent = c.label;
          btn.style.cssText = 'padding:14px;border-radius:12px;border:2px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.1);color:#fff;font-size:clamp(14px,4vw,18px);cursor:pointer;';
          btn.onclick = () => { moves++; step = c.next; playStep(); render(); };
          choicesEl.appendChild(btn);
        });
      }
      panel.style.opacity = '1';
    }, 300);
  }

  function endGame(won) {
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
    trackEvent(won ? 'quest_won' : 'quest_lost', { level, moves, crystals });

    const best = Math.max(+(localStorage.getItem('quest-best') || 0), crystals);
    localStorage.setItem('quest-best', String(best));
    window.leaderboard?.submitScore('quest', crystals);

    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
        <div style="font-size:48px;">${won ? '🗺️' : '😅'}</div>
        <h2 style="margin:12px 0;color:#222;font-size:22px;">${won ? 'Приключение завершено!' : 'Попробуй другой путь!'}</h2>
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
