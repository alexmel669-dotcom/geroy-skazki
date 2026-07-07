import { appState, getActiveChild } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { createGameScreen, showGameResult, recordGameWin, getGameLevel } from './game-ui.js';
import { avatarUrl } from '../config.js';

const ZONES = {
  forehead: { freq: 523, label: 'До', pos: [50, 5, 50, 25] },
  leftEar: { freq: 659, label: 'Ми', pos: [20, 15, 25, 22] },
  rightEar: { freq: 784, label: 'Соль', pos: [62, 15, 25, 22] },
  nose: { freq: 880, label: 'Ля', pos: [42, 42, 20, 16] },
  leftPaw: { freq: 698, label: 'Фа', pos: [22, 62, 28, 30] },
  rightPaw: { freq: 988, label: 'Си', pos: [58, 62, 28, 30] },
  belly: { freq: 1047, label: 'До2', pos: [35, 55, 35, 35] }
};

const BASS = [65, 73, 82, 87, 98, 110];

export function startMusicCatGame(level = 1) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('musicCat');

  const child = getActiveChild();
  const age = child?.age || 7;
  const mission = age <= 6 ? { type: 'simple', target: 'nose', msg: 'Нажми на нос!', idx: 0 } :
    age <= 10 ? { type: 'repeat', seq: ['nose', 'leftEar', 'belly'], msg: 'Повтори: нос, ухо, живот!', idx: 0 } :
      { type: 'free', msg: 'Создавай музыку!', idx: 0 };

  const { body, close } = createGameScreen({ gameId: 'musicCat', title: '🎧 DJ Люцик', emoji: '🎵', level });

  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  const msgEl = document.createElement('p');
  msgEl.style.cssText = 'text-align:center;color:#FFD700;font-size:16px;margin:4px 0;';
  msgEl.textContent = mission.msg;

  const avatarWrap = document.createElement('div');
  avatarWrap.style.cssText = 'position:relative;width:250px;height:250px;margin:0 auto;';
  avatarWrap.innerHTML = `<img src="${avatarUrl('lucik', 'svg')}" style="width:100%;height:100%;border-radius:50%;box-shadow:0 0 40px rgba(255,215,0,0.5);">`;

  Object.entries(ZONES).forEach(([key, z]) => {
    const btn = document.createElement('div');
    btn.style.cssText = `position:absolute;left:${z.pos[0]}%;top:${z.pos[1]}%;width:${z.pos[2]}%;height:${z.pos[3]}%;border-radius:50%;cursor:pointer;z-index:5;`;
    btn.onmousedown = (e) => { e.stopPropagation(); playNote(z.freq); checkMission(key); };
    btn.ontouchstart = (e) => { e.stopPropagation(); e.preventDefault(); playNote(z.freq); checkMission(key); };
    avatarWrap.appendChild(btn);
  });

  const bassRow = document.createElement('div');
  bassRow.style.cssText = 'display:flex;gap:4px;justify-content:center;margin:12px 0;';
  BASS.forEach((f) => {
    const b = document.createElement('button');
    b.textContent = '🔊';
    b.style.cssText = 'padding:8px 12px;border-radius:8px;border:1px solid #FFD700;background:transparent;color:#FFD700;cursor:pointer;';
    b.onclick = () => { playNote(f, 0.8, 'sawtooth'); };
    bassRow.appendChild(b);
  });

  body.append(msgEl, avatarWrap, bassRow);

  function playNote(freq, dur = 0.5, type = 'sine') {
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function checkMission(key) {
    if (mission.type === 'simple' && key === mission.target) {
      endGame(true);
    } else if (mission.type === 'repeat') {
      if (key === mission.seq[mission.idx]) {
        mission.idx++;
        if (mission.idx >= mission.seq.length) endGame(true);
      } else { mission.idx = 0; }
    }
  }

  function endGame(won) {
    appState.gameActive = false;
    close();
    recordGameResult('musicCat', won, level);
    if (won) { recordGameWin('musicCat', level); updateAchievement('music_master'); checkProgressAchievements(); }
    speak(won ? 'Браво!' : '');
    showGameResult({ won, level, onNext: won ? () => startMusicCatGame(level + 1) : null, onRestart: () => startMusicCatGame(level) });
  }

  trackEvent('musicCat_started', { level });
}

export default { startMusicCatGame };
