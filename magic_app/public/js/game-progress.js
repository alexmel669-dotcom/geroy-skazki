// ========================================
// game-progress.js — ПРОГРЕСС ИГР ПО РЕБЁНКУ
// ========================================

const DEFAULT_PROGRESS = {
  fish: { bestScore: 0, bestLevel: 1 },
  memory: { pairsCollected: 0, wins: 0 },
  puzzle: { levelsCompleted: 0 },
  emotion: { completed: false, bestScore: 0 },
  coloring: { completed: false }
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
    { id: 'fish', label: '🎣 Рыбалка', value: p.fish.bestScore, max: 30, detail: `лучший счёт: ${p.fish.bestScore}` },
    { id: 'memory', label: '🧠 Мемори', value: p.memory.pairsCollected, max: 8, detail: `побед: ${p.memory.wins}` },
    { id: 'puzzle', label: '🧩 Пазл', value: p.puzzle.levelsCompleted, max: 5, detail: `уровней: ${p.puzzle.levelsCompleted}` },
    { id: 'riddles', label: '❓ Загадки', value: p.emotion.completed ? 5 : p.emotion.bestScore, max: 5, detail: p.emotion.completed ? 'пройдено' : `очков: ${p.emotion.bestScore}` },
    { id: 'quest', label: '🗺️ Квест', value: p.coloring.completed ? 1 : 0, max: 1, detail: p.coloring.completed ? 'готово' : 'не завершено' }
  ];
}

export default {
  loadGameProgress, saveGameProgress, updateGameProgress,
  recordFishResult, recordMemoryWin, recordPuzzleWin,
  recordEmotionComplete, recordColoringComplete, getGameProgressSummary
};
