import { showNotification } from './ui.js';

export function checkDailyStreak() {
  const today = new Date().toISOString().split('T')[0];
  const streak = JSON.parse(localStorage.getItem('geroy-streak') || '{}');

  if (streak.lastDate === today) return streak;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (streak.lastDate === yesterday) {
    streak.count = (streak.count || 0) + 1;
  } else {
    streak.count = 1;
  }

  streak.lastDate = today;
  streak.stars = (streak.stars || 0) + 1;

  if (streak.count === 3) streak.badge3 = true;
  if (streak.count === 7) streak.badge7 = true;
  if (streak.count === 30) streak.badge30 = true;

  localStorage.setItem('geroy-streak', JSON.stringify(streak));
  localStorage.setItem('geroy-last-visit', new Date().toISOString());

  if (streak.badge7 && !streak.badge7Shown) {
    showBadge('🌟', 'Неделя с Люциком!');
    streak.badge7Shown = true;
    localStorage.setItem('geroy-streak', JSON.stringify(streak));
  }

  return streak;
}

export function updateStreakUI() {
  const streak = JSON.parse(localStorage.getItem('geroy-streak') || '{}');
  const starEl = document.getElementById('starCount');
  const dayEl = document.getElementById('streakDays');
  if (starEl) starEl.textContent = streak.stars || 0;
  if (dayEl) dayEl.textContent = streak.count || 0;
}

export function showBadge(icon, message) {
  showNotification(`${icon} ${message}`, 'success');
}

export default { checkDailyStreak, updateStreakUI, showBadge };
