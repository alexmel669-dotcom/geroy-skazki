// ========================================
// core.js — ЯДРО ПРИЛОЖЕНИЯ (состояние и данные)
// ========================================

import { CONFIG, CHARACTERS, migrateFearStatsObject } from './config.js';
import { setCharacter } from './ai.js';

export function safeParseJSON(raw, fallback) {
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function getChildren() {
    return safeParseJSON(localStorage.getItem('children') || '[]', []);
}

export const appState = {
    gameActive: false,
    currentChildIndex: -1,
    hunger: 60,
    fishScore: 0,
    memoryCards: [],
    memoryFlipped: [],
    memoryMatches: 0,
    memoryLocked: false
};

let activeChildIndex = -1;
const characterIds = Object.keys(CHARACTERS);
let characterCycleIndex = 0;

export function getActiveChildIndex() {
    const saved = localStorage.getItem('activeChildIndex');
    if (saved !== null) return parseInt(saved, 10);
    return -1;
}

export function getActiveChildName() {
    const children = getChildren();
    const child = children[activeChildIndex];
    return child ? child.name : 'Гость';
}

export function getActiveChild() {
    const children = getChildren();
    return children[activeChildIndex] || null;
}

function updateCharacterAvatar() {
    const avatar = document.getElementById('avatar');
    if (!avatar) return;
    const savedChar = localStorage.getItem('currentCharacter') || 'lucik';
    const char = CHARACTERS[savedChar] || CHARACTERS.lucik;
    avatar.style.backgroundImage = `url('${char.icon}')`;
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
}

export function setActiveChild(index) {
    activeChildIndex = index;
    appState.currentChildIndex = index;
    localStorage.setItem('activeChildIndex', String(index));

    const children = getChildren();
    const child = children[index];
    const nameLabel = document.getElementById('childNameLabel');

    if (child) {
        if (nameLabel) nameLabel.textContent = `${child.name}, ${child.age} лет`;
    } else {
        if (nameLabel) nameLabel.textContent = 'Гость';
    }

    updateCharacterAvatar();
}

export function selectGuestMode() {
    const modal = document.getElementById('childSelectModal');
    if (modal) modal.style.display = 'none';
    setActiveChild(-1);
}

export function showChildSelectModal() {
    const children = getChildren();
    if (children.length <= 1) {
        if (children.length === 1) setActiveChild(0);
        return;
    }

    const modal = document.getElementById('childSelectModal');
    const list = document.getElementById('childSelectList');
    if (!modal || !list) return;

    list.innerHTML = children.map((child, i) => {
        const emoji = child.avatarRole === 'kid1' ? '👦' : (child.avatarRole === 'kid2' ? '👧' : '🐱');
        return `
      <button class="modal-btn" style="width:100%; text-align:left; display:flex; align-items:center; gap:12px;" id="childSelect${i}">
        <span style="font-size:1.5rem;">${emoji}</span>
        <span>${child.name}, ${child.age} лет</span>
      </button>
    `;
    }).join('');

    modal.style.display = 'flex';

    children.forEach((child, i) => {
        const btn = document.getElementById(`childSelect${i}`);
        if (btn) {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
                setActiveChild(i);
            });
        }
    });
}

export function checkChildSelection() {
    activeChildIndex = getActiveChildIndex();
    appState.currentChildIndex = activeChildIndex;
    const children = getChildren();

    if (children.length > 1 && activeChildIndex === -1) {
        showChildSelectModal();
    } else if (children.length === 1 && activeChildIndex === -1) {
        setActiveChild(0);
    } else if (activeChildIndex >= children.length) {
        setActiveChild(-1);
    } else if (activeChildIndex >= 0) {
        setActiveChild(activeChildIndex);
    }
}

function getStatsKey() {
    const children = getChildren();
    const child = children[activeChildIndex];
    return child ? `stats_${child.name}` : 'stats_guest';
}

function migrateFearStats(stats) {
    if (!stats?.fearStats) return stats;
    stats.fearStats = migrateFearStatsObject(stats.fearStats);
    return stats;
}

function migrateAllStoredStats() {
    const keys = ['stats_guest'];
    try {
        getChildren().forEach(c => keys.push(`stats_${c.name}`));
    } catch { /* ignore */ }

    keys.forEach(key => {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const stats = safeParseJSON(raw, null);
        if (!stats?.fearStats) return;
        const migrated = migrateFearStatsObject(stats.fearStats);
        if (JSON.stringify(migrated) !== JSON.stringify(stats.fearStats)) {
            stats.fearStats = migrated;
            localStorage.setItem(key, JSON.stringify(stats));
        }
    });

    const globalFears = safeParseJSON(localStorage.getItem('fearStats') || '{}', {});
    const migratedGlobal = migrateFearStatsObject(globalFears);
    if (JSON.stringify(migratedGlobal) !== JSON.stringify(globalFears)) {
        localStorage.setItem('fearStats', JSON.stringify(migratedGlobal));
    }
}
function loadStats() {
    const key = getStatsKey();
    const stats = safeParseJSON(localStorage.getItem(key), null);
    if (!stats) return null;
    return migrateFearStats(stats);
}

function createEmptyStats() {
    return {
        totalStories: 0,
        totalGames: 0,
        history: [],
        fearStats: { ...CONFIG.DEFAULT_FEAR_STATS },
        lastActive: new Date().toISOString()
    };
}

export function saveToChildHistory(entry) {
    const key = getStatsKey();
    let stats = safeParseJSON(localStorage.getItem(key), null);
    if (!stats) stats = createEmptyStats();

    stats.history.push(entry);
    if (stats.history.length > CONFIG.MAX_HISTORY) {
        stats.history = stats.history.slice(-CONFIG.MAX_HISTORY);
    }
    stats.lastActive = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(stats));

    const globalHistory = safeParseJSON(localStorage.getItem('history') || '[]', []);
    globalHistory.push(entry);
    localStorage.setItem(
        'history',
        JSON.stringify(globalHistory.slice(-CONFIG.MAX_HISTORY))
    );
}

export function updateFearStats(fears) {
    if (!fears || fears.length === 0) return;

    const key = getStatsKey();
    let stats = safeParseJSON(localStorage.getItem(key), null);
    if (!stats) stats = createEmptyStats();

    fears.forEach(fear => {
        if (stats.fearStats[fear] !== undefined) {
            stats.fearStats[fear]++;
        }
    });
    localStorage.setItem(key, JSON.stringify(stats));

    const globalFears = safeParseJSON(localStorage.getItem('fearStats') || '{}', {});
    fears.forEach(fear => {
        globalFears[fear] = (globalFears[fear] || 0) + 1;
    });
    localStorage.setItem('fearStats', JSON.stringify(globalFears));
}

export function incrementStories() {
    const key = getStatsKey();
    let stats = safeParseJSON(localStorage.getItem(key), null);
    if (!stats) stats = createEmptyStats();
    stats.totalStories = (stats.totalStories || 0) + 1;
    localStorage.setItem(key, JSON.stringify(stats));

    const globalTotal = parseInt(localStorage.getItem('totalStories') || '0', 10) + 1;
    localStorage.setItem('totalStories', String(globalTotal));
}

export function incrementGames() {
    const key = getStatsKey();
    let stats = safeParseJSON(localStorage.getItem(key), null);
    if (!stats) stats = createEmptyStats();
    stats.totalGames = (stats.totalGames || 0) + 1;
    localStorage.setItem(key, JSON.stringify(stats));

    const globalTotal = parseInt(localStorage.getItem('totalGames') || '0', 10) + 1;
    localStorage.setItem('totalGames', String(globalTotal));
}

export function updateStatsUI() {
    const stats = loadStats() || safeParseJSON(localStorage.getItem(getStatsKey()), null);

    const moodFill = document.getElementById('moodFill');
    const hungerFill = document.getElementById('hungerFill');
    const energyFill = document.getElementById('energyFill');
    const braveryFill = document.getElementById('braveryFill');

    if (!moodFill || !hungerFill || !energyFill || !braveryFill) return;

    if (stats) {
        moodFill.style.width = '70%';
        hungerFill.style.width = `${Math.min(100, appState.hunger || 60)}%`;
        energyFill.style.width = '50%';
        const bravery = Math.min(100, (stats.totalStories || 0) * 10);
        braveryFill.style.width = bravery + '%';
    }
}

export function loadState() {
    const savedChar = localStorage.getItem('currentCharacter') || 'lucik';
    setCharacter(savedChar);

    const idx = characterIds.indexOf(savedChar);
    characterCycleIndex = idx >= 0 ? idx : 0;

    updateCharacterAvatar();
}

export function cycleCharacter(direction = 1) {
    characterCycleIndex = (characterCycleIndex + direction + characterIds.length) % characterIds.length;
    const charId = characterIds[characterCycleIndex];

    setCharacter(charId);
    localStorage.setItem('currentCharacter', charId);
    updateCharacterAvatar();

    const avatar = document.getElementById('avatar');
    if (avatar) {
        avatar.style.transform = 'scale(0.9)';
        setTimeout(() => { avatar.style.transform = 'scale(1)'; }, 150);
    }

    return charId;
}

export function saveChildData(childIndex) {
    const children = getChildren();
    const child = children[childIndex];
    const key = child ? `stats_${child.name}` : 'stats_guest';
    let stats = safeParseJSON(localStorage.getItem(key), null);
    if (!stats) stats = createEmptyStats();
    stats.lastActive = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(stats));
}

export function initCore() {
    migrateAllStoredStats();
    activeChildIndex = getActiveChildIndex();
    appState.currentChildIndex = activeChildIndex;
    loadState();
    checkChildSelection();
    updateStatsUI();
}

export default {
    appState,
    initCore,
    getChildren,
    getActiveChildIndex,
    getActiveChildName,
    getActiveChild,
    setActiveChild,
    selectGuestMode,
    showChildSelectModal,
    checkChildSelection,
    saveToChildHistory,
    updateFearStats,
    incrementStories,
    incrementGames,
    updateStatsUI,
    loadState,
    cycleCharacter,
    saveChildData
};
