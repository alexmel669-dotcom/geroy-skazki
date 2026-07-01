import { appState } from '../core.js';
import { createGameScreen, getGameLevel } from './game-ui.js';
import { avatarUrl } from '../config.js';

const NOTE_FREQ = { C5: 523, E5: 659, G5: 784, A5: 880 };
const NOTE_EMOJI = ['🎵', '🎶', '♪', '♫'];

function spawnMusicNote(container, x, y) {
  const note = document.createElement('span');
  note.className = 'music-note';
  note.textContent = NOTE_EMOJI[Math.floor(Math.random() * NOTE_EMOJI.length)];
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;
  note.style.color = ['#FFD700', '#FF6B9D', '#7B68EE', '#4ECDC4'][Math.floor(Math.random() * 4)];
  container.appendChild(note);
  setTimeout(() => note.remove(), 2000);
}

export function startMusicCatGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('musicCat');

  const { body } = createGameScreen({ gameId: 'musicCat', title: 'Музыкальный кот', emoji: '🎵', level });

  const stage = document.createElement('div');
  stage.className = 'music-stage';
  stage.style.cssText = 'position:relative;text-align:center;min-height:320px;';
  stage.innerHTML = `
    <div class="spotlight spotlight-left" aria-hidden="true"></div>
    <div class="spotlight spotlight-right" aria-hidden="true"></div>
    <div class="music-avatar-wrap" style="position:relative;display:inline-block;margin:20px auto;">
      <img src="${avatarUrl('lucik', 'png')}" id="musicAvatar" alt="Люцик"
           style="width:200px;height:200px;border-radius:50%;cursor:pointer;
                  box-shadow:0 0 30px rgba(255,215,0,0.5);transition:transform 0.2s,box-shadow 0.2s;">
      <div class="music-parts" style="position:absolute;inset:0;pointer-events:none;">
        <button type="button" class="music-part modal-btn secondary" data-note="C5"
          style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);pointer-events:auto;font-size:0.75rem;">🎵 Лоб</button>
        <button type="button" class="music-part modal-btn secondary" data-note="E5"
          style="position:absolute;top:90px;left:-20px;pointer-events:auto;font-size:0.75rem;">🎵 Левое ухо</button>
        <button type="button" class="music-part modal-btn secondary" data-note="G5"
          style="position:absolute;top:90px;right:-20px;pointer-events:auto;font-size:0.75rem;">🎵 Правое ухо</button>
        <button type="button" class="music-part modal-btn secondary" data-note="A5"
          style="position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);pointer-events:auto;font-size:0.75rem;">🎵 Нос</button>
      </div>
    </div>
    <button type="button" class="modal-btn music-play-btn" id="playMelody">▶️ Проиграть</button>
  `;
  body.appendChild(stage);

  const avatar = stage.querySelector('#musicAvatar');
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const melody = [];

  const pulseAvatar = () => {
    avatar.style.transform = 'scale(1.1)';
    avatar.style.boxShadow = '0 0 50px rgba(255,215,0,0.8)';
    setTimeout(() => {
      avatar.style.transform = 'scale(1)';
      avatar.style.boxShadow = '0 0 30px rgba(255,215,0,0.5)';
    }, 300);
  };

  const playNote = (freq) => {
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.stop(audioCtx.currentTime + 0.5);
  };

  avatar.addEventListener('click', () => {
    playNote(NOTE_FREQ.C5);
    pulseAvatar();
    melody.push({ note: NOTE_FREQ.C5, time: Date.now() });
  });

  stage.querySelectorAll('.music-part').forEach((part) => {
    part.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteKey = part.dataset.note;
      const freq = NOTE_FREQ[noteKey];
      playNote(freq);
      melody.push({ note: freq, time: Date.now() });
      pulseAvatar();
      const rect = stage.getBoundingClientRect();
      spawnMusicNote(stage, e.clientX - rect.left - 12, e.clientY - rect.top - 24);
    });
  });

  stage.querySelector('#playMelody').addEventListener('click', () => {
    melody.forEach((n, i) => {
      setTimeout(() => playNote(n.note), i * 300);
    });
  });
}

export default { startMusicCatGame };
