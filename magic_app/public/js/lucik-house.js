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

export function applyHouseDirtVisual(roomEl, level = getHouseDirtLevel()) {
  if (!roomEl) return;
  if (level <= 0) {
    roomEl.style.filter = 'none';
    roomEl.style.opacity = '1';
    return;
  }
  if (level >= 4) {
    roomEl.style.filter = 'sepia(0.5) blur(1px)';
    roomEl.style.opacity = '0.7';
  } else if (level >= 2) {
    roomEl.style.filter = 'sepia(0.35)';
    roomEl.style.opacity = '0.85';
  } else {
    roomEl.style.filter = 'sepia(0.15)';
    roomEl.style.opacity = '1';
  }
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
  if (room) {
    room.style.filter = 'none';
    room.style.opacity = '1';
  }

  window.ttsEngine?.speak('Как чисто! Какой порядок! Молодец!');
}
