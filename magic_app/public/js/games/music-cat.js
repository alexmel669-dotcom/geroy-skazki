// ========================================
// music-cat.js — DJ Люцик Premium (v5.7.4)
// ========================================

import { appState, getActiveChild } from '../core.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { addXP } from '../progression.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';
import { avatarUrl } from '../config.js';

// Зоны тела — жирные пресеты
const ZONES = {
  forehead:  { freq: 523, type: 'sine', label: 'Lead C5', pos: [38, 10, 24, 18] },
  leftEar:   { freq: 659, type: 'triangle', label: 'Pluck E5', pos: [10, 22, 20, 16] },
  rightEar:  { freq: 784, type: 'sawtooth', label: 'Reese G5', pos: [70, 22, 20, 16] },
  leftEye:   { freq: 587, type: 'sine', label: 'Bell D5', pos: [28, 38, 16, 12] },
  rightEye:  { freq: 587, type: 'triangle', label: 'Soft D5', pos: [56, 38, 16, 12] },
  nose:      { freq: 880, type: 'sawtooth', label: 'Bass A5', pos: [42, 48, 16, 12] },
  leftPaw:   { freq: 698, type: 'square', label: 'Hit F5', pos: [15, 65, 22, 22] },
  rightPaw:  { freq: 988, type: 'sine', label: 'Bell B5', pos: [65, 65, 22, 22] },
  belly:     { freq: 1047, type: 'triangle', label: 'Kick C6', pos: [35, 58, 30, 25] },
  tail:      { freq: 1319, type: 'sawtooth', label: 'Hat E6', pos: [72, 70, 22, 18] }
};

// Бас-станция
const BASS_NOTES = [
  { freq: 65, label: 'C2' }, { freq: 73, label: 'D2' }, { freq: 82, label: 'E2' },
  { freq: 87, label: 'F2' }, { freq: 98, label: 'G2' }, { freq: 110, label: 'A2' }
];

// Драмы
const DRUMS = [
  { name: 'Kick', freq: 60, type: 'kick', label: '🥾' },
  { name: 'Snare', freq: 200, type: 'snare', label: '🥁' },
  { name: 'Hi-hat', freq: 8000, type: 'hihat', label: '💿' },
  { name: 'Clap', freq: 1000, type: 'clap', label: '👏' },
  { name: 'Rim', freq: 300, type: 'rim', label: '📎' },
  { name: 'Crash', freq: 6000, type: 'crash', label: '💥' }
];

// Синтезатор
const SYNTHS = [
  { name: 'Pluck', freq: 523, type: 'pluck', label: '🎸' },
  { name: 'Pad', freq: 659, type: 'pad', label: '🎹' },
  { name: 'Lead', freq: 784, type: 'lead', label: '🎺' },
  { name: 'Chord', freq: 1047, type: 'chord', label: '🎵' }
];

// FX
const FX = [
  { name: 'Scratch', type: 'scratch', label: '🎚️' },
  { name: 'Noise', type: 'noise', label: '🌊' },
  { name: 'Filter', type: 'filter', label: '🎛️' },
  { name: 'Repeat', type: 'repeat', label: '🔁' }
];

// Готовые биты
const BEATS = [
  { name: 'House', pattern: ['kick','hat','snare','hat','kick','hat','snare','hat'], tempo: 128, label: '🏠' },
  { name: 'Hip-Hop', pattern: ['kick','hat','snare','kick','hat'], tempo: 90, label: '🎤' },
  { name: 'Lo-Fi', pattern: ['kick','snare','hat','kick','snare'], tempo: 85, label: '📻' },
  { name: 'DnB', pattern: ['kick','snare','kick','snare','hat','hat','hat','hat'], tempo: 174, label: '💨' }
];

// Миссии
const MISSIONS = {
  1: { type: 'simple', target: 'nose', msg: 'Нажми на нос Люцика!' },
  2: { type: 'sequence', seq: ['leftEar', 'rightEye', 'belly'], msg: 'Повтори: левое ухо → глаз → живот' },
  3: { type: 'sequence', seq: ['forehead', 'nose', 'tail', 'belly'], msg: 'Сыграй: лоб → нос → хвост → живот' },
  4: { type: 'sequence', seq: ['leftEar', 'nose', 'tail', 'leftPaw', 'belly'], msg: 'Сложный ритм: ухо → нос → хвост → лапа → живот' },
  5: { type: 'free', msg: 'Свободный режим — создавай свою музыку!' }
};

class DJEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.recording = [];
    this.isRecording = false;
    this.beatInterval = null;
    this.bassOsc = null;
    this.setupEffects();
  }

  setupEffects() {
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.compressor.connect(this.ctx.destination);

    this.distortion = this.ctx.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(50);
    this.distortion.connect(this.compressor);

    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.createReverbBuffer(1.5, 0.4);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.2;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.ctx.destination);

    this.delay = this.ctx.createDelay(0.5);
    this.delay.delayTime.value = 0.25;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.3;
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.compressor);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.filter.connect(this.compressor);

    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 200;
    this.eqLow.gain.value = 3;
    this.eqLow.connect(this.compressor);

    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 8000;
    this.eqHigh.gain.value = 2;
    this.eqHigh.connect(this.compressor);
  }

  makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  createReverbBuffer(duration, decay) {
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  playNote(freq, duration = 0.3, type = 'sine') {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.005);
    gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.distortion);
    gain.connect(this.reverb);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);

    if (this.isRecording) this.recording.push({ freq, duration, type, time: Date.now() });
  }

  playDrum(type) {
    const cfg = { kick: [60,0.3,'sine'], snare: [200,0.15,'triangle'], hihat: [8000,0.08,'square'], clap: [1000,0.1,'square'], rim: [300,0.08,'square'], crash: [6000,0.3,'sawtooth'] };
    const [freq, dur, wave] = cfg[type] || [200,0.1,'square'];
    this.playNote(freq, dur, wave);
  }

  playBass(index) {
    if (this.bassOsc) {
      this.bassOsc.osc.stop();
      this.bassOsc.subOsc.stop();
      this.bassOsc = null;
      return;
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = BASS_NOTES[index].freq;
    gain.gain.value = 0.2;

    subOsc.type = 'sine';
    subOsc.frequency.value = BASS_NOTES[index].freq / 2;
    subGain.gain.value = 0.15;

    osc.connect(gain);
    subOsc.connect(subGain);
    gain.connect(this.distortion);
    subGain.connect(this.distortion);

    osc.start();
    subOsc.start();
    this.bassOsc = { osc, subOsc, gain, subGain };
  }

  startBeat(beatName) {
    this.stopBeat();
    const beat = BEATS.find(b => b.name === beatName);
    if (!beat) return;

    let step = 0;
    const interval = (60 / beat.tempo) * 1000 / 4;

    this.beatInterval = setInterval(() => {
      const drum = beat.pattern[step % beat.pattern.length];
      this.playDrum(drum);
      step++;
    }, interval);
  }

  stopBeat() {
    if (this.beatInterval) { clearInterval(this.beatInterval); this.beatInterval = null; }
  }

  startRecording() { this.recording = []; this.isRecording = true; }
  stopRecording() { this.isRecording = false; }

  playRecording() {
    if (!this.recording.length) return;
    const start = this.recording[0].time;
    this.recording.forEach(note => {
      setTimeout(() => this.playNote(note.freq, note.duration, note.type), note.time - start);
    });
  }

  downloadRecording() {
    if (!this.recording.length) return;
    const json = JSON.stringify(this.recording, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lucik-dj-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  dispose() {
    this.stopBeat();
    if (this.bassOsc) {
      this.bassOsc.osc.stop();
      this.bassOsc.subOsc.stop();
      this.bassOsc = null;
    }
    this.ctx.close();
  }
}

export function startMusicCatGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach(el => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const child = getActiveChild();
  const age = child?.age || 7;
  const mission = MISSIONS[Math.min(level, 5)] || MISSIONS[5];
  let missionIdx = 0;
  let missionDone = false;

  const dj = new DJEngine();

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;background:linear-gradient(180deg,#0a0015,#1a0030);';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:rgba(0,0,0,0.6);color:#fff;font-size:16px;z-index:10;';
  header.innerHTML = '<span>🎧 DJ Люцик</span><span id="djMission" style="color:#FFD700;font-size:14px;">'+mission.msg+'</span><button id="dc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>';

  const stage = document.createElement('div');
  stage.style.cssText = 'flex:1;overflow-y:auto;padding:10px;';

  const avatarWrap = document.createElement('div');
  avatarWrap.style.cssText = 'position:relative;width:250px;height:250px;margin:0 auto 16px;';
  avatarWrap.innerHTML = '<img src="'+avatarUrl('lucik','png')+'" style="width:100%;height:100%;border-radius:50%;box-shadow:0 0 50px rgba(138,43,226,0.5);" onerror="this.src=\''+avatarUrl('lucik','svg')+'\'">';

  Object.entries(ZONES).forEach(([key, z]) => {
    const btn = document.createElement('div');
    btn.style.cssText = 'position:absolute;left:'+z.pos[0]+'%;top:'+z.pos[1]+'%;width:'+z.pos[2]+'%;height:'+z.pos[3]+'%;border-radius:50%;border:2px solid rgba(138,43,226,0.5);background:rgba(138,43,226,0.1);cursor:pointer;z-index:5;transition:all 0.15s;';
    btn.title = z.label;

    btn.onmousedown = (e) => { e.stopPropagation(); dj.playNote(z.freq, 0.3, z.type); checkMission(key); };
    btn.ontouchstart = (e) => { e.preventDefault(); e.stopPropagation(); dj.playNote(z.freq, 0.3, z.type); checkMission(key); };

    btn.onmouseenter = () => { btn.style.background = 'rgba(138,43,226,0.3)'; btn.style.borderColor = '#FFD700'; };
    btn.onmouseleave = () => { btn.style.background = 'rgba(138,43,226,0.1)'; btn.style.borderColor = 'rgba(138,43,226,0.5)'; };

    avatarWrap.appendChild(btn);
  });

  stage.appendChild(avatarWrap);

  const viz = document.createElement('div');
  viz.style.cssText = 'display:flex;gap:4px;justify-content:center;align-items:flex-end;height:40px;margin:0 0 12px;';
  for (let i = 0; i < 16; i++) {
    const bar = document.createElement('div');
    bar.style.cssText = 'width:8px;background:linear-gradient(180deg,#FFD700,#8A2BE2);border-radius:4px;transition:height 0.1s;';
    bar.style.height = '10px';
    viz.appendChild(bar);
  }
  const vizInterval = setInterval(() => {
    viz.querySelectorAll('div').forEach(b => {
      b.style.height = (10 + Math.random() * 30) + 'px';
    });
  }, 150);
  stage.appendChild(viz);

  function addPanel(title, items, callback) {
    const panel = document.createElement('div');
    panel.style.cssText = 'margin-bottom:12px;';
    panel.innerHTML = '<h4 style="color:#8A2BE2;margin:0 0 6px;font-size:13px;">'+title+'</h4><div style="display:flex;gap:6px;flex-wrap:wrap;"></div>';
    const row = panel.querySelector('div');
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.textContent = item.label || item.name;
      btn.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid rgba(138,43,226,0.5);background:rgba(138,43,226,0.15);color:#fff;font-size:13px;cursor:pointer;white-space:nowrap;';
      if (item.active) btn.style.background = 'rgba(138,43,226,0.4)';
      btn.onclick = () => callback(item, btn);
      row.appendChild(btn);
    });
    stage.appendChild(panel);
  }

  addPanel('🔊 Бас', BASS_NOTES, (item) => dj.playBass(BASS_NOTES.indexOf(item)));
  addPanel('🥁 Драмы', DRUMS, (item) => dj.playDrum(item.type));
  addPanel('🎹 Синт', SYNTHS, (item) => dj.playNote(item.freq, 0.4, 'sine'));
  addPanel('🎚️ FX', FX, (item) => {
    if (item.type === 'scratch') dj.playNote(200, 0.2, 'sawtooth');
    else if (item.type === 'noise') { for (let i=0; i<5; i++) dj.playNote(100+Math.random()*500, 0.1, 'square'); }
    else if (item.type === 'filter') { dj.filter.frequency.value = 500; setTimeout(() => dj.filter.frequency.value = 20000, 1000); }
    else if (item.type === 'repeat') dj.playRecording();
  });
  addPanel('🎵 Биты', BEATS, (item, btn) => {
    dj.startBeat(item.name);
    stage.querySelectorAll('button').forEach(b => b.style.background = 'rgba(138,43,226,0.15)');
    btn.style.background = 'rgba(138,43,226,0.4)';
  });

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:12px 0;';
  const btns = [
    { text: '🔴', action: () => { dj.startRecording(); } },
    { text: '⏹️', action: () => { dj.stopRecording(); dj.stopBeat(); if (dj.bassOsc) { dj.bassOsc.osc.stop(); dj.bassOsc.subOsc.stop(); dj.bassOsc = null; } } },
    { text: '▶️', action: () => dj.playRecording() },
    { text: '💾', action: () => dj.downloadRecording() },
    { text: '🗑️', action: () => { dj.recording = []; dj.stopBeat(); } }
  ];
  btns.forEach(b => {
    const btn = document.createElement('button');
    btn.textContent = b.text;
    btn.style.cssText = 'padding:10px 16px;border-radius:8px;border:1px solid rgba(138,43,226,0.5);background:rgba(138,43,226,0.2);color:#fff;font-size:18px;cursor:pointer;';
    btn.onclick = b.action;
    controls.appendChild(btn);
  });
  stage.appendChild(controls);

  overlay.appendChild(header);
  overlay.appendChild(stage);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  function cleanup() {
    clearInterval(vizInterval);
    dj.dispose();
    appState.gameActive = false;
    document.body.classList.remove('game-active');
  }

  function checkMission(key) {
    if (missionDone) return;
    if (mission.type === 'simple' && key === mission.target) win();
    else if (mission.type === 'sequence') {
      if (key === mission.seq[missionIdx]) {
        missionIdx++;
        if (missionIdx >= mission.seq.length) win();
      } else { missionIdx = 0; }
    }
  }

  function win() {
    if (missionDone) return;
    missionDone = true;
    cleanup();
    overlay.remove();
    recordGameResult('musicCat', true, level);
    addXP('game_win');
    updateAchievement('music_master');
    checkProgressAchievements();
    trackEvent('musicCat_won', { level });
    const best = Math.max(+(localStorage.getItem('musicCat-best')||0), level);
    localStorage.setItem('musicCat-best', best);
    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = '<div style="background:#fff;border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"><div style="font-size:48px;">🎧</div><h2 style="margin:12px 0;color:#222;font-size:22px;">Миссия выполнена!</h2><p style="color:#444;font-size:16px;">Ты настоящий DJ!</p><button id="mr" style="margin:8px;padding:14px 28px;border-radius:12px;border:none;background:#FFD700;color:#222;font-weight:bold;font-size:18px;cursor:pointer;width:80%;">🔄 Дальше</button><button id="me" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ccc;background:#fff;color:#888;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button></div>';
    document.body.appendChild(result);
    result.querySelector('#mr').onclick = () => { result.remove(); startMusicCatGame(level+1); };
    result.querySelector('#me').onclick = () => { result.remove(); if(typeof showGamesMenu==='function') showGamesMenu(); };
  }

  document.getElementById('dc').onclick = () => {
    cleanup();
    overlay.remove();
  };

  trackEvent('musicCat_started', { level });
}

export default { startMusicCatGame };
