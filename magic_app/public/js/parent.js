// Родительский кабинет — см. parent-dashboard.js (подключается из parent.html)
import { CONFIG } from './config.js';

function getChildren() {
  return JSON.parse(localStorage.getItem('children') || '[]');
}

function getChildStats(index) {
  const children = getChildren();
  const child = children[index];
  const key = child ? `stats_${child.name}` : 'stats_guest';
  const data = JSON.parse(localStorage.getItem(key) || 'null');
  if (data) return data;
  return {
    totalStories: parseInt(localStorage.getItem('totalStories') || '0', 10),
    totalGames: parseInt(localStorage.getItem('totalGames') || '0', 10),
    history: JSON.parse(localStorage.getItem('history') || '[]'),
    fearStats: { ...CONFIG.DEFAULT_FEAR_STATS },
    lastActive: new Date().toISOString()
  };
}

export { getChildren, getChildStats };
