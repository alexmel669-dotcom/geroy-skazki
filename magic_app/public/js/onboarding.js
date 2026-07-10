// onboarding.js — голосовой гид для детей
import { ttsEngine } from './audio.js';

const STORAGE_KEY = 'ob-done';
const LEGACY_KEY = 'geroy-onboarding-done';

function markHintsPlayed() {
  localStorage.setItem('mic-hint-played', 'true');
  localStorage.setItem('games-hint-played', 'true');
  localStorage.setItem('swipe-hint-played', 'true');
}

export class OnboardingGuide {
  constructor() {
    this.steps = [
      {
        target: '#micButton, #mic-button',
        voice: 'Нажми и держи микрофон, чтобы говорить со мной. Отпусти — и я отвечу!',
        text: '🎤 Говори с Люциком'
      },
      {
        target: '#avatar, .character-avatar',
        voice: 'Свайпни по мне влево или вправо, чтобы переключиться между детьми!',
        text: '👧👦 Переключай детей'
      },
      {
        target: '#games-menu, .game-menu',
        voice: 'Здесь игры! Давай поиграем вместе!',
        text: '🎮 Игры'
      }
    ];
  }

  start() {
    if (localStorage.getItem(STORAGE_KEY) === '1' || localStorage.getItem(LEGACY_KEY) === 'true') return;
    if (document.getElementById('childSelectModal')?.style.display === 'flex') {
      setTimeout(() => this.start(), 800);
      return;
    }
    this.show(0);
  }

  show(i) {
    if (i >= this.steps.length) {
      localStorage.setItem(STORAGE_KEY, '1');
      localStorage.setItem(LEGACY_KEY, 'true');
      markHintsPlayed();
      return;
    }

    const step = this.steps[i];
    const el = document.querySelector(step.target);
    if (!el) return this.show(i + 1);

    el.style.boxShadow = '0 0 0 9999px rgba(0,0,0,.5), 0 0 0 4px #FFB800';
    el.style.position = 'relative';
    el.style.zIndex = '3000';

    ttsEngine.speak(step.voice).catch(() => {});

    const tip = document.createElement('div');
    tip.className = 'ob-tip onboarding-tooltip';
    tip.innerHTML = `<p>${step.text}</p><button type="button" id="obNext">${i === this.steps.length - 1 ? 'Понятно' : 'Далее →'}</button>`;

    const r = el.getBoundingClientRect();
    tip.style.position = 'fixed';
    tip.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - 280))}px`;
    tip.style.top = '60px';
    tip.style.bottom = 'auto';
    tip.style.zIndex = '3001';
    document.body.appendChild(tip);

    tip.querySelector('#obNext').onclick = () => {
      el.style.cssText = '';
      tip.remove();
      this.show(i + 1);
    };
  }
}

export function startOnboarding() {
  const guide = new OnboardingGuide();
  guide.start();
  return guide;
}

if (typeof window !== 'undefined') {
  window.onboarding = new OnboardingGuide();
}

export default { OnboardingGuide, startOnboarding };
