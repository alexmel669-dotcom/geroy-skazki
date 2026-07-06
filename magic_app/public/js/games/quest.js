import { appState, getActiveChild } from '../core.js';
import { setAvatarState } from '../ui.js';
import { trackEvent } from '../analytics.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { getChildGender, formatChildText } from '../gender.js';
import { getQuestMaxMoves } from './game-difficulty.js';
const QUEST_STORY = {
  start: {
    text: '🗺️ Люцик потерял волшебный кристалл! Поможешь найти?\n\nВы стоите у лесной тропинки. Куда пойдёте?',
    emoji: '🌲',
    choices: [
      { label: '🏔️ В горы', next: 'mountain' },
      { label: '🌊 К реке', next: 'river' }
    ]
  },
  mountain: {
    text: '⛰️ В горах ветрено. На скале сидит мудрая сова.',
    emoji: '🦉',
    choices: [
      { label: '🗣️ Спросить сову', next: 'owl' },
      { label: '🔦 Осмотреть пещеру', next: 'cave' }
    ]
  },
  river: {
    text: '🌊 У реки плещется рыбка. Она что-то знает!',
    emoji: '🐟',
    choices: [
      { label: '💬 Поговорить с рыбкой', next: 'fish' },
      { label: '🌉 Перейти мост', next: 'bridge' }
    ]
  },
  owl: {
    text: '🦉 Сова шепчет: «Кристалл там, где светит луна и поют сверчки.»',
    emoji: '🌙',
    choices: [
      { label: '🌿 Идти к поляне', next: 'meadow' },
      { label: '🏠 Вернуться в деревню', next: 'village' }
    ]
  },
  cave: {
    text: '🕳️ В пещере темно, но ты {смелый}! Там светится что-то...',
    emoji: '💎',
    choices: [
      { label: '✨ Взять кристалл', next: 'win_cave' },
      { label: '🔙 Назад', next: 'mountain' }
    ]
  },
  fish: {
    text: '🐟 Рыбка говорит: «Кристалл спрятан под мостом, где растут цветы.»',
    emoji: '🌸',
    choices: [{ label: '🌉 К мосту', next: 'bridge' }]
  },
  bridge: {
    text: '🌉 Под мостом блестит кристалл! Но его охраняет маленький дракончик.',
    emoji: '🐉',
    choices: [
      { label: '🎁 Подарить яблоко', next: 'win_kind' },
      { label: '🏃 Убежать', next: 'lose_run' }
    ]
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

const START_BY_LEVEL = {
  1: 'start',
  2: 'mountain',
  3: 'river',
  4: 'village',
  5: 'bridge'
};

export function startQuestGame(level) {
  if (appState.gameActive) return;
  level = level || getGameLevel('quest');

  let step = START_BY_LEVEL[level] || 'start';
  let moves = 0;
  const maxMoves = getQuestMaxMoves(level);

  appState.gameActive = true;

  const { body, close } = createGameScreen({
    gameId: 'quest',
    title: 'Текстовый квест',
    emoji: '🗺️',
    level
  });

  const panel = document.createElement('div');
  panel.className = 'game-panel quest-panel';
  panel.style.cssText = 'max-width:400px;width:100%;text-align:center;';

  const art = document.createElement('div');
  art.className = 'quest-art';
  art.style.cssText = 'font-size:4.5rem;margin:8px 0;animation:gameResultBounce 2s ease-in-out infinite;';

  const text = document.createElement('p');
  text.style.cssText = 'line-height:1.55;font-size:1rem;margin:0 0 16px;';

  const movesEl = document.createElement('p');
  movesEl.style.cssText = 'font-size:0.8rem;opacity:0.7;margin-bottom:12px;';

  const choices = document.createElement('div');
  choices.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;';

  function finishEnd(node) {
    appState.gameActive = false;
    close();
    if (node.win) {
      setAvatarState('happy');
      setTimeout(() => setAvatarState(null), 1200);
      recordGameWin('quest', level);
      showGameResult({
        won: true,
        level,
        scoreText: `Квест пройден за ${moves} шагов!`,
        onNext: () => startQuestGame(level + 1)
      });
      trackEvent('quest_won', { level, moves });
    } else {
      showGameResult({
        won: false,
        level,
        scoreText: formatChildText(node.text, getChildGender(getActiveChild())),
        onRestart: () => startQuestGame(level)
      });
      trackEvent('quest_lost', { level });
    }
  }

  function render() {
    const node = QUEST_STORY[step];
    if (!node) return;

    art.textContent = node.emoji || '🗺️';
    const gender = getChildGender(getActiveChild());
    text.textContent = formatChildText(node.text, gender);
    movesEl.textContent = `Шагов: ${moves}${maxMoves < 14 ? ` · лимит ${maxMoves}` : ''}`;

    if (node.end) {
      choices.innerHTML = '';
      const again = document.createElement('button');
      again.className = 'modal-btn';
      again.textContent = node.win ? '🎉 Ура!' : '🔄 Ещё раз';
      again.onclick = () => finishEnd(node);
      choices.appendChild(again);
      return;
    }

    if (moves >= maxMoves) {
      finishEnd({ win: false, text: '⏱️ Время вышло! Попробуй короче путь.' });
      return;
    }

    choices.innerHTML = '';
    node.choices.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'modal-btn quest-choice-btn';
      btn.textContent = c.label;
      btn.onclick = () => {
        moves++;
        step = c.next;
        render();
      };
      choices.appendChild(btn);
    });
  }

  panel.append(art, text, movesEl, choices);
  body.appendChild(panel);
  render();
  trackEvent('quest_started', { level });
}

export default startQuestGame;
