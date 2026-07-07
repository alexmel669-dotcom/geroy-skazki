/**
 * Сложность игр по уровню и возрасту ребёнка.
 */

import { getActiveChild } from '../core.js';

export function getChildAgeForGames() {
  const child = getActiveChild();
  return child?.age || parseInt(localStorage.getItem('profileChildAge') || '7', 10) || 7;
}

export function ageBand(age) {
  if (age <= 4) return 'young';
  if (age <= 6) return 'mid';
  return 'old';
}

export function getFishConfig(level) {
  const age = getChildAgeForGames();
  const band = ageBand(age);
  const lv = Math.max(1, level);
  const baseFish = 8 + (lv - 1) * 3;
  const baseTime = Math.max(12, 35 - (lv - 1) * 2);
  let fishSize = Math.max(28, 56 - (lv - 1) * 3);
  let speed = Math.max(500, 1600 - (lv - 1) * 120);
  if (band === 'young') { fishSize += 10; speed += 400; }
  if (band === 'old') { speed -= 200; }
  return {
    fishCount: Math.min(40, baseFish),
    time: baseTime,
    fishSize,
    speed
  };
}

export function getMemoryPairs(level) {
  const age = getChildAgeForGames();
  const band = ageBand(age);
  let pairs = 3 + level;
  if (band === 'young') pairs = Math.min(pairs, 4 + Math.floor(level / 2));
  if (band === 'mid') pairs = Math.min(pairs, 6 + Math.floor(level / 2));
  return Math.min(16, Math.max(3, pairs));
}

export function getPuzzleGrid(age, level) {
  const SIZES = [3, 4, 6];
  const childAge = age ?? getChildAgeForGames();
  const lv = Math.max(1, Math.min(level || 1, SIZES.length));
  let size = SIZES[lv - 1] || 3;
  if (childAge <= 4) size = Math.min(size, 3);
  if (childAge <= 6 && size > 4) size = 4;
  return size;
}

export function getRiddlesConfig(level) {
  const total = Math.min(20, 2 + level * 2);
  const hintsLeft = Math.max(0, 4 - Math.floor(level / 2));
  const needToWin = Math.max(2, total - Math.floor(level / 3));
  return { total, hintsLeft, needToWin };
}

export function getQuestMaxMoves(level) {
  return Math.max(6, 14 - Math.floor(level / 2));
}

export default {
  getChildAgeForGames, ageBand, getFishConfig, getMemoryPairs,
  getPuzzleGrid, getRiddlesConfig, getQuestMaxMoves
};
