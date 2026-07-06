import { appState } from '../core.js';
import { createGameScreen, getGameLevel } from './game-ui.js';
import { avatarImgHtml } from '../config.js';

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
    this._buildMasterBus();
    this.activeLoops = {};
    this.bassLoop = null;
    this.recording = [];
    this.isRecording = false;
    this.recordStart = 0;
  }

  _buildMasterBus() {
    const ctx = this.audioCtx;
    this.dryBus = ctx.createGain();
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.2;

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._makeImpulse(1.6, 2.2);

    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.35;
    this.reverb.connect(reverbOut);

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 14;
    this.compressor.ratio.value = 2.8;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.82;

    this.dryBus.connect(this.compressor);
    this.reverbSend.connect(this.reverb);
    reverbOut.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);
  }

  _makeImpulse(duration, decay) {
    const rate = this.audioCtx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = this.audioCtx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _routeOutput(node) {
    node.connect(this.dryBus);
    node.connect(this.reverbSend);
  }

  async _resume() {
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
  }

  _scheduleNote(at, freq, duration = 0.45) {
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;
    harm.type = 'triangle';
    harm.frequency.value = freq * 2;
    harmGain.gain.value = 0.06;

    filter.type = 'lowpass';
    filter.frequency.value = Math.min(freq * 5, 9000);
    filter.Q.value = 0.7;

    osc.connect(filter);
    harm.connect(harmGain);
    harmGain.connect(filter);
    filter.connect(gain);
    this._routeOutput(gain);

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(0.32, at + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.14, at + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.start(at);
    harm.start(at);
    osc.stop(at + duration + 0.04);
    harm.stop(at + duration + 0.04);

    if (this.isRecording) {
      this.recording.push({ kind: 'note', freq, duration, at: at - this.recordStart });
    }
  }

  playNote(freq, duration = 0.45) {
    this._resume();
    this._scheduleNote(this.audioCtx.currentTime, freq, duration);
  }

  toggleLoop(partKey, freq) {
    if (this.activeLoops[partKey]) {
      this.stopLoop(partKey);
      return false;
    }
    this._resume();
    const ctx = this.audioCtx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;
    harm.type = 'triangle';
    harm.frequency.value = freq * 1.5;
    harmGain.gain.value = 0.04;
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(freq * 4, 6000);

    osc.connect(filter);
    harm.connect(harmGain);
    harmGain.connect(filter);
    filter.connect(gain);
    this._routeOutput(gain);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.06);

    osc.start(t);
    harm.start(t);
    this.activeLoops[partKey] = { osc, harm, gain };
    return true;
  }

  stopLoop(partKey) {
    const loop = this.activeLoops[partKey];
    if (!loop) return;
    const t = this.audioCtx.currentTime;
    loop.gain.gain.cancelScheduledValues(t);
    loop.gain.gain.setValueAtTime(Math.max(loop.gain.gain.value, 0.0001), t);
    loop.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    loop.osc.stop(t + 0.12);
    loop.harm.stop(t + 0.12);
    delete this.activeLoops[partKey];
  }

  stopAllLoops() {
    Object.keys(this.activeLoops).forEach((k) => this.stopLoop(k));
  }

  stopBass() {
    if (!this.bassLoop) return;
    const t = this.audioCtx.currentTime;
    this.bassLoop.gain.gain.cancelScheduledValues(t);
    this.bassLoop.gain.gain.setValueAtTime(Math.max(this.bassLoop.gain.gain.value, 0.0001), t);
    this.bassLoop.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    this.bassLoop.osc.stop(t + 0.1);
    this.bassLoop = null;
  }

  playBass(index) {
    this.stopBass();
    this._resume();
    const ctx = this.audioCtx;
    const t = ctx.currentTime;
    const freq = BASS_NOTES[index].freq;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;
    sub.type = 'sine';
    sub.frequency.value = freq * 0.5;
    subGain.gain.value = 0.35;
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    osc.connect(filter);
    sub.connect(subGain);
    subGain.connect(filter);
    filter.connect(gain);
    this._routeOutput(gain);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.04);

    osc.start(t);
    sub.start(t);
    this.bassLoop = { osc, sub, gain };

    if (this.isRecording) {
      this.recording.push({ kind: 'bass', index, at: t - this.recordStart });
    }
  }

  _noiseBurst(at, duration, gainPeak, filterFreq, filterQ = 1) {
    const ctx = this.audioCtx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;
    src.connect(filter);
    filter.connect(gain);
    this._routeOutput(gain);

    gain.gain.setValueAtTime(gainPeak, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    src.start(at);
    src.stop(at + duration + 0.02);
    return { src, gain };
  }

  playDrum(type, atTime) {
    this._resume();
    const ctx = this.audioCtx;
    const t = atTime ?? ctx.currentTime;

    if (type === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
      gain.gain.setValueAtTime(0.85, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.connect(gain);
      this._routeOutput(gain);
      osc.start(t);
      osc.stop(t + 0.42);
    } else if (type === 'snare') {
      this._noiseBurst(t, 0.14, 0.45, 1800, 0.8);
      const tone = ctx.createOscillator();
      const toneGain = ctx.createGain();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(220, t);
      tone.frequency.exponentialRampToValueAtTime(160, t + 0.06);
      toneGain.gain.setValueAtTime(0.22, t);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      tone.connect(toneGain);
      this._routeOutput(toneGain);
      tone.start(t);
      tone.stop(t + 0.12);
    } else if (type === 'hihat') {
      this._noiseBurst(t, 0.05, 0.18, 7000, 2.5);
    } else if (type === 'clap') {
      [0, 0.012, 0.024].forEach((off) => {
        this._noiseBurst(t + off, 0.06, 0.28, 2400, 1.2);
      });
    }

    if (this.isRecording && atTime == null) {
      this.recording.push({ kind: 'drum', type, at: t - this.recordStart });
    }
  }

  startRecording() {
    this.recording = [];
    this.isRecording = true;
    this.recordStart = this.audioCtx.currentTime;
  }

  stopRecording() {
    this.isRecording = false;
  }

  playRecording() {
    this.stopAllLoops();
    this.stopBass();
    if (!this.recording.length) return;
    this._resume();
    const t0 = this.audioCtx.currentTime + 0.05;
    this.recording.forEach((ev) => {
      const when = t0 + ev.at;
      if (ev.kind === 'note') this._scheduleNote(when, ev.freq, ev.duration);
      else if (ev.kind === 'bass') this.playBassAt(when, ev.index);
      else if (ev.kind === 'drum') this.playDrumAt(when, ev.type);
    });
  }

  playBassAt(at, index) {
    const ctx = this.audioCtx;
    const freq = BASS_NOTES[index].freq;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    osc.connect(filter);
    filter.connect(gain);
    this._routeOutput(gain);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(0.22, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    osc.start(at);
    osc.stop(at + 0.55);
  }

  playDrumAt(at, type) {
    this.playDrum(type, at);
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

  dispose() {
    this.stopAllLoops();
    this.stopBass();
    if (this.audioCtx.state !== 'closed') this.audioCtx.close().catch(() => {});
  }
}

const BODY_LAYOUT = [
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

export function startMusicCatGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('musicCat');
  const dj = new DJEngine();

  const { body } = createGameScreen({ gameId: 'musicCat', title: '🎧 DJ Люцик', emoji: '🎵', level });

  const stage = document.createElement('div');
  stage.className = 'dj-stage';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'dj-avatar-wrap';
  avatarWrap.innerHTML = avatarImgHtml('lucik', 250, 'dj-avatar-img');

  BODY_LAYOUT.forEach((btn) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'dj-body-btn';
    el.title = BODY_NOTES[btn.key].name;
    el.style.left = `${btn.x}px`;
    el.style.top = `${btn.y}px`;
    el.style.width = `${btn.w}px`;
    el.style.height = `${btn.h}px`;
    let looping = false;

    const startLoop = (e) => {
      e.stopPropagation();
      looping = dj.toggleLoop(btn.key, BODY_NOTES[btn.key].freq);
      el.classList.toggle('active', looping);
    };
    const stopLoop = () => {
      if (looping) {
        dj.stopLoop(btn.key);
        looping = false;
        el.classList.remove('active');
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
    dj.stopBass();
    dj.stopRecording();
  };
  stage.querySelector('#btnPlay').onclick = () => dj.playRecording();
  stage.querySelector('#btnDownload').onclick = () => dj.downloadRecording();

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    dj.dispose();
    appState.gameActive = false;
  }, { once: true });
}

export default { startMusicCatGame };
