export function getHouseDirtLevel() {
  const lastCleaned = localStorage.getItem('geroy-house-cleaned');
  if (!lastCleaned) return 0;
  const daysSince = Math.floor((Date.now() - new Date(lastCleaned)) / 86400000);
  return Math.min(daysSince, 5);
}

export function getDirtEmoji(level) {
  const emojis = ['✨', '🌿', '🕸️', '💨', '👾'];
  return emojis[level] || '👾';
}

function clearDirtDecor(roomEl) {
  roomEl?.querySelectorAll('.spider-web, .dust-particles').forEach((el) => el.remove());
}

function addSpiderWeb(container) {
  if (!container || container.querySelector('.spider-web')) return;
  const web = document.createElement('div');
  web.className = 'spider-web';
  web.innerHTML = '🕸️';
  web.style.cssText = 'position:absolute;top:5px;right:5px;font-size:28px;opacity:0.5;z-index:10;pointer-events:none;';
  container.appendChild(web);
}

function addDust(container) {
  if (!container || container.querySelector('.dust-particles')) return;
  const dust = document.createElement('div');
  dust.className = 'dust-particles';
  dust.innerHTML = '💨';
  dust.style.cssText = 'position:absolute;bottom:15px;left:15px;font-size:22px;opacity:0.4;z-index:10;animation:float 3s ease-in-out infinite;pointer-events:none;';
  container.appendChild(dust);
}

function applyDirtToRoom(room, level) {
  if (!room) return;
  room.style.position = 'relative';
  clearDirtDecor(room);

  switch (level) {
    case 0:
      room.style.filter = 'none';
      room.style.opacity = '1';
      break;
    case 1:
      room.style.filter = 'brightness(0.95) saturate(0.9)';
      room.style.opacity = '1';
      break;
    case 2:
      room.style.filter = 'brightness(0.85) saturate(0.7) sepia(0.2)';
      room.style.opacity = '1';
      addSpiderWeb(room);
      break;
    case 3:
      room.style.filter = 'brightness(0.75) saturate(0.5) sepia(0.4)';
      room.style.opacity = '1';
      addSpiderWeb(room);
      addDust(room);
      break;
    default:
      room.style.filter = 'brightness(0.65) saturate(0.4) sepia(0.5)';
      room.style.opacity = '1';
      addSpiderWeb(room);
      addDust(room);
  }
}

export function applyHouseDirtVisual(roomEl, level = getHouseDirtLevel()) {
  const room = roomEl || document.getElementById('houseRoom');
  applyDirtToRoom(room, level);
}

export function updateHouseButton() {
  const btn = document.getElementById('houseBtn');
  if (!btn) return;

  const level = getHouseDirtLevel();
  const emoji = getDirtEmoji(level);

  btn.textContent = `🏠${emoji}`;

  if (level >= 3) {
    btn.style.animation = 'dirtShake 1s infinite';
    const warnKey = 'geroy-dirt-warned-' + new Date().toISOString().split('T')[0];
    if (!localStorage.getItem(warnKey)) {
      window.ttsEngine?.speak('Ой, какой беспорядок! Давай приберёмся?');
      localStorage.setItem(warnKey, '1');
    }
  } else {
    btn.style.animation = '';
  }
}

export function cleanHouse() {
  localStorage.setItem('geroy-house-cleaned', new Date().toISOString());
  updateHouseButton();

  const room = document.getElementById('houseRoom');
  if (room) applyDirtToRoom(room, 0);

  window.ttsEngine?.speak('Как чисто! Какой порядок! Молодец!');
}
