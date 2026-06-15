// ========================================
// achievements.js — СИСТЕМА ДОСТИЖЕНИЙ
// ========================================

const ACHIEVEMENTS = {
    first_story: { id: 'first_story', title: '📖 Первая сказка', description: 'Послушать первую сказку', icon: '🌟' },
    story_master: { id: 'story_master', title: '🎭 Мастер сказок', description: 'Послушать 10 сказок', icon: '👑' },
    fish_master: { id: 'fish_master', title: '🎣 Мастер рыбалки', description: 'Поймать 10 рыб', icon: '🐟' },
    brave_child: { id: 'brave_child', title: '🦁 Храбрый ребенок', description: 'Победить 5 страхов', icon: '🦁' },
    game_master: { id: 'game_master', title: '🎮 Любитель игр', description: 'Сыграть в 5 игр', icon: '🎮' }
};

let unlockedAchievements = new Set();

function loadAchievements() {
    try {
        const saved = localStorage.getItem('unlockedAchievements');
        if (saved) {
            const arr = JSON.parse(saved);
            unlockedAchievements = new Set(arr);
        }
    } catch(e) {}
}

function saveAchievements() {
    try {
        const arr = Array.from(unlockedAchievements);
        localStorage.setItem('unlockedAchievements', JSON.stringify(arr));
    } catch(e) {}
}

export function showAchievement(achievementId, customMessage = null) {
    if (unlockedAchievements.has(achievementId)) return;
    
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement && !customMessage) return;
    
    unlockedAchievements.add(achievementId);
    saveAchievements();
    
    const notification = document.createElement('div');
    const icon = achievement?.icon || '🏆';
    const title = customMessage || achievement?.title || 'Достижение получено!';
    const desc = achievement?.description || '';
    
    notification.className = 'achievement-notification';
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.5s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: inherit;
        max-width: 300px;
    `;
    
    notification.innerHTML = `
        <span style="font-size: 32px;">${icon}</span>
        <div>
            <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
            ${desc ? `<div style="font-size: 12px; opacity: 0.9;">${desc}</div>` : ''}
        </div>
    `;
    
    // Добавляем стили если их нет
    if (!document.querySelector('#achievements-styles')) {
        const style = document.createElement('style');
        style.id = 'achievements-styles';
        style.textContent = `@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.5s ease reverse';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

export function checkAchievements() {
    console.log('Achievements check called');
}

loadAchievements();

export function getAllAchievements() {
    const all = [];
    for (let id in ACHIEVEMENTS) {
        all.push({ ...ACHIEVEMENTS[id], unlocked: unlockedAchievements.has(id) });
    }
    return all;
}

export function getAchievementStats() {
    const total = Object.keys(ACHIEVEMENTS).length;
    const unlocked = unlockedAchievements.size;
    return { total, unlocked, percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0 };
}

export default { showAchievement, checkAchievements, getAllAchievements, getAchievementStats };
