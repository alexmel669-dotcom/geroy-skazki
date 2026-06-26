// ========================================
// game-progress.js — ПРОГРЕСС ИГР ПО РЕБЁНКУ
// ========================================

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

function mergeProgressBlock(defaults, patch) {
  return { ...defaults, ...(patch && typeof patch === 'object' ? patch : {}) };
}

export function loadGameProgress(childName) {
  const key = getGameProgressKey(childName === 'Гость' ? 'guest' : childName);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        fish: { ...DEFAULT_PROGRESS.fish },
        memory: { ...DEFAULT_PROGRESS.memory },
        puzzle: { ...DEFAULT_PROGRESS.puzzle },
        riddles: { ...DEFAULT_PROGRESS.riddles },
        quest: { ...DEFAULT_PROGRESS.quest },
        maze: { ...DEFAULT_PROGRESS.maze },
        quiz: { ...DEFAULT_PROGRESS.quiz },
        emotion: { ...DEFAULT_PROGRESS.emotion },
        coloring: { ...DEFAULT_PROGRESS.coloring }
      };
    }
    const parsed = JSON.parse(raw);
    return {
      fish: mergeProgressBlock(DEFAULT_PROGRESS.fish, parsed.fish),
      memory: mergeProgressBlock(DEFAULT_PROGRESS.memory, parsed.memory),
      puzzle: mergeProgressBlock(DEFAULT_PROGRESS.puzzle, parsed.puzzle),
      riddles: mergeProgressBlock(DEFAULT_PROGRESS.riddles, parsed.riddles),
      quest: mergeProgressBlock(DEFAULT_PROGRESS.quest, parsed.quest),
      maze: mergeProgressBlock(DEFAULT_PROGRESS.maze, parsed.maze),
      quiz: mergeProgressBlock(DEFAULT_PROGRESS.quiz, parsed.quiz),
      emotion: mergeProgressBlock(DEFAULT_PROGRESS.emotion, parsed.emotion),
      coloring: mergeProgressBlock(DEFAULT_PROGRESS.coloring, parsed.coloring)
    };
  } catch {
    return {
      fish: { ...DEFAULT_PROGRESS.fish },
      memory: { ...DEFAULT_PROGRESS.memory },
      puzzle: { ...DEFAULT_PROGRESS.puzzle },
      riddles: { ...DEFAULT_PROGRESS.riddles },
      quest: { ...DEFAULT_PROGRESS.quest },
      maze: { ...DEFAULT_PROGRESS.maze },
      quiz: { ...DEFAULT_PROGRESS.quiz },
      emotion: { ...DEFAULT_PROGRESS.emotion },
      coloring: { ...DEFAULT_PROGRESS.coloring }
    };
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
  return [
    { id: 'fish', label: 'Рыбалка', value: p.fish.level || 1, max: 20, detail: `ур. ${p.fish.level || 1}, счёт ${p.fish.bestScore || 0}` },
    { id: 'memory', label: 'Мемори', value: p.memory.level || 1, max: 20, detail: `ур. ${p.memory.level || 1}, побед: ${p.memory.wins || 0}` },
    { id: 'puzzle', label: 'Пазл', value: p.puzzle.level || 1, max: 20, detail: `ур. ${p.puzzle.level || 1}` },
    { id: 'emotion', label: 'Эмоции', value: emotionStarted ? (p.emotion.level || 1) : 0, max: 10, detail: p.emotion.completed ? 'пройдено' : emotionStarted ? 'в процессе' : 'не начато' },
    { id: 'coloring', label: 'Раскраска', value: coloringStarted ? (p.coloring.level || 1) : 0, max: 20, detail: p.coloring.completed ? 'есть работы' : coloringStarted ? 'в процессе' : 'не начато' },
    { id: 'riddles', label: 'Загадки', value: p.riddles.level || 1, max: 20, detail: `ур. ${p.riddles.level || 1}` },
    { id: 'quest', label: 'Квест', value: p.quest.level || 1, max: 20, detail: `ур. ${p.quest.level || 1}` },
    { id: 'maze', label: 'Лабиринт', value: p.maze.level || 1, max: 20, detail: `ур. ${p.maze.level || 1}` },
    { id: 'quiz', label: 'Викторина', value: p.quiz.level || 1, max: 20, detail: `ур. ${p.quiz.level || 1}` }
  ];
}

export default {
  loadGameProgress, saveGameProgress, updateGameProgress,
  recordFishResult, recordMemoryWin, recordPuzzleWin,
  recordEmotionComplete, recordColoringComplete, getGameProgressSummary
};
