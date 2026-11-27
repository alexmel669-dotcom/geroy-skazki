import { addResultActions } from './runner-card.js';

// Курс строится в метрах: размеры экрана и частота кадров не влияют на трассу.
const LENGTH = 1000;
const DURATION = 45000;
const JUMP_MS = 850;
const X = 74;
const GROUND = 210;
const SCALE = 8;

export function challengeSeed(search) {
  const raw = new URLSearchParams(search).get('challenge');
  if (!/^\d{1,10}$/.test(raw ?? '')) return null;
  const value = Number(raw);
  return value <= 0xffffffff ? value : null;
}

export function buildChallengeCourse(seed) {
  let state = seed;
  function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  }
  const items = [];
  for (let meter = 20; meter < LENGTH - 5; meter += 18 + Math.floor(random() * 15)) {
    const obstacle = random() < 0.42;
    items.push({ meter, obstacle, high: !obstacle && random() < 0.5 });
  }
  return items;
}

export function playChallenge(seed, onExit) {
  const course = buildChallengeCourse(seed);
  const root = document.createElement('section');
  root.className = 'runner-quick';
  root.setAttribute('aria-label', 'Быстрый забег');
  root.innerHTML = `
    <header><strong>⚡ Быстрый забег</strong><button type="button" class="runner-btn ghost">Выйти</button></header>
    <p class="quick-stats"></p>
    <canvas width="640" height="270" aria-label="Люцик бежит. Нажмите для прыжка"></canvas>
    <p>Касание или пробел — прыжок. Собирайте звёзды, перепрыгивайте камни.</p>
    <div class="quick-finish" hidden><strong>Герой · Приключение завершено!</strong>
      <button type="button" class="runner-btn primary">Повторить эту трассу</button></div>`;
  document.body.appendChild(root);
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const stats = root.querySelector('.quick-stats');
  const finish = root.querySelector('.quick-finish');
  const frames = Array.from({ length: 4 }, (_, i) => {
    const sprite = new Image();
    sprite.src = 'assets/images/lucik-run-' + (i + 1) + '.png';
    return sprite;
  });
  const background = new Image();
  background.src = 'assets/images/world-forest.png';
  let elapsed = 0, stars = 0, nextItem = 0;
  let jumpedAt = -JUMP_MS;
  let last = null, raf = null;

  function height(ms) {
    const t = (ms - jumpedAt) / JUMP_MS;
    return t >= 0 && t < 1 ? 300 * t * (1 - t) : 0;
  }

  function draw(meters) {
    ctx.fillStyle = '#123636';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (background.naturalWidth) ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#355b47';
    ctx.fillRect(0, GROUND, canvas.width, canvas.height - GROUND);
    const y = GROUND - height(elapsed);
    const sprite = frames[Math.floor(elapsed / 110) % frames.length];
    if (sprite.naturalWidth) ctx.drawImage(sprite, X - 25, y - 50, 50, 50);
    else { ctx.font = '36px sans-serif'; ctx.fillText('🐱', X - 20, y); }
    for (const item of course.slice(nextItem)) {
      const x = X + (item.meter - meters) * SCALE;
      if (x > canvas.width + 20) break;
      ctx.font = '28px sans-serif';
      ctx.fillText(item.obstacle ? '🪨' : '⭐', x - 14, GROUND - (item.high ? 66 : 2));
    }
    stats.textContent = Math.floor(meters) + '/1000 м · ⭐ ' + stars + ' · ' +
      Math.ceil((DURATION - elapsed) / 1000) + ' с · Трасса ' + seed;
  }

  function tick(now) {
    if (last !== null) elapsed = Math.min(DURATION, elapsed + now - last);
    last = now;
    const meters = LENGTH * elapsed / DURATION;
    while (nextItem < course.length && course[nextItem].meter <= meters) {
      const item = course[nextItem++];
      const jumpHeight = height(item.meter * DURATION / LENGTH);
      if (item.obstacle && jumpHeight < 24) stars = Math.max(0, stars - 1);
      if (!item.obstacle && Math.abs(jumpHeight - (item.high ? 66 : 0)) < 28) stars++;
    }
    draw(meters);
    if (elapsed < DURATION) raf = requestAnimationFrame(tick);
    else {
      raf = null;
      addResultActions(finish, { meters: LENGTH, stars, seed });
      finish.hidden = false;
    }
  }

  function jump() {
    if (elapsed < DURATION && elapsed - jumpedAt >= JUMP_MS) jumpedAt = elapsed;
  }
  function keydown(e) {
    if (e.target instanceof HTMLButtonElement || !['Space', 'ArrowUp', 'KeyW'].includes(e.code)) return;
    e.preventDefault();
    if (!e.repeat) jump();
  }
  function visibility() {
    last = null;
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    if (!document.hidden && elapsed < DURATION) raf = requestAnimationFrame(tick);
  }
  function close() {
    if (raf !== null) cancelAnimationFrame(raf);
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('visibilitychange', visibility);
    root.remove();
  }
  root.querySelector('header button').onclick = () => { close(); onExit(); };
  finish.querySelector('button').onclick = () => { close(); playChallenge(seed, onExit); };
  canvas.onpointerdown = jump;
  document.addEventListener('keydown', keydown);
  document.addEventListener('visibilitychange', visibility);
  draw(0);
  visibility();
}
