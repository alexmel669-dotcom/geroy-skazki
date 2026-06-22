// ========================================
// achievements.js — СИСТЕМА ДОСТИЖЕНИЙ
// ========================================

import { CONFIG } from './config.js';
import { getActiveChildName, safeParseJSON } from './core.js';

const ACHIEVEMENTS = {
    first_story: { id: 'first_story', title: '📖 Первая сказка', description: 'Послушать первую сказку', icon: '🌟', threshold: 1, stat: 'totalStories' },
    story_master: { id: 'story_master', title: '🎭 Мастер сказок', description: 'Послушать 10 сказок', icon: '👑', threshold: 10, stat: 'totalStories' },
    fish_master: { id: 'fish_master', title: '🎣 Мастер рыбалки', description: 'Сыграть в рыбалку', icon: '🐟', threshold: 1, stat: 'totalGames' },
    memory_champion: { id: 'memory_champion', title: '🧠 Чемпион памяти', description: 'Пройти игру «Мемори»', icon: '🧠', threshold: 1, stat: 'memoryWins' },
    puzzle_solver: { id: 'puzzle_solver', title: '🧩 Собиратель пазлов', description: 'Собрать пазл', icon: '🧩', threshold: 1, stat: 'puzzleWins' },
    emotion_master: { id: 'emotion_master', title: '😊 Мастер эмоций', description: 'Угадать все эмоции', icon: '😊', threshold: 1, stat: 'emotionWins' },
    artist: { id: 'artist', title: '🎨 Художник', description: 'Нарисовать рисунок', icon: '🎨', threshold: 1, stat: 'drawings' },
    brave_child: { id: 'brave_child', title: '🦁 Храбрый ребёнок', description: 'Обсудить 5 страхов', icon: '🦁', threshold: 5, stat: 'fears' },
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
    localStorage.setItem('unlockedAchievements', JSON.stringify([...unlockedAchievements]));
}

function getStatsKey() {
    const name = getActiveChildName();
    return name === 'Гость' ? 'stats_guest' : `stats_${name}`;
}

function getCurrentStats() {
    return safeParseJSON(localStorage.getItem(getStatsKey()), null) || {
        totalStories: 0,
        totalGames: 0,
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
    `;
    notification.innerHTML = `
        <span style="font-size:32px;">${achievement?.icon || '🏆'}</span>
        <div>
            <div style="font-weight:bold;">${customMessage || achievement?.title || 'Достижение!'}</div>
            ${achievement?.description ? `<div style="font-size:12px;opacity:0.9;">${achievement.description}</div>` : ''}
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

export function updateAchievement(achievementId) {
    const gameStats = { memory_champion: 'memoryWins', puzzle_solver: 'puzzleWins', emotion_master: 'emotionWins', artist: 'drawings' };
    const statKey = gameStats[achievementId];
    if (statKey) {
        const stats = getCurrentStats();
        stats[statKey] = (stats[statKey] || 0) + 1;
        localStorage.setItem(getStatsKey(), JSON.stringify(stats));
    }
    showAchievement(achievementId);
}

export function checkAchievements() {
    const stats = getCurrentStats();
    const totalFears = Object.values(stats.fearStats || {}).reduce((a, b) => a + b, 0);

    for (const ach of Object.values(ACHIEVEMENTS)) {
        if (unlockedAchievements.has(ach.id)) continue;

        let value = 0;
        if (ach.stat === 'fears') value = totalFears;
        else value = stats[ach.stat] || 0;

        if (value >= ach.threshold) showAchievement(ach.id);
    }
}

loadAchievements();

export function getAllAchievements() {
    return Object.values(ACHIEVEMENTS).map(a => ({
        ...a,
        unlocked: unlockedAchievements.has(a.id)
    }));
}

export default { showAchievement, updateAchievement, checkAchievements, getAllAchievements };
