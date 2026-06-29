// onboarding.js — пошаговый гид для детей
import { ttsEngine } from './audio.js';

const STORAGE_KEY = 'geroy-onboarding-done';

const STEPS = [
  {
    target: '#mic-button',
    title: 'Микрофон 🎤',
    text: 'Нажми и говори — Люцик тебя услышит!',
    position: 'top'
  },
  {
    target: '.character-avatar',
    title: 'Друзья 🐱',
    text: 'Свайпай аватар, чтобы выбрать друга для разговора.',
    position: 'bottom'
  },
  {
    target: '#send-text-btn',
    title: 'Клавиатура ✉️',
    text: 'Можешь написать сообщение, если не хочешь говорить.',
    position: 'top'
  },
  {
    target: '#games-menu',
    title: 'Игры 🎮',
    text: 'Здесь живут волшебные игры — нажми и выбирай!',
    position: 'top'
  },
  {
    target: '#achievements-btn',
    title: 'Награды ⭐',
    text: 'Собирай звёздочки за сказки и игры!',
    position: 'bottom'
  }
];

export class OnboardingGuide {
  constructor() {
    this.step = 0;
    this.overlay = null;
    this.tooltip = null;
    this.spotlight = null;
  }

  start() {
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    if (document.getElementById('childSelectModal')?.style.display === 'flex') {
      setTimeout(() => this.start(), 800);
      return;
    }
    this.step = 0;
    this._buildOverlay();
    this._showStep();
  }

  _buildOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    this.overlay.innerHTML = '<div class="onboarding-spotlight"></div>';
    this.spotlight = this.overlay.querySelector('.onboarding-spotlight');

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'onboarding-tooltip';
    this.overlay.appendChild(this.tooltip);
    document.body.appendChild(this.overlay);
  }

  _showStep() {
    const def = STEPS[this.step];
    if (!def) return this._finish();

    const el = document.querySelector(def.target);
    if (!el) {
      this.step += 1;
      return this._showStep();
    }

    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const rect = el.getBoundingClientRect();
    const pad = 8;

    this.spotlight.style.cssText = `
      top:${rect.top - pad}px;left:${rect.left - pad}px;
      width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px;
    `;

    const dots = STEPS.map((_, i) =>
      `<span class="onboarding-dot${i === this.step ? ' active' : ''}"></span>`
    ).join('');

    this.tooltip.innerHTML = `
      <div class="onboarding-progress">${dots}</div>
      <h3>${def.title}</h3>
      <p>${def.text}</p>
      <div class="onboarding-actions">
        <button type="button" class="onboarding-skip">Пропустить</button>
        <button type="button" class="onboarding-next">Дальше →</button>
      </div>
    `;

    const tipRect = this.tooltip.getBoundingClientRect();
    let top = def.position === 'bottom' ? rect.bottom + 16 : rect.top - tipRect.height - 16;
    let left = rect.left + rect.width / 2 - 140;
    top = Math.max(12, Math.min(top, window.innerHeight - 180));
    left = Math.max(12, Math.min(left, window.innerWidth - 292));
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;

    this.tooltip.querySelector('.onboarding-skip').onclick = () => this._finish(true);
    this.tooltip.querySelector('.onboarding-next').onclick = () => {
      this.step += 1;
      this._showStep();
    };
  }

  _finish(skipped = false) {
    this.overlay?.remove();
    this.overlay = null;
    localStorage.setItem(STORAGE_KEY, 'true');
    if (!skipped) {
      ttsEngine.speak('Привет! Я Люцик. Давай поговорим или поиграем!', 'lucik').catch(() => {});
    }
  }
}

export function startOnboarding() {
  const guide = new OnboardingGuide();
  guide.start();
  return guide;
}

export default { OnboardingGuide, startOnboarding };
