import { appState, getActiveChild } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { getChildGender, formatChildText } from '../gender.js';

const STORY = {
  start: {
    text: '🗺️ Люцик потерял волшебный кристалл! Поможешь найти?\n\nВы стоите у лесной тропинки. Куда пойдёте?',
    emoji: '🌲',
    choices: [{ label: '⛰️ В горы', next: 'mountain' }, { label: '🌊 К реке', next: 'river' }]
  },
  mountain: {
    text: '⛰️ В горах ветрено. На скале сидит мудрая сова.',
    emoji: '🦉',
    choices: [{ label: '🗣️ Спросить сову', next: 'owl' }, { label: '🕳️ Осмотреть пещеру', next: 'cave' }]
  },
  river: {
    text: '🌊 У реки плещется рыбка. Она что-то знает!',
    emoji: '🐟',
    choices: [{ label: '💬 Поговорить с рыбкой', next: 'fish_talk' }, { label: '🌉 Перейти мост', next: 'bridge' }]
  },
  owl: {
    text: '🦉 Сова шепчет: «Кристалл там, где светит луна и поют сверчки.»',
    emoji: '🌙',
    choices: [{ label: '🌿 Идти к поляне', next: 'meadow' }, { label: '🏘️ Вернуться в деревню', next: 'village' }]
  },
  cave: {
    text: '🕳️ В пещере темно, но ты {смелый}! Там светится что-то...',
    emoji: '💎',
    choices: [{ label: '✨ Взять кристалл', next: 'win_cave' }, { label: '↩️ Назад', next: 'mountain' }]
  },
  fish_talk: {
    text: '🐟 Рыбка говорит: «Кристалл спрятан под мостом, где растут цветы.»',
    emoji: '🌸',
    choices: [{ label: '🌉 К мосту', next: 'bridge' }]
  },
  bridge: {
    text: '🌉 Под мостом блестит кристалл! Но его охраняет маленький дракончик.',
    emoji: '🐉',
    choices: [{ label: '🎁 Подарить яблоко', next: 'win_kind' }, { label: '🏃 Убежать', next: 'lose_run' }]
  },
  meadow: {
    text: '🌿 На поляне сверчки поют. Кристалл лежит среди цветов!',
    emoji: '💎',
    choices: [{ label: '🎉 Забрать кристалл', next: 'win_meadow' }]
  },
  village: {
    text: '🏘️ В деревне старик даёт карту. Она ведёт к мосту!',
    emoji: '🗺️',
    choices: [{ label: '🌉 К мосту', next: 'bridge' }]
  },
  win_cave: { end: true, text: '🎉 Ты {нашёл} кристалл в пещере! Люцик сияет от радости!', emoji: '✨', win: true },
  win_kind: { end: true, text: '🎉 Дракончик съел яблоко и отдал кристалл! Вы — настоящие друзья!', emoji: '💎', win: true },
  win_meadow: { end: true, text: '🎉 Кристалл на поляне найден! Люцик может творить волшебство снова!', emoji: '🌟', win: true },
  lose_run: { end: true, text: '😅 Дракончик спрятал кристалл. Но ты {смелый} — попробуй ещё раз!', emoji: '🐉', win: false }
};

const STARTS = { 1: 'start', 2: 'mountain', 3: 'river', 4: 'village', 5: 'bridge' };

export function startQuestGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('quest');

  let step = STARTS[Math.min(level, 5)] || 'start';
  let moves = 0; const maxMoves = 5 + level * 2; let ended = false;

  const { body, close } = createGameScreen({ gameId: 'quest', title: '🗺️ Квест', emoji: '🗺️', level });

  const panel = document.createElement('div');
  panel.style.cssText = 'text-align:center;color:#fff;max-width:400px;margin:0 auto;';

  const art = document.createElement('div');
  art.style.cssText = 'font-size:64px;margin:8px 0;';

  const textEl = document.createElement('p');
  textEl.style.cssText = 'font-size:16px;line-height:1.5;margin:0 0 16px;min-height:60px;';

  const movesEl = document.createElement('p');
  movesEl.style.cssText = 'font-size:14px;opacity:0.7;margin-bottom:12px;';

  const choicesEl = document.createElement('div');
  choicesEl.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

  panel.append(art, textEl, movesEl, choicesEl);
  body.appendChild(panel);

  function render() {
    const node = STORY[step];
    if (!node) return;

    art.textContent = node.emoji || '🗺️';
    textEl.textContent = formatChildText(node.text, getChildGender(getActiveChild()));
    movesEl.textContent = `Шагов: ${moves} / ${maxMoves}`;

    if (node.end) {
      choicesEl.innerHTML = '';
      const btn = document.createElement('button');
      btn.textContent = node.win ? '🎉 Ура!' : '🔄 Ещё раз';
      btn.style.cssText = 'padding:12px 32px;border-radius:12px;border:none;background:#FFD700;color:#333;font-size:18px;cursor:pointer;';
      btn.onclick = () => endGame(node.win);
      choicesEl.appendChild(btn);
      return;
    }

    if (moves >= maxMoves) {
      choicesEl.innerHTML = '';
      const btn = document.createElement('button');
      btn.textContent = '⏱ Время вышло';
      btn.style.cssText = 'padding:12px 32px;border-radius:12px;border:none;background:#FF6B6B;color:#fff;font-size:18px;cursor:pointer;';
      btn.onclick = () => endGame(false);
      choicesEl.appendChild(btn);
      return;
    }

    choicesEl.innerHTML = '';
    node.choices.forEach((c) => {
      const btn = document.createElement('button');
      btn.textContent = c.label;
      btn.style.cssText = 'padding:12px 20px;border-radius:12px;border:2px solid #FFD700;background:transparent;color:#FFD700;font-size:16px;cursor:pointer;';
      btn.onclick = () => { moves++; step = c.next; render(); };
      choicesEl.appendChild(btn);
    });
  }

  function endGame(won) {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    close();
    recordGameResult('quest', won, level);
    if (won) { recordGameWin('quest', level); updateAchievement('quest_hero'); checkProgressAchievements(); }
    trackEvent(won ? 'quest_won' : 'quest_lost', { level, moves });
    speak(won ? 'Кристалл найден!' : 'Попробуй другой путь!');
    showGameResult({
      won, level,
      scoreText: `Пройдено за ${moves} шагов`,
      onNext: won ? () => startQuestGame(level + 1) : null,
      onRestart: () => startQuestGame(level)
    });
  }

  render();
  trackEvent('quest_started', { level });
}

export default { startQuestGame };
