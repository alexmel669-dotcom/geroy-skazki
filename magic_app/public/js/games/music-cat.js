import { appState } from '../core.js';
import { createGameScreen, getGameLevel } from './game-ui.js';

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

  const notes = { head: 523, body: 440, leftPaw: 349, rightPaw: 392, tail: 294 };
  const { body, close } = createGameScreen({ gameId: 'musicCat', title: 'Музыкальный кот', emoji: '🎵', level });

  const stage = document.createElement('div');
  stage.className = 'music-stage';
  stage.innerHTML = `
    <div class="spotlight spotlight-left" aria-hidden="true"></div>
    <div class="spotlight spotlight-right" aria-hidden="true"></div>
    <div id="catParts" class="music-lucik-wrap">
      <div class="cat-part music-lucik-part music-part-head" data-note="head" title="Голова"></div>
      <div class="cat-part music-lucik-part music-part-body" data-note="body" title="Тело"></div>
      <div class="cat-part music-lucik-part music-part-paw music-part-paw-left" data-note="leftPaw" title="Лапа"></div>
      <div class="cat-part music-lucik-part music-part-paw music-part-paw-right" data-note="rightPaw" title="Лапа"></div>
      <div class="cat-part music-lucik-part music-part-tail" data-note="tail" title="Хвост"></div>
    </div>
    <button type="button" class="modal-btn music-play-btn" id="playMelody">▶️ Проиграть</button>
  `;
  body.appendChild(stage);

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const melody = [];

  const playNote = (freq) => {
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

  stage.querySelectorAll('.cat-part').forEach((part) => {
    part.addEventListener('click', (e) => {
      const note = notes[part.dataset.note];
      playNote(note);
      melody.push({ note, time: Date.now() });
      part.classList.add('music-part-glow');
      setTimeout(() => part.classList.remove('music-part-glow'), 300);
      const rect = stage.getBoundingClientRect();
      spawnMusicNote(stage, e.clientX - rect.left - 12, e.clientY - rect.top - 24);
    });
  });

  stage.querySelector('#playMelody').addEventListener('click', () => {
    melody.forEach((n, i) => {
      setTimeout(() => playNote(n.note), i * 300);
    });
  });

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    appState.gameActive = false;
  }, { once: true });
}

export default { startMusicCatGame };
