// ========================================
// game-progress.js — ПРОГРЕСС ИГР ПО РЕБЁНКУ
// ========================================

const DEFAULT_PROGRESS = {
  fish: { bestScore: 0, bestLevel: 1, level: 1, wins: 0 },
  memory: { pairsCollected: 0, wins: 0, level: 1 },
  puzzle: { levelsCompleted: 0, level: 1 },
  riddles: { completed: 0, level: 1, wins: 0 },
  quest: { completed: 0, level: 1 },
  maze: { level: 1, wins: 0 },
  quiz: { level: 1, wins: 0 },
  emotion: { completed: false, bestScore: 0, level: 1 },
  coloring: { completed: false, level: 1 }
};

export function getGameProgressKey(childName) {
  const safe = (childName || 'guest').replace(/[^\w\u0400-\u04FF-]/gi, '_').slice(0, 40);
  return `gameProgress_${safe}`;
}

export function loadGameProgress(childName) {
  const key = getGameProgressKey(childName === 'Гость' ? 'guest' : childName);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...DEFAULT_PROGRESS, fish: { ...DEFAULT_PROGRESS.fish } };
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveGameProgress(progress, childName) {
  const name = childName ?? getActiveChildName();
  const key = getGameProgressKey(name === 'Гость' ? 'guest' : name);
  localStorage.setItem(key, JSON.stringify(progress));
}

export function updateGameProgress(patch, childName = 'guest') {
  const current = loadGameProgress(childName);
  const next = { ...current, ...patch };
  saveGameProgress(next, childName);
  return next;
}

export function recordFishResult(score, level, childName = 'guest') {
  const p = loadGameProgress(childName);
  if (score > (p.fish.bestScore || 0)) p.fish.bestScore = score;
  if (level > (p.fish.bestLevel || 1)) p.fish.bestLevel = level;
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
  return [
    { id: 'fish', label: '🎣 Рыбалка', value: p.fish.level || 1, max: 5, detail: `ур. ${p.fish.level || 1}, счёт ${p.fish.bestScore}` },
    { id: 'memory', label: '🧠 Мемори', value: p.memory.level || 1, max: 5, detail: `ур. ${p.memory.level || 1}, побед: ${p.memory.wins || 0}` },
    { id: 'puzzle', label: '🧩 Пазл', value: p.puzzle.level || 1, max: 5, detail: `ур. ${p.puzzle.level || 1}` },
    { id: 'riddles', label: '❓ Загадки', value: p.riddles.level || 1, max: 5, detail: `ур. ${p.riddles.level || 1}` },
    { id: 'quest', label: '🗺️ Квест', value: p.quest.level || 1, max: 5, detail: `ур. ${p.quest.level || 1}` },
    { id: 'maze', label: '🌀 Лабиринт', value: p.maze.level || 1, max: 5, detail: `ур. ${p.maze.level || 1}` },
    { id: 'quiz', label: '❓ Викторина', value: p.quiz.level || 1, max: 5, detail: `ур. ${p.quiz.level || 1}` }
  ];
}

export default {
  loadGameProgress, saveGameProgress, updateGameProgress,
  recordFishResult, recordMemoryWin, recordPuzzleWin,
  recordEmotionComplete, recordColoringComplete, getGameProgressSummary
};
