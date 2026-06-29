// avatar.js — загрузка SVG/PNG и текстовый fallback
import { CHARACTERS, getAvatarPaths } from './config.js';

export function setAvatarImage(imgEl, charId) {
  if (!imgEl) return;
  const role = charId || imgEl.dataset?.avatar || 'lucik';
  const char = CHARACTERS[role] || CHARACTERS.lucik;
  const paths = getAvatarPaths(role);

  imgEl.classList.add('character-avatar');

  const container = imgEl.closest('.avatar-container');
  const emojiEl = container?.querySelector('#avatarEmoji');
  let fallbackEl = container?.querySelector('.avatar-fallback:not(#avatarEmoji)');

  const showLetterFallback = () => {
    imgEl.style.display = 'none';
    const letter = paths.letter || (char.name || 'Л')[0];
    if (emojiEl) {
      emojiEl.textContent = letter;
      emojiEl.classList.add('avatar-fallback');
      emojiEl.style.display = 'flex';
      return;
    }
    if (!fallbackEl && container) {
      fallbackEl = document.createElement('span');
      fallbackEl.className = 'avatar-fallback character-avatar';
      container.appendChild(fallbackEl);
    }
    if (fallbackEl) {
      fallbackEl.textContent = letter;
      fallbackEl.style.display = 'flex';
    }
  };

  const hideFallbacks = () => {
    if (emojiEl && !emojiEl.dataset.keepEmoji) emojiEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'none';
    imgEl.style.display = imgEl.classList.contains('avatar') ? 'block' : '';
  };

  imgEl.onload = () => hideFallbacks();

  imgEl.onerror = () => {
    if (imgEl.dataset.avatarStage !== 'png') {
      imgEl.dataset.avatarStage = 'png';
      imgEl.src = paths.png;
      return;
    }
    if (emojiEl && char.emoji) {
      imgEl.style.display = 'none';
      emojiEl.textContent = char.emoji;
      emojiEl.style.display = 'flex';
      return;
    }
    showLetterFallback();
  };

  imgEl.dataset.avatarStage = '';
  imgEl.src = paths.svg;
  imgEl.alt = char.name;
}

export function initAllAvatarImages(root = document) {
  root.querySelectorAll('img[data-avatar], .header-avatar, .avatar-img, .auth-avatar img, .child-chip-avatar').forEach((img) => {
    if (img.dataset.avatarReady) return;
    const role = img.dataset.avatar || 'lucik';
    if (img.id !== 'avatar') setAvatarImage(img, role);
    img.dataset.avatarReady = '1';
  });
}

export default { setAvatarImage, initAllAvatarImages };
