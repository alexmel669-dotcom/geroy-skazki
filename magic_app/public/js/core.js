// ========================================
// core.js — ЯДРО ПРИЛОЖЕНИЯ «ГЕРОЙ СКАЗОК»
// Версия: 4.0.8 FINAL
// ========================================

import { CONFIG, CHARACTERS, validateConfig } from './config.js';
import { generateResponse, detectFear, detectAlertWords, detectPersonalData, setCharacter, getCharacter, addToContext, clearContext } from './ai.js';
import { startRecording, stopRecording, isRecording } from './mic.js';
import { synthesizeSpeech } from './audio.js';
import { checkAchievements, showAchievement } from './achievements.js';
import { trackEvent, logError } from './analytics.js';
import { initSecurity, checkBadWords, sanitizeInput } from './security.js';

// ========================================
// STATE
// ========================================

let activeChildIndex = -1;
let isProcessing = false;
let characterCycleIndex = 0;
const characterIds = Object.keys(CHARACTERS);

export const appState = {
    get activeChildIndex() { return activeChildIndex; },
    set activeChildIndex(v) { activeChildIndex = v; },
    get isProcessing() { return isProcessing; },
    set isProcessing(v) { isProcessing = v; },
    get characterCycleIndex() { return characterCycleIndex; },
    set characterCycleIndex(v) { characterCycleIndex = v; },
    characterIds
};

// ========================================
// COMPATIBILITY EXPORTS
// ========================================

export const getCurrentChild = getActiveChild;
export const getCurrentChildName = getActiveChildName;
export const getCurrentChildIndex = getActiveChildIndex;
export const saveHistory = saveToChildHistory;
export const updateStats = updateStatsDisplay;
export const updateStatsUI = updateStatsDisplay;
export const processVoice = processAudio;

export function saveChildData(data) {
    if (!data) return;
    const stats = getChildStats();
    Object.assign(stats, data);
    saveChildStats(stats);
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export function getChildStatsKey() {
    const child = getActiveChild();
    return child ? `stats_${child.id || child.name}` : 'stats_guest';
}

// ========================================
// INIT
// ========================================

export function initCore() {
    console.log('🔵 initCore started');
    
    if (typeof validateConfig === 'function') validateConfig();
    if (typeof initSecurity === 'function') initSecurity();
    
    initUI();
    initEventListeners();
    loadState();
    checkChildSelection();
    updateStatsDisplay();
    
    console.log(`🟢 Герой Сказок v${CONFIG.APP_VERSION} готов к работе`);
}

// ========================================
// CHILDREN
// ========================================

export function getChildren() {
    try {
        return JSON.parse(localStorage.getItem('children') || '[]');
    } catch (e) {
        console.error(e);
        return [];
    }
}

export function getActiveChildIndex() {
    if (activeChildIndex >= 0) return activeChildIndex;
    const saved = localStorage.getItem('activeChildIndex');
    if (saved !== null) {
        activeChildIndex = parseInt(saved);
        if (Number.isNaN(activeChildIndex)) activeChildIndex = -1;
        return activeChildIndex;
    }
    return -1;
}

export function getActiveChildName() {
    const children = getChildren();
    const child = children[getActiveChildIndex()];
    return child ? child.name : 'Гость';
}

export function getActiveChild() {
    const children = getChildren();
    return children[getActiveChildIndex()] || null;
}

export function setActiveChild(index) {
    activeChildIndex = index;
    localStorage.setItem('activeChildIndex', String(index));
    
    const child = getChildren()[index];
    const label = document.getElementById('childNameLabel');
    if (label) {
        label.textContent = child ? `${child.name}` : 'Гость';
    }
    
    const avatar = document.getElementById('avatar');
    if (avatar && child) {
        const avatarMap = { kid1: '/assets/images/kid1.png', kid2: '/assets/images/kid2.png', lucik: '/assets/images/avatar.png' };
        avatar.style.backgroundImage = `url('${avatarMap[child.avatarRole] || '/assets/images/avatar.png'}')`;
    } else if (avatar) {
        avatar.style.backgroundImage = "url('/assets/images/avatar.png')";
    }
    
    trackEvent('child_select', child?.name || 'guest');
}

function checkChildSelection() {
    const children = getChildren();
    const saved = getActiveChildIndex();
    if (children.length > 1 && saved === -1) {
        showChildSelectModal();
    } else if (children.length === 1 && saved === -1) {
        setActiveChild(0);
    }
}

export function showChildSelectModal() {
    const children = getChildren();
    if (children.length === 0) {
        setActiveChild(-1);
        return;
    }
    
    const modal = document.getElementById('childSelectModal');
    const list = document.getElementById('childSelectList');
    if (!modal || !list) return;
    
    list.innerHTML = children.map((c, i) => `<button class="child-select-btn" data-index="${i}">${sanitizeInput(c.name)}</button>`).join('');
    modal.style.display = 'flex';
    
    document.querySelectorAll('.child-select-btn').forEach(btn => {
        btn.onclick = () => {
            setActiveChild(Number(btn.dataset.index));
            modal.style.display = 'none';
            updateStatsDisplay();
        };
    });
}

export function selectGuestMode() {
    setActiveChild(-1);
    const modal = document.getElementById('childSelectModal');
    if (modal) modal.style.display = 'none';
    updateStatsDisplay();
}

// ========================================
// STATS
// ========================================

export function getChildStats() {
    const key = getChildStatsKey();
    try {
        const data = JSON.parse(localStorage.getItem(key) || 'null');
        if (data) return data;
    } catch (e) {}
    return { totalStories: 0, totalGames: 0, history: [], fearStats: { ...CONFIG.DEFAULT_FEAR_STATS }, lastActive: Date.now() };
}

export function saveChildStats(stats) {
    const key = getChildStatsKey();
    try {
        let json = JSON.stringify(stats);
        const MAX_SIZE = CONFIG.MAX_LOCAL_STORAGE_SIZE || 5 * 1024 * 1024;
        while (json.length > MAX_SIZE) {
            if (!stats.history || stats.history.length === 0) break;
            stats.history.shift();
            json = JSON.stringify(stats);
        }
        localStorage.setItem(key, json);
    } catch (e) {
        logError('save_stats', e.message);
    }
}

export function saveToChildHistory(entry) {
    if (!entry || !entry.text) return;
    const stats = getChildStats();
    stats.history.push({ role: entry.role || 'unknown', text: entry.text, timestamp: entry.timestamp || Date.now(), characterName: entry.characterName || null, childName: entry.childName || getActiveChildName() });
    if (stats.history.length > CONFIG.MAX_HISTORY) stats.history = stats.history.slice(-CONFIG.MAX_HISTORY);
    saveChildStats(stats);
}

export function updateFearStats(fears) {
    if (!fears || fears.length === 0) return;
    const stats = getChildStats();
    fears.forEach(f => { if (stats.fearStats[f] !== undefined) stats.fearStats[f]++; });
    saveChildStats(stats);
}

export function incrementStories() {
    const stats = getChildStats();
    stats.totalStories = (stats.totalStories || 0) + 1;
    saveChildStats(stats);
    localStorage.setItem('totalStories', String(Number(localStorage.getItem('totalStories') || 0) + 1));
    updateStatsDisplay();
}

export function incrementGames() {
    const stats = getChildStats();
    stats.totalGames = (stats.totalGames || 0) + 1;
    saveChildStats(stats);
    localStorage.setItem('totalGames', String(Number(localStorage.getItem('totalGames') || 0) + 1));
    updateStatsDisplay();
}

// ========================================
// ANIMATIONS
// ========================================

function animateStat(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const current = parseInt(el.style.width) || 0;
    const diff = target - current;
    const duration = 400;
    const startTime = performance.now();
    
    function step(timestamp) {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.style.width = Math.min(100, current + diff * eased) + '%';
        if (progress < 1) requestAnimationFrame(step);
        else setTimeout(() => el.style.width = '60%', 2500);
    }
    requestAnimationFrame(step);
}

function showFeedingAnimation() {
    const avatar = document.getElementById('avatar');
    if (!avatar) return;
    const items = ['🍎', '🍪', '🧃', '🍌', '🍇'];
    for (let i = 0; i < items.length; i++) {
        setTimeout(() => {
            const span = document.createElement('span');
            span.textContent = items[i];
            span.style.cssText = `position:fixed;font-size:24px;pointer-events:none;z-index:9999;left:50%;top:40%;transition:all .8s;opacity:1;`;
            document.body.appendChild(span);
            requestAnimationFrame(() => { span.style.transform = `translate(${(Math.random() - .5) * 200}px,-${100 + Math.random() * 100}px) scale(.3)`; span.style.opacity = '0'; });
            setTimeout(() => span.remove(), 900);
        }, i * 100);
    }
}

function showCleaningAnimation() {
    const avatar = document.getElementById('avatar');
    if (!avatar) return;
    avatar.style.transform = 'rotate(-5deg)';
    setTimeout(() => avatar.style.transform = 'rotate(5deg)', 150);
    setTimeout(() => avatar.style.transform = 'rotate(-3deg)', 300);
    setTimeout(() => avatar.style.transform = 'rotate(0deg)', 450);
}

// ========================================
// UI INIT
// ========================================

function initUI() {
    console.log('🔵 initUI started');
    const avatar = document.getElementById('avatar');
    if (avatar) avatar.onclick = () => cycleCharacter(1);
    
    const parent = document.getElementById('parentBtn');
    if (parent) parent.onclick = () => location.href = '/parent.html';
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        if (localStorage.getItem('userToken')) logoutBtn.style.display = 'flex';
        logoutBtn.onclick = () => { localStorage.clear(); location.href = '/login.html'; };
    }
}

function initEventListeners() {
    console.log('🔵 initEventListeners started');
    
    const mic = document.getElementById('micBtn');
    if (mic) {
        mic.onclick = handleMicClick;
        let pressTimer;
        mic.onmousedown = () => pressTimer = setTimeout(handleLongPress, 1500);
        mic.onmouseup = () => clearTimeout(pressTimer);
        mic.onmouseleave = () => clearTimeout(pressTimer);
    }
    
    const games = document.getElementById('gamesBtn');
    if (games) games.onclick = () => { incrementGames(); launchFishGame(); };
    
    const feed = document.getElementById('feedBtn');
    if (feed) feed.onclick = () => { animateStat('hungerFill', 100); trackEvent('feed', getActiveChildName()); showFeedingAnimation(); };
    
    const room = document.getElementById('roomBtn');
    if (room) room.onclick = () => { animateStat('energyFill', 100); trackEvent('clean', getActiveChildName()); showCleaningAnimation(); };
}

function loadState() {
    const saved = localStorage.getItem('currentCharacter') || 'lucik';
    setCharacter(saved);
    characterCycleIndex = characterIds.indexOf(saved);
    if (characterCycleIndex < 0) characterCycleIndex = 0;
    
    const avatar = document.getElementById('avatar');
    if (avatar) avatar.style.backgroundImage = `url('${CHARACTERS[saved]?.icon || '/assets/images/avatar.png'}')`;
}

// ========================================
// DISPLAY
// ========================================

export function updateStatsDisplay() {
    const stats = getChildStats();
    const mood = document.getElementById('moodFill');
    const hunger = document.getElementById('hungerFill');
    const energy = document.getElementById('energyFill');
    const bravery = document.getElementById('braveryFill');
    if (mood) mood.style.width = '70%';
    if (hunger) hunger.style.width = '60%';
    if (energy) energy.style.width = '50%';
    if (bravery) bravery.style.width = Math.max(5, Math.min(100, (stats.totalStories || 0) * 10 + (stats.totalGames || 0) * 5)) + '%';
}

// ========================================
// CHARACTER
// ========================================

export function cycleCharacter(direction = 1) {
    let count = 0;
    while (count < characterIds.length) {
        characterCycleIndex = (characterCycleIndex + direction + characterIds.length) % characterIds.length;
        const id = characterIds[characterCycleIndex];
        const char = CHARACTERS[id];
        if (!char) { count++; continue; }
        if (char.premium && !isPremiumUser()) { count++; continue; }
        
        setCharacter(id);
        localStorage.setItem('currentCharacter', id);
        clearContext();
        
        const avatar = document.getElementById('avatar');
        if (avatar) {
            avatar.style.backgroundImage = `url('${char.icon}')`;
            avatar.style.transform = 'scale(.85)';
            setTimeout(() => avatar.style.transform = 'scale(1)', 150);
        }
        trackEvent('character_change', id);
        return;
    }
}

function isPremiumUser() {
    const email = localStorage.getItem('userEmail') || '';
    if (email === 'alexmel669@gmail.com' && localStorage.getItem('devUnlocked') === '13') return true;
    return localStorage.getItem('premium') === 'true';
}

// ========================================
// ALERTS
// ========================================

function saveAlertForParent(text, words, source) {
    try {
        const alerts = JSON.parse(localStorage.getItem('parentAlerts') || '[]');
        alerts.push({ text: text.substring(0, 200), words, source, timestamp: Date.now(), childName: getActiveChildName() });
        if (alerts.length > 20) alerts.shift();
        localStorage.setItem('parentAlerts', JSON.stringify(alerts));
    } catch(e) {}
}

// ========================================
// SPEECH RECOGNITION
// ========================================

function browserSpeechRecognition() {
    return new Promise(resolve => {
        const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Speech) { resolve(''); return; }
        
        const rec = new Speech();
        rec.lang = 'ru-RU';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        let finished = false;
        
        rec.onresult = e => { if (!finished) { finished = true; resolve(e.results[0][0].transcript); } };
        rec.onerror = () => { if (!finished) { finished = true; resolve(''); } };
        rec.onend = () => { if (!finished) { finished = true; resolve(''); } };
        
        try { rec.start(); } catch(e) { resolve(''); }
        setTimeout(() => { if (!finished) { finished = true; try { rec.stop(); } catch(e) {} resolve(''); } }, CONFIG.AUDIO_TIMEOUT);
    });
}

async function recognizeSpeech(blob) {
    try {
        const base64 = await blobToBase64(blob);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.AUDIO_TIMEOUT);
        const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64 }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (response.ok) {
            const data = await response.json();
            if (data.text) return data.text;
        }
    } catch(e) { console.warn('STT fail', e.message); }
    return browserSpeechRecognition();
}

// ========================================
// MICROPHONE HANDLER
// ========================================

async function handleMicClick() {
    if (isProcessing) return;
    
    const mic = document.getElementById('micBtn');
    const avatar = document.getElementById('avatar');
    
    if (isRecording()) {
        isProcessing = true;
        try {
            const audio = await stopRecording();
            if (audio && audio.size > 0) await processAudio(audio);
        } catch(e) { logError('record', e.message); }
        finally {
            isProcessing = false;
            if (avatar) avatar.classList.remove('listening', 'talking');
            if (mic) { mic.classList.remove('recording'); mic.textContent = '🎤'; }
        }
    } else {
        try {
            await startRecording();
            if (mic) { mic.classList.add('recording'); mic.textContent = '⏺️'; }
            if (avatar) avatar.classList.add('listening');
        } catch(e) { alert('Нет доступа к микрофону'); logError('mic', e.message); }
    }
}

// ========================================
// LONG PRESS - BEDTIME STORY
// ========================================

async function handleLongPress() {
    if (isProcessing || isRecording()) return;
    const hour = new Date().getHours();
    if (hour >= 20 || hour < 6) {
        const micBtn = document.getElementById('micBtn');
        if (micBtn) micBtn.textContent = '🌙';
        isProcessing = true;
        try {
            const reply = await generateResponse('Расскажи сказку на ночь');
            await synthesizeSpeech(reply, getCharacter());
            incrementStories();
        } catch(e) { logError('bedtime_story', e.message); }
        finally {
            isProcessing = false;
            if (micBtn) micBtn.textContent = '🎤';
        }
    }
}

// ========================================
// AUDIO PROCESS
// ========================================

async function processAudio(audioBlob) {
    const avatar = document.getElementById('avatar');
    try {
        if (avatar) avatar.classList.add('listening');
        const text = await recognizeSpeech(audioBlob);
        if (!text || !text.trim()) {
            await synthesizeSpeech('Я не расслышал. Повтори?', getCharacter());
            return;
        }
        if (checkBadWords(text)) {
            await synthesizeSpeech('Давай говорить добрые слова', getCharacter());
            return;
        }
        
        saveToChildHistory({ role: 'child', text: text, timestamp: Date.now() });
        addToContext('child', text);
        
        const fears = detectFear(text);
        if (fears.length) updateFearStats(fears);
        
        const alerts = detectAlertWords(text);
        if (alerts.length) { trackEvent('alert', alerts.join(',')); saveAlertForParent(text, alerts, 'child'); }
        
        if (avatar) avatar.classList.add('talking');
        const reply = await generateResponse(text);
        
        const botAlerts = detectAlertWords(reply);
        const botPersonal = detectPersonalData(reply);
        const isSuspicious = botAlerts.length > 0 || botPersonal.length > 0;
        
        saveToChildHistory({ role: 'bot', text: reply, timestamp: Date.now(), characterName: CHARACTERS[getCharacter()]?.name || 'Люцик', alerted: isSuspicious, alertWords: [...botAlerts, ...botPersonal] });
        addToContext('bot', reply);
        if (isSuspicious) saveAlertForParent(reply, [...botAlerts, ...botPersonal], 'ai');
        
        await synthesizeSpeech(reply, getCharacter());
        if (reply.length > 200) incrementStories();
        checkAchievements();
    } catch(e) {
        logError('process_audio', e.message);
        await synthesizeSpeech('Что-то пошло не так. Попробуем ещё раз?', getCharacter());
    } finally {
        if (avatar) avatar.classList.remove('talking', 'listening');
    }
}

// ========================================
// GAME "FISH"
// ========================================

export function launchFishGame() {
    const old = document.querySelector('.game-overlay');
    if (old) old.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay';
    overlay.innerHTML = `<div style="text-align:center;padding:20px;"><h2>🎣 Поймай рыбку!</h2><div id="fishGameArea" style="width:300px;height:400px;position:relative;overflow:hidden;background:#246;border-radius:20px;margin:auto;"></div><p>🐟 Счёт: <span id="fishScore">0</span></p><p>⏱️ <span id="fishTimer">30</span> сек</p><button id="fishCloseBtn">Закрыть</button></div>`;
    document.body.appendChild(overlay);
    
    let score = 0, time = 30, active = true, fishSpawnInterval = null;
    const area = document.getElementById('fishGameArea');
    const scoreEl = document.getElementById('fishScore');
    const timerEl = document.getElementById('fishTimer');
    
    const timer = setInterval(() => {
        if (!active) return;
        time--;
        if (timerEl) timerEl.textContent = time;
        if (time <= 0) finish();
    }, 1000);
    
    function finish() {
        if (!active) return;
        active = false;
        clearInterval(timer);
        if (fishSpawnInterval) clearInterval(fishSpawnInterval);
        if (score >= 10) showAchievement('fish_master', '🎣 Мастер рыбалки!');
        trackEvent('fish_finish', String(score));
    }
    
    function createFish() {
        if (!active) return;
        const fish = document.createElement('div');
        const items = ['🐟', '🐠', '🐡', '🐙'];
        fish.textContent = items[Math.floor(Math.random() * items.length)];
        fish.style.cssText = `position:absolute;left:${Math.random() * 250}px;top:${Math.random() * 350}px;font-size:32px;cursor:pointer;`;
        fish.onclick = () => { if (!active) return; score++; if (scoreEl) scoreEl.textContent = score; fish.remove(); };
        area.appendChild(fish);
        setTimeout(() => { if (fish.parentNode) fish.remove(); }, 5000);
    }
    
    for (let i = 0; i < 3; i++) createFish();
    fishSpawnInterval = setInterval(createFish, 1500);
    
    document.getElementById('fishCloseBtn').onclick = () => { active = false; clearInterval(timer); clearInterval(fishSpawnInterval); overlay.remove(); };
    trackEvent('fish_start', getActiveChildName());
}

// ========================================
// AUTO START
// ========================================

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCore);
    else initCore();
}

// ========================================
// WINDOW EXPORTS (FOR DEBUG)
// ========================================

if (typeof window !== 'undefined') {
    window.selectGuestMode = selectGuestMode;
    window.setActiveChild = setActiveChild;
    window.cycleCharacter = cycleCharacter;
    window.getActiveChildName = getActiveChildName;
    window.saveToChildHistory = saveToChildHistory;
    window.saveChildData = saveChildData;
    window.initCore = initCore;
    window.updateStatsUI = updateStatsDisplay;
}
