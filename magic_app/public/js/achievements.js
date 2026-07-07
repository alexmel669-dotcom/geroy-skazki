// ========================================
// achievements.js — СИСТЕМА ДОСТИЖЕНИЙ
// ========================================

import { CONFIG } from './config.js';
import { getActiveChildName, safeParseJSON } from './core.js';
import { loadGameProgress } from './game-progress.js';

const ACHIEVEMENTS = {
  first_story: { id: 'first_story', title: '📖 Первая сказка', description: 'Послушать первую сказку', icon: '🌟', threshold: 1, stat: 'totalStories' },
  story_master: { id: 'story_master', title: '🎭 Мастер сказок', description: 'Послушать 10 сказок', icon: '👑', threshold: 10, stat: 'totalStories' },
  fish_master: { id: 'fish_master', title: '🎣 Рыбак', description: 'Выиграть 5 раз в рыбалке', icon: '🎣', game: 'fish', wins: 5 },
  memory_champion: { id: 'memory_champion', title: '🧠 Чемпион памяти', description: 'Выиграть 5 раз в мемори', icon: '🧠', game: 'memory', wins: 5 },
  puzzle_solver: { id: 'puzzle_solver', title: '🧩 Мастер пазлов', description: 'Выиграть 3 раза в пазле', icon: '🧩', game: 'puzzle', wins: 3 },
  riddle_master: { id: 'riddle_master', title: '❓ Мудрец', description: 'Выиграть 5 раз в загадках', icon: '❓', game: 'riddles', wins: 5 },
  quest_hero: { id: 'quest_hero', title: '🗺️ Герой квестов', description: 'Выиграть 3 раза в квесте', icon: '🗺️', game: 'quest', wins: 3 },
  maze_runner: { id: 'maze_runner', title: '🌀 Бегущий в лабиринте', description: 'Выиграть 3 раза в лабиринте', icon: '🌀', game: 'maze', wins: 3 },
  quiz_genius: { id: 'quiz_genius', title: '❓ Эрудит', description: 'Выиграть 5 раз в викторине', icon: '❓', game: 'quiz', wins: 5 },
  runner_star: { id: 'runner_star', title: '🐱 Звёздный бегун', description: 'Выиграть 3 раза в бегуне', icon: '🐱', game: 'runner', wins: 3 },
  artist: { id: 'artist', title: '🎨 Художник', description: 'Выиграть 3 раза в рисовалке', icon: '🎨', game: 'drawAi', wins: 3 },
  music_master: { id: 'music_master', title: '🎵 DJ Мастер', description: 'Выиграть 3 раза у DJ Люцика', icon: '🎵', game: 'musicCat', wins: 3 },
  stargazer: { id: 'stargazer', title: '🌟 Звездочёт', description: 'Выиграть 3 раза в созвездиях', icon: '🌟', game: 'constellation', wins: 3 },
  brave_child: { id: 'brave_child', title: '🫧 Храбрец', description: 'Справиться со страхами 3 раза', icon: '🫧', game: 'popFears', wins: 3 },
  emotion_master: { id: 'emotion_master', title: '😊 Мастер эмоций', description: 'Угадать эмоции', icon: '😊', threshold: 1, stat: 'emotionWins' },
  game_master: { id: 'game_master', title: '🎮 Любитель игр', description: 'Сыграть в 5 игр', icon: '🎮', threshold: 5, stat: 'totalGames' }
};

let unlockedAchievements = new Set();

function loadAchievements() {
  try {
    const saved = localStorage.getItem('unlockedAchievements');
    if (saved) unlockedAchievements = new Set(JSON.parse(saved));
  } catch (e) { /* ignore */ }
}

function saveAchievements() {
  try {
    localStorage.setItem('unlockedAchievements', JSON.stringify([...unlockedAchievements]));
  } catch (e) { /* ignore */ }
}

function getStatsKey() {
  const name = getActiveChildName();
  return name === 'Гость' ? 'stats_guest' : `stats_${name}`;
}

function getCurrentStats() {
  return safeParseJSON(localStorage.getItem(getStatsKey()), null) || {
    totalStories: 0,
    totalGames: 0,
    fishScore: 0,
    memoryWins: 0,
    puzzleWins: 0,
    emotionWins: 0,
    drawings: 0,
    fearStats: { ...CONFIG.DEFAULT_FEAR_STATS }
  };
}

export function showAchievement(achievementId, customMessage = null) {
  if (unlockedAchievements.has(achievementId)) return;

  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement && !customMessage) return;

  unlockedAchievements.add(achievementId);
  saveAchievements();

  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white; padding: 15px 20px; border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 10000;
    display: flex; align-items: center; gap: 12px; max-width: 300px;
    animation: slideIn 0.5s ease; font-family: inherit;
  `;
  notification.innerHTML = `
    <span style="font-size:32px;">${achievement?.icon || '🏆'}</span>
    <div>
      <div style="font-weight:bold;margin-bottom:4px;">${customMessage || achievement?.title || 'Достижение!'}</div>
      ${achievement?.description ? `<div style="font-size:12px;opacity:0.9;">${achievement.description}</div>` : ''}
    </div>
  `;

  if (!document.querySelector('#achievements-styles')) {
    const style = document.createElement('style');
    style.id = 'achievements-styles';
    style.textContent = '@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.5s ease reverse';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

export function updateAchievement(achievementId) {
  const gameStats = {
    memory_champion: 'memoryWins',
    puzzle_solver: 'puzzleWins',
    emotion_master: 'emotionWins',
    artist: 'drawings',
    fish_master: 'fishScore',
    riddle_master: 'emotionWins'
  };
  const statKey = gameStats[achievementId];
  if (statKey) {
    const stats = getCurrentStats();
    stats[statKey] = (stats[statKey] || 0) + 1;
    localStorage.setItem(getStatsKey(), JSON.stringify(stats));
  }
  checkProgressAchievements();
}

export function checkProgressAchievements() {
  const progress = loadGameProgress(getActiveChildName());
  for (const ach of Object.values(ACHIEVEMENTS)) {
    if (unlockedAchievements.has(ach.id)) continue;
    if (ach.game && ach.wins) {
      const wins = progress[ach.game]?.wins || 0;
      if (wins >= ach.wins) showAchievement(ach.id);
    }
  }
}

export function checkAchievements() {
  const stats = getCurrentStats();

  for (const ach of Object.values(ACHIEVEMENTS)) {
    if (unlockedAchievements.has(ach.id)) continue;
    if (ach.stat) {
      const value = stats[ach.stat] || 0;
      if (value >= ach.threshold) showAchievement(ach.id);
    }
  }
  checkProgressAchievements();
}

loadAchievements();

export function getAllAchievements() {
  return Object.values(ACHIEVEMENTS).map((a) => ({
    ...a,
    unlocked: unlockedAchievements.has(a.id)
  }));
}

export function getAchievementStats() {
  const total = Object.keys(ACHIEVEMENTS).length;
  const unlocked = unlockedAchievements.size;
  return { total, unlocked, percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0 };
}

export default { showAchievement, updateAchievement, checkAchievements, checkProgressAchievements, getAllAchievements, getAchievementStats };
