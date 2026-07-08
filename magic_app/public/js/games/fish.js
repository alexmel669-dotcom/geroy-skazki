import { appState, showGamesMenu } from '../core.js';
import { speak } from '../audio.js';
import { trackEvent } from '../analytics.js';
import { recordGameResult } from '../game-progress.js';
import { updateAchievement, checkProgressAchievements } from '../achievements.js';

const ITEMS = [
  { name: '🐟 Рыбка', emoji: '🐟', points: 10, prob: 0.35, scale: 1.0 },
  { name: '🐠 Немо', emoji: '🐠', points: 30, prob: 0.05, scale: 1.3, rare: true },
  { name: '🦈 Акула', emoji: '🦈', points: 50, prob: 0.02, scale: 2.0, legendary: true },
  { name: '🧜‍♀️ Русалка', emoji: '🧜‍♀️', points: 100, prob: 0.005, scale: 2.5, mythic: true },
  { name: '💀 Сундук', emoji: '💀', points: 75, prob: 0.015, scale: 1.5 },
  { name: '👢 Сапог', emoji: '👢', points: -5, prob: 0.28, scale: 1.0 },
  { name: '🪣 Ведро', emoji: '🪣', points: -3, prob: 0.14, scale: 1.0 },
  { name: '🌿 Трава', emoji: '🌿', points: 0, prob: 0.08, scale: 0.8 }
];

export function startFishGame(level = 1) {
  document.querySelectorAll('.game-fullscreen').forEach((el) => el.remove());
  document.body.classList.remove('game-active');
  appState.gameActive = false;
  appState.gameActive = true;

  const TIME = 30;
  let score = 0;
  let timeLeft = TIME;
  let ended = false;
  let combo = 0;
  let stormActive = false;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  function playSplash() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(400, audioCtx.currentTime);
    o.frequency.setValueAtTime(200, audioCtx.currentTime + 0.1);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    o.start();
    o.stop(audioCtx.currentTime + 0.2);
  }

  function playFanfare() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.15, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        o.start();
        o.stop(audioCtx.currentTime + 0.2);
      }, i * 100);
    });
  }

  const overlay = document.createElement('div');
  overlay.className = 'game-fullscreen';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;display:flex;flex-direction:column;font-family:sans-serif;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:rgba(0,0,0,0.5);color:#fff;font-size:16px;z-index:10;';
  header.innerHTML = `<span>🎣 Рыбалка</span><span>⭐ <b id="fs">0</b></span><span>⏱ <b id="ft">${TIME}</b>с</span><span id="combo" style="color:#FFD700;display:none;">🔥</span><button id="fc" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button>`;

  const pond = document.createElement('div');
  pond.id = 'pond';
  pond.style.cssText = 'flex:1;position:relative;background:linear-gradient(180deg,#1a5276 0%,#154360 30%,#0d1b2a 60%,#0a1628 100%);overflow:hidden;cursor:crosshair;';

  const shine = document.createElement('div');
  shine.style.cssText = 'position:absolute;top:0;left:0;right:0;height:60px;background:linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.05),transparent);animation:shineMove 4s ease-in-out infinite;';
  pond.appendChild(shine);

  const bubbles = document.createElement('div');
  bubbles.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:100%;pointer-events:none;';
  pond.appendChild(bubbles);

  for (let i = 0; i < 5; i++) {
    const weed = document.createElement('div');
    weed.style.cssText = `position:absolute;bottom:0;left:${5 + i * 22}%;width:20px;height:${40 + Math.random() * 60}px;background:linear-gradient(180deg,#2d5a27,#1a3a15);border-radius:40% 40% 0 0;animation:seaweedSway ${3 + Math.random() * 2}s ease-in-out infinite;transform-origin:bottom center;`;
    pond.appendChild(weed);
  }

  overlay.appendChild(header);
  overlay.appendChild(pond);
  document.body.appendChild(overlay);
  document.body.classList.add('game-active');

  const bubbleInterval = setInterval(() => {
    if (ended) return;
    const b = document.createElement('div');
    b.style.cssText = `position:absolute;left:${10 + Math.random() * 80}%;bottom:-10px;width:${4 + Math.random() * 8}px;height:${4 + Math.random() * 8}px;background:rgba(255,255,255,0.3);border-radius:50%;animation:rise ${3 + Math.random() * 3}s linear forwards;`;
    bubbles.appendChild(b);
    setTimeout(() => b.remove(), 6000);
  }, 500);

  function startStorm() {
    if (stormActive || ended) return;
    stormActive = true;
    pond.style.background = 'linear-gradient(180deg,#2c3e50,#1a252f)';
    overlay.style.animation = 'lightning 0.5s ease-in-out 3';
    speak('Шторм! +50% очков!');
    setTimeout(() => {
      stormActive = false;
      pond.style.background = 'linear-gradient(180deg,#1a5276 0%,#154360 30%,#0d1b2a 60%,#0a1628 100%)';
      overlay.style.animation = '';
    }, 8000);
  }

  function randomItem() {
    const r = Math.random();
    let c = 0;
    for (const item of ITEMS) {
      c += item.prob;
      if (r <= c) return item;
    }
    return ITEMS[0];
  }

  function spawnItem() {
    if (ended) return;
    const item = randomItem();
    const size = 38 * item.scale;

    const el = document.createElement('div');
    el.textContent = item.emoji;
    el.style.cssText = `position:absolute;font-size:${size}px;left:${5 + Math.random() * 85}%;top:${15 + Math.random() * 70}%;cursor:pointer;transition:all 0.3s;animation:fishSwim ${2 + Math.random() * 3}s ease-in-out infinite, tailWiggle 0.3s ease-in-out infinite;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.4));`;
    if (item.mythic) el.style.filter = 'drop-shadow(0 0 20px gold)';
    if (item.legendary) el.style.filter = 'drop-shadow(0 0 12px #FF6B6B)';

    el.onclick = (e) => {
      if (ended) return;

      for (let i = 0; i < 6; i++) {
        const drop = document.createElement('div');
        const dx = (Math.random() - 0.5) * 40;
        const dy = (Math.random() - 0.5) * 20;
        drop.style.cssText = `position:fixed;left:${e.clientX + dx}px;top:${e.clientY + dy}px;width:4px;height:4px;background:#7EC8E3;border-radius:50%;animation:splashDrop ${0.3 + Math.random() * 0.3}s ease-out forwards;pointer-events:none;z-index:1500;--dx:${dx}px;--dy:${dy}px;`;
        document.body.appendChild(drop);
        setTimeout(() => drop.remove(), 600);
      }

      const points = stormActive ? Math.floor(item.points * 1.5) : item.points;
      score = Math.max(0, score + points);
      if (points > 0) {
        combo++;
        if (combo >= 3) score += combo * 2;
      } else {
        combo = 0;
      }

      document.getElementById('fs').textContent = score;
      const comboEl = document.getElementById('combo');
      if (combo >= 3) {
        comboEl.style.display = 'inline';
        comboEl.textContent = `🔥x${combo}`;
      } else {
        comboEl.style.display = 'none';
      }

      playSplash();
      if (item.mythic || item.legendary) {
        playFanfare();
        overlay.style.filter = 'brightness(1.3)';
        setTimeout(() => { overlay.style.filter = ''; }, 1500);
      }

      el.style.transform = 'scale(1.6)';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
      speak(`${item.name}! ${points >= 0 ? '+' : ''}${points}`);
    };

    pond.appendChild(el);
    setTimeout(() => { if (!ended && el.parentNode) el.remove(); }, 4000 + Math.random() * 2000);
  }

  for (let i = 0; i < 10; i++) spawnItem();
  const spawnInterval = setInterval(spawnItem, 1200);

  const timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('ft').textContent = timeLeft;
    if (timeLeft <= 0) finish();
  }, 1000);

  const stormInterval = setInterval(() => {
    if (Math.random() < 0.08) startStorm();
  }, 15000);

  function cleanup() {
    clearInterval(spawnInterval);
    clearInterval(timerInterval);
    clearInterval(stormInterval);
    clearInterval(bubbleInterval);
    audioCtx.close();
  }

  function finish() {
    if (ended) return;
    ended = true;
    appState.gameActive = false;
    cleanup();
    document.body.classList.remove('game-active');
    overlay.remove();

    recordGameResult('fish', true, level);
    updateAchievement('fish_master');
    checkProgressAchievements();
    trackEvent('fish_end', { level, score });

    const best = Math.max(+(localStorage.getItem('fish-best') || 0), score);
    localStorage.setItem('fish-best', String(best));
    window.leaderboard?.submitScore('fish', score);

    const result = document.createElement('div');
    result.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;';
    result.innerHTML = `
      <div style="background:linear-gradient(135deg,#fff,#e8f4f8);border-radius:20px;padding:clamp(20px,5vw,40px);text-align:center;max-width:90vw;width:320px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="font-size:48px;">🎣</div>
        <h2 style="margin:12px 0;">Улов!</h2>
        <p style="font-size:clamp(24px,6vw,36px);">⭐ ${score}</p>
        <p style="color:#666;">🏆 Рекорд: ${best}</p>
        <button id="fr" style="margin:8px;padding:12px 24px;border-radius:12px;border:none;background:#1a5276;color:#fff;font-size:16px;cursor:pointer;width:80%;">🔄 Ещё раз</button>
        <button id="fe" style="margin:8px;padding:12px 24px;border-radius:12px;border:2px solid #ddd;background:#fff;color:#666;font-size:16px;cursor:pointer;width:80%;">🚪 Выйти</button>
      </div>
    `;
    document.body.appendChild(result);
    result.querySelector('#fr').onclick = () => { result.remove(); startFishGame(level); };
    result.querySelector('#fe').onclick = () => { result.remove(); showGamesMenu(); };
  }

  document.getElementById('fc').onclick = () => {
    cleanup();
    appState.gameActive = false;
    document.body.classList.remove('game-active');
    overlay.remove();
  };

  trackEvent('fish_started', { level });
}

export default { startFishGame };
