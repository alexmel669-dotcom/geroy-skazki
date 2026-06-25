import { getChildren, setActiveChild, getActiveChildIndex } from './core.js';
import { playPurrSound } from './ui.js';

export function initChildSwipe(avatarEl) {
  if (!avatarEl) return;
  let startX = 0;

  avatarEl.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  avatarEl.addEventListener('touchend', (e) => {
    const children = getChildren();
    if (children.length < 2) return;

    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) <= 50) return;

    let idx = getActiveChildIndex();
    if (idx < 0) idx = 0;

    if (diff > 0) {
      idx = (idx - 1 + children.length) % children.length;
    } else {
      idx = (idx + 1) % children.length;
    }
    setActiveChild(idx, { greet: true });
    playPurrSound();
  });
}

export default { initChildSwipe };
