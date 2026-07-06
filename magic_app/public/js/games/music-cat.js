import { appState } from '../core.js';
import { createGameScreen, getGameLevel } from './game-ui.js';
import { avatarUrl } from '../config.js';

const BODY_NOTES = {
  leftEar: { freq: 659, label: 'E5', name: 'Левое ухо' },
  rightEar: { freq: 784, label: 'G5', name: 'Правое ухо' },
  forehead: { freq: 523, label: 'C5', name: 'Лоб' },
  leftEye: { freq: 587, label: 'D5', name: 'Левый глаз' },
  rightEye: { freq: 587, label: 'D5', name: 'Правый глаз' },
  nose: { freq: 880, label: 'A5', name: 'Нос' },
  leftPaw: { freq: 698, label: 'F5', name: 'Левая лапа' },
  rightPaw: { freq: 988, label: 'B5', name: 'Правая лапа' },
  belly: { freq: 1047, label: 'C6', name: 'Живот' },
  tail: { freq: 1319, label: 'E6', name: 'Хвост' }
};

const BASS_NOTES = [
  { freq: 65, label: 'C2' }, { freq: 73, label: 'D2' }, { freq: 82, label: 'E2' },
  { freq: 87, label: 'F2' }, { freq: 98, label: 'G2' }, { freq: 110, label: 'A2' }
];

const DRUM_PATTERNS = ['kick', 'snare', 'hihat', 'clap'];

class DJEngine {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.activeLoops = {};
    this.bassLoop = null;
    this.recording = [];
    this.isRecording = false;
  }

  playNote(freq, duration = 0.5, type = 'sine') {
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
    osc.stop(this.audioCtx.currentTime + duration);
    if (this.isRecording) this.recording.push({ freq, duration, type, time: Date.now() });
  }

  toggleLoop(partKey, freq) {
    if (this.activeLoops[partKey]) {
      this.stopLoop(partKey);
      return false;
    }
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    this.activeLoops[partKey] = { osc, gain };
    return true;
  }

  stopLoop(partKey) {
    if (!this.activeLoops[partKey]) return;
    this.activeLoops[partKey].osc.stop();
    delete this.activeLoops[partKey];
  }

  stopAllLoops() {
    Object.keys(this.activeLoops).forEach((k) => this.stopLoop(k));
  }

  playBass(index) {
    if (this.bassLoop) {
      this.bassLoop.osc.stop();
      this.bassLoop = null;
    }
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = BASS_NOTES[index].freq;
    gain.gain.value = 0.2;
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start();
    this.bassLoop = { osc, gain };
  }

  playDrum(type) {
    const freq = { kick: 60, snare: 200, hihat: 8000, clap: 1000 }[type];
    this.playNote(freq, 0.15, 'square');
  }

  startRecording() {
    this.recording = [];
    this.isRecording = true;
  }

  stopRecording() {
    this.isRecording = false;
  }

  playRecording() {
    this.stopAllLoops();
    if (this.bassLoop) {
      this.bassLoop.osc.stop();
      this.bassLoop = null;
    }
    if (!this.recording.length) return;
    const start = this.recording[0].time;
    this.recording.forEach((note) => {
      const delay = note.time - start;
      setTimeout(() => this.playNote(note.freq, note.duration, note.type), delay);
    });
  }

  downloadRecording() {
    if (this.recording.length === 0) return;
    const json = JSON.stringify(this.recording, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lucik-dj-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export function startMusicCatGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('musicCat');
  const dj = new DJEngine();

  const { body } = createGameScreen({ gameId: 'musicCat', title: '🎧 DJ Люцик', emoji: '🎵', level });

  const stage = document.createElement('div');
  stage.className = 'dj-stage';
  stage.style.cssText = 'position:relative;width:100%;max-width:600px;margin:0 auto;padding:16px;';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'dj-avatar-wrap';
  avatarWrap.style.cssText = 'position:relative;width:250px;height:250px;margin:0 auto 20px;';
  avatarWrap.innerHTML = `<img src="${avatarUrl('lucik', 'png')}" alt="Люцик" style="width:100%;height:100%;border-radius:50%;box-shadow:0 0 40px rgba(255,215,0,0.5);">`;

  const bodyButtons = [
    { key: 'forehead', x: 95, y: 20, w: 60, h: 35 },
    { key: 'leftEar', x: 55, y: 35, w: 30, h: 30 },
    { key: 'rightEar', x: 165, y: 35, w: 30, h: 30 },
    { key: 'leftEye', x: 80, y: 70, w: 28, h: 20 },
    { key: 'rightEye', x: 142, y: 70, w: 28, h: 20 },
    { key: 'nose', x: 110, y: 95, w: 30, h: 20 },
    { key: 'leftPaw', x: 55, y: 150, w: 35, h: 40 },
    { key: 'rightPaw', x: 160, y: 150, w: 35, h: 40 },
    { key: 'belly', x: 90, y: 130, w: 70, h: 50 },
    { key: 'tail', x: 180, y: 190, w: 40, h: 30 }
  ];

  bodyButtons.forEach((btn) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'dj-body-btn';
    el.title = BODY_NOTES[btn.key].name;
    el.style.cssText = `position:absolute;left:${btn.x}px;top:${btn.y}px;width:${btn.w}px;height:${btn.h}px;border-radius:50%;border:2px solid rgba(255,215,0,0.4);background:rgba(255,215,0,0.1);cursor:pointer;z-index:5;transition:all 0.2s;`;
    let looping = false;

    const startLoop = (e) => {
      e.stopPropagation();
      looping = dj.toggleLoop(btn.key, BODY_NOTES[btn.key].freq);
      el.style.background = looping ? 'rgba(255,215,0,0.4)' : 'rgba(255,215,0,0.1)';
    };
    const stopLoop = () => {
      if (looping) {
        dj.stopLoop(btn.key);
        looping = false;
        el.style.background = 'rgba(255,215,0,0.1)';
      }
    };

    el.addEventListener('mousedown', startLoop);
    el.addEventListener('mouseup', stopLoop);
    el.addEventListener('mouseleave', stopLoop);
    el.addEventListener('touchstart', startLoop, { passive: true });
    el.addEventListener('touchend', stopLoop);
    avatarWrap.appendChild(el);
  });

  stage.appendChild(avatarWrap);

  const bassPanel = document.createElement('div');
  bassPanel.className = 'dj-panel';
  bassPanel.innerHTML = '<h4>🔊 Бас</h4><div class="dj-bass-grid"></div>';
  BASS_NOTES.forEach((n, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dj-btn';
    b.textContent = n.label;
    b.onclick = () => dj.playBass(i);
    bassPanel.querySelector('.dj-bass-grid').appendChild(b);
  });
  stage.appendChild(bassPanel);

  const drumPanel = document.createElement('div');
  drumPanel.className = 'dj-panel';
  drumPanel.innerHTML = '<h4>🥁 Драмы</h4><div class="dj-drum-grid"></div>';
  DRUM_PATTERNS.forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dj-btn drum-btn';
    b.textContent = { kick: '🥾', snare: '🥁', hihat: '💿', clap: '👏' }[d];
    b.onclick = () => dj.playDrum(d);
    drumPanel.querySelector('.dj-drum-grid').appendChild(b);
  });
  stage.appendChild(drumPanel);

  const ctrl = document.createElement('div');
  ctrl.className = 'dj-panel dj-controls';
  ctrl.innerHTML = '<button type="button" class="dj-btn" id="btnRecord">🔴 Запись</button><button type="button" class="dj-btn" id="btnStop">⏹️ Стоп</button><button type="button" class="dj-btn" id="btnPlay">▶️ Играть</button><button type="button" class="dj-btn" id="btnDownload">💾 Скачать</button>';
  stage.appendChild(ctrl);
  body.appendChild(stage);

  stage.querySelector('#btnRecord').onclick = () => dj.startRecording();
  stage.querySelector('#btnStop').onclick = () => {
    dj.stopAllLoops();
    dj.stopRecording();
  };
  stage.querySelector('#btnPlay').onclick = () => dj.playRecording();
  stage.querySelector('#btnDownload').onclick = () => dj.downloadRecording();

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    dj.stopAllLoops();
    if (dj.bassLoop) {
      dj.bassLoop.osc.stop();
      dj.bassLoop = null;
    }
    appState.gameActive = false;
  }, { once: true });
}

export default { startMusicCatGame };
