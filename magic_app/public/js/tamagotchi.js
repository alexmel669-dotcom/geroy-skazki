/**
 * Тамагочи-шкалы per ребёнок (в stats.tamagotchi).
 */

const DEFAULT = { mood: 70, hunger: 60, energy: 50, courage: 10, moodTick: 0, hungerTick: 0, energyTick: 0 };

export function getTamagotchi(stats) {
  if (!stats.tamagotchi) stats.tamagotchi = { ...DEFAULT };
  return stats.tamagotchi;
}

export function applyTamagotchiTick(stats) {
  const t = getTamagotchi(stats);
  t.moodTick = (t.moodTick || 0) + 1;
  t.hungerTick = (t.hungerTick || 0) + 1;
  t.energyTick = (t.energyTick || 0) + 1;
  if (t.moodTick >= 5) { t.mood = Math.max(0, (t.mood ?? 70) - 5); t.moodTick = 0; }
  if (t.hungerTick >= 3) { t.hunger = Math.max(0, (t.hunger ?? 60) - 5); t.hungerTick = 0; }
  if (t.energyTick >= 4) { t.energy = Math.max(0, (t.energy ?? 50) - 5); t.energyTick = 0; }
  return t;
}

export function clampStat(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function bumpTamagotchi(stats, field, delta) {
  const t = getTamagotchi(stats);
  t[field] = clampStat((t[field] ?? DEFAULT[field]) + delta);
  return t;
}

export function onChat(stats) { bumpTamagotchi(stats, 'mood', 20); }
export function onGame(stats) { bumpTamagotchi(stats, 'mood', 15); bumpTamagotchi(stats, 'courage', 5); }
export function onFeed(stats) { bumpTamagotchi(stats, 'hunger', 100); bumpTamagotchi(stats, 'mood', 10); }
export function onClean(stats) { bumpTamagotchi(stats, 'energy', 100); }
export function onRest(stats) { bumpTamagotchi(stats, 'energy', 50); }
export function onFearTalk(stats) { bumpTamagotchi(stats, 'courage', 8); }

export function getTamagotchiNeedsMessage(stats) {
  const t = getTamagotchi(stats);
  if ((t.hunger ?? 60) <= 0) return 'Покорми меня, пожалуйста!';
  if ((t.mood ?? 70) <= 0) return 'Давай поиграем, мне грустно!';
  return null;
}

export default {
  getTamagotchi, applyTamagotchiTick, bumpTamagotchi,
  onChat, onGame, onFeed, onClean, onRest, onFearTalk, getTamagotchiNeedsMessage
};

class Tamagotchi {
  constructor() {
    this.hunger = 100;
    this.energy = 100;
    this.mood = 100;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 60000);
    this.updateBars();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick() {
    this.hunger = Math.max(0, this.hunger - 1);
    this.energy = Math.max(0, this.energy - 0.5);
    this.mood = Math.max(0, this.mood - 0.3);
    this.updateBars();
    if (this.hunger < 20) window.ttsEngine?.speak('Я голоден! Давай поиграем?');
    if (this.energy < 20) window.ttsEngine?.speak('Я устал...');
  }

  updateBars() {
    const bars = [
      ['hunger', this.hunger],
      ['energy', this.energy],
      ['mood', this.mood]
    ];
    for (const [key, val] of bars) {
      const el = document.getElementById(`${key}Bar`) || document.getElementById(`${key}Fill`);
      if (el) el.style.width = `${val}%`;
    }
  }

  feed() {
    this.hunger = Math.min(100, this.hunger + 30);
    this.mood = Math.min(100, this.mood + 10);
    this.updateBars();
  }

  play() {
    this.mood = Math.min(100, this.mood + 20);
    this.energy = Math.max(0, this.energy - 10);
    this.updateBars();
  }

  sleep() {
    this.energy = 100;
    this.updateBars();
  }
}

if (typeof window !== 'undefined') {
  window.tamagotchi = new Tamagotchi();
}

