// ========================================
// game-progress.js — ПРОГРЕСС ИГР ПО РЕБЁНКУ
// ========================================

export const GAME_PROGRESS_KEYS = [
  'fish', 'memory', 'puzzle', 'riddles', 'quest', 'maze',
  'quiz', 'runner', 'drawAi', 'musicCat', 'constellation', 'popFears'
];

const GAME_LABELS = {
  fish: { label: 'Рыбалка', icon: '🎣' },
  memory: { label: 'Мемори', icon: '🧠' },
  puzzle: { label: 'Пазл', icon: '🧩' },
  riddles: { label: 'Загадки', icon: '❓' },
  quest: { label: 'Квест', icon: '🗺️' },
  maze: { label: 'Лабиринт', icon: '🌀' },
  quiz: { label: 'Викторина', icon: '❓' },
  runner: { label: 'Бегун', icon: '🐱' },
  drawAi: { label: 'Рисовалка', icon: '🎨' },
  musicCat: { label: 'DJ Люцик', icon: '🎵' },
  constellation: { label: 'Созвездия', icon: '🌟' },
  popFears: { label: 'Лопни страхи', icon: '🫧' }
};

function resolveProgressChildName(childName) {
  if (childName != null && childName !== '') return childName;
  if (typeof globalThis !== 'undefined' && typeof globalThis.getActiveChildName === 'function') {
    return globalThis.getActiveChildName();
  }
  return 'guest';
}

function hasColoringProgress(coloring) {
  return Boolean(coloring?.completed || (coloring?.level || 1) > 1);
}

function hasEmotionProgress(emotion) {
  return Boolean(emotion?.completed || (emotion?.bestScore || 0) > 0 || (emotion?.level || 1) > 1);
}

const DEFAULT_GAME_BLOCK = { wins: 0, level: 1 };

const DEFAULT_PROGRESS = {
  fish: { bestScore: 0, bestLevel: 1, level: 1, wins: 0 },
  memory: { pairsCollected: 0, wins: 0, level: 1 },
  puzzle: { levelsCompleted: 0, level: 1, wins: 0 },
  riddles: { completed: 0, level: 1, wins: 0 },
  quest: { completed: 0, level: 1, wins: 0 },
  maze: { level: 1, wins: 0 },
  quiz: { level: 1, wins: 0 },
  runner: { level: 1, wins: 0 },
  drawAi: { level: 1, wins: 0 },
  musicCat: { level: 1, wins: 0 },
  constellation: { level: 1, wins: 0 },
  popFears: { level: 1, wins: 0 },
  emotion: { completed: false, bestScore: 0, level: 1 },
  coloring: { completed: false, level: 1 }
};

function makeDefaultProgress() {
  const p = {};
  Object.entries(DEFAULT_PROGRESS).forEach(([k, v]) => { p[k] = { ...v }; });
  return p;
}

export function getGameProgressKey(childName) {
  const safe = (childName || 'guest').replace(/[^\w\u0400-\u04FF-]/gi, '_').slice(0, 40);
  return `gameProgress_${safe}`;
}

function mergeProgressBlock(defaults, patch) {
  return { ...defaults, ...(patch && typeof patch === 'object' ? patch : {}) };
}

export function loadGameProgress(childName) {
  const key = getGameProgressKey(childName === 'Гость' ? 'guest' : childName);
  const defaults = makeDefaultProgress();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const merged = {};
    Object.keys(defaults).forEach((gameId) => {
      merged[gameId] = mergeProgressBlock(defaults[gameId], parsed[gameId]);
    });
    return merged;
  } catch {
    return defaults;
  }
}

export function saveGameProgress(progress, childName) {
  const name = resolveProgressChildName(childName);
  const key = getGameProgressKey(name === 'Гость' ? 'guest' : name);
  localStorage.setItem(key, JSON.stringify(progress));
}

export function updateGameProgress(patch, childName = 'guest') {
  const current = loadGameProgress(childName);
  const next = { ...current, ...patch };
  saveGameProgress(next, childName);
  return next;
}

export function recordGameResult(gameId, won, level, childName) {
  const name = resolveProgressChildName(childName);
  const p = loadGameProgress(name);
  const block = { ...(p[gameId] || { ...DEFAULT_GAME_BLOCK }) };
  if (won) {
    block.wins = (block.wins || 0) + 1;
    block.level = Math.max(block.level || 1, (level || 1) + 1);
    block.lastLevel = level || 1;
  }
  p[gameId] = block;
  saveGameProgress(p, name);
  return block;
}

export function recordFishResult(score, level, childName = 'guest') {
  const p = loadGameProgress(childName);
  const playedLevel = level || 1;
  p.fish.bestScore = Math.max(p.fish.bestScore || 0, score);
  p.fish.bestLevel = Math.max(p.fish.bestLevel || 1, playedLevel);
  p.fish.level = Math.max(p.fish.level || 1, p.fish.bestLevel);
  saveGameProgress(p, childName);
  return p.fish;
}

export function recordMemoryWin(pairs, childName = 'guest') {
  const p = loadGameProgress(childName);
  p.memory.wins = (p.memory.wins || 0) + 1;
  p.memory.pairsCollected = Math.max(p.memory.pairsCollected || 0, pairs);
  saveGameProgress(p, childName);
  return p.memory;
}

export function recordPuzzleWin(childName = 'guest') {
  const p = loadGameProgress(childName);
  p.puzzle.levelsCompleted = (p.puzzle.levelsCompleted || 0) + 1;
  p.puzzle.wins = (p.puzzle.wins || 0) + 1;
  saveGameProgress(p, childName);
  return p.puzzle;
}

export function recordEmotionComplete(score, childName = 'guest') {
  const p = loadGameProgress(childName);
  p.emotion.completed = true;
  p.emotion.bestScore = Math.max(p.emotion.bestScore || 0, score);
  saveGameProgress(p, childName);
  return p.emotion;
}

export function recordColoringComplete(childName = 'guest') {
  const p = loadGameProgress(childName);
  p.coloring.completed = true;
  saveGameProgress(p, childName);
  return p.coloring;
}

export function getGameProgressSummary(childName) {
  const p = loadGameProgress(childName);
  const coloringStarted = hasColoringProgress(p.coloring);
  const emotionStarted = hasEmotionProgress(p.emotion);

  const mainGames = GAME_PROGRESS_KEYS.map((id) => {
    const meta = GAME_LABELS[id] || { label: id, icon: '🎮' };
    const block = p[id] || DEFAULT_GAME_BLOCK;
    const lvl = block.level || 1;
    const wins = block.wins || 0;
    return {
      id,
      label: `${meta.icon} ${meta.label}`,
      value: lvl,
      max: 20,
      detail: `ур. ${lvl} | 🏆 ${wins}`
    };
  });

  const legacy = [
    { id: 'emotion', label: '😊 Эмоции', value: emotionStarted ? (p.emotion.level || 1) : 0, max: 10, detail: p.emotion.completed ? 'пройдено' : emotionStarted ? 'в процессе' : 'не начато' },
    { id: 'coloring', label: '🖍️ Раскраска', value: coloringStarted ? (p.coloring.level || 1) : 0, max: 20, detail: p.coloring.completed ? 'есть работы' : coloringStarted ? 'в процессе' : 'не начато' }
  ];

  return [...mainGames, ...legacy];
}

export default {
  GAME_PROGRESS_KEYS,
  loadGameProgress, saveGameProgress, updateGameProgress,
  recordGameResult,
  recordFishResult, recordMemoryWin, recordPuzzleWin,
  recordEmotionComplete, recordColoringComplete, getGameProgressSummary
};
