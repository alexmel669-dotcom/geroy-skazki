import { appState } from '../core.js';
import { createGameScreen, getGameLevel } from './game-ui.js';

export function startMusicCatGame(level) {
  if (appState.gameActive) return;
  appState.gameActive = true;
  level = level || getGameLevel('musicCat');

  const notes = { head: 523, body: 440, leftPaw: 349, rightPaw: 392, tail: 294 };
  const { body, close } = createGameScreen({ gameId: 'musicCat', title: 'Музыкальный кот', emoji: '🎵', level });

  const wrap = document.createElement('div');
  wrap.style.textAlign = 'center';
  wrap.innerHTML = `
    <div id="catParts" style="position:relative;width:200px;height:280px;margin:0 auto;">
      <div class="cat-part" data-note="head" style="position:absolute;top:0;left:60px;width:80px;height:80px;background:#FF8C00;border-radius:50%;cursor:pointer;"></div>
      <div class="cat-part" data-note="body" style="position:absolute;top:90px;left:40px;width:120px;height:120px;background:#FF8C00;border-radius:40px;cursor:pointer;"></div>
      <div class="cat-part" data-note="leftPaw" style="position:absolute;top:180px;left:20px;width:40px;height:60px;background:#FF8C00;border-radius:20px;cursor:pointer;"></div>
      <div class="cat-part" data-note="rightPaw" style="position:absolute;top:180px;right:20px;width:40px;height:60px;background:#FF8C00;border-radius:20px;cursor:pointer;"></div>
    </div>
    <button type="button" class="modal-btn" id="playMelody" style="margin-top:16px;">▶️ Проиграть</button>
  `;
  body.appendChild(wrap);

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

  wrap.querySelectorAll('.cat-part').forEach((part) => {
    part.addEventListener('click', () => {
      const note = notes[part.dataset.note];
      playNote(note);
      melody.push({ note, time: Date.now() });
    });
  });

  wrap.querySelector('#playMelody').addEventListener('click', () => {
    melody.forEach((n, i) => {
      setTimeout(() => playNote(n.note), i * 300);
    });
  });

  body.querySelector('.game-close-btn')?.addEventListener('click', () => {
    appState.gameActive = false;
  }, { once: true });
}

export default { startMusicCatGame };
