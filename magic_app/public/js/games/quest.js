import { appState } from '../core.js';
import { showModal } from '../ui.js';
import { setAvatarState } from '../ui.js';

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
    text: '🕳️ В пещере темно, но ты смелый! Там светится что-то...',
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
  win_cave: { end: true, text: '🎉 Ты нашёл кристалл в пещере! Люцик сияет от радости!', emoji: '✨', win: true },
  win_kind: { end: true, text: '🎉 Дракончик съел яблоко и отдал кристалл! Вы — настоящие друзья!', emoji: '💎', win: true },
  win_meadow: { end: true, text: '🎉 Кристалл на поляне найден! Люцик может творить волшебство снова!', emoji: '🌟', win: true },
  lose_run: { end: true, text: '😅 Дракончик спрятал кристалл. Но ты смелый — попробуй ещё раз!', emoji: '🐉', win: false }
};

export function startQuestGame() {
  if (appState.gameActive) return;
  appState.gameActive = true;

  let step = 'start';
  const container = document.createElement('div');
  container.className = 'game-overlay';

  const art = document.createElement('div');
  art.style.cssText = 'font-size:4rem;margin:10px 0;';

  const text = document.createElement('p');
  text.style.cssText = 'line-height:1.55;font-size:1rem;max-width:340px;margin:0 auto 16px;';

  const choices = document.createElement('div');
  choices.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

  function render() {
    const node = QUEST_STORY[step];
    if (!node) return;
    art.textContent = node.emoji || '🗺️';
    text.textContent = node.text;

    if (node.end) {
      choices.innerHTML = '';
      if (node.win) {
        setAvatarState('happy');
        setTimeout(() => setAvatarState(null), 1600);
      }
      const again = document.createElement('button');
      again.className = 'modal-btn';
      again.textContent = node.win ? '🎉 Ура!' : '🔄 Ещё раз';
      again.onclick = () => {
        if (node.win) {
          showModal('Квест пройден!', node.text);
          container.remove();
          appState.gameActive = false;
        } else {
          step = 'start';
          render();
        }
      };
      choices.appendChild(again);
      return;
    }

    choices.innerHTML = '';
    node.choices.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'modal-btn';
      btn.textContent = c.label;
      btn.onclick = () => {
        step = c.next;
        render();
      };
      choices.appendChild(btn);
    });
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-btn secondary';
  closeBtn.textContent = 'Закрыть';
  closeBtn.style.marginTop = '14px';
  closeBtn.onclick = () => {
    container.remove();
    appState.gameActive = false;
  };

  const title = document.createElement('h2');
  title.textContent = '🗺️ Текстовый квест';

  container.append(title, art, text, choices, closeBtn);
  document.body.appendChild(container);
  render();
}

export default startQuestGame;
