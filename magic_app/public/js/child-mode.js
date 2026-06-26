import { CHARACTERS } from './config.js';

export function initChildModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const childToken = params.get('child_token');

  if (childToken) {
    localStorage.setItem('userToken', childToken);
    localStorage.setItem('isAuth', 'true');
    localStorage.setItem('childMode', 'true');
    localStorage.setItem('guestMode', 'false');
    document.cookie = `token=${childToken}; Path=/; Max-Age=2592000; SameSite=Lax`;
    window.history.replaceState({}, '', '/app.html');
  }

  if (localStorage.getItem('childMode') === 'true') {
    document.body.classList.add('child-mode');
    hideParentAccess();
    applyChildTokenProfile();
  }
}

function hideParentAccess() {
  document.querySelectorAll('.parent-access, .settings-btn, .logout-btn').forEach((el) => {
    el.style.display = 'none';
  });
}

function applyChildTokenProfile() {
  try {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.childName) {
      const children = [{
        name: payload.childName,
        age: payload.childAge || 7,
        avatar: payload.childAvatar || 'kid1.svg',
        avatarRole: payload.childAvatar?.includes('kid2') ? 'kid2' : 'kid1',
        gender: payload.childAvatar?.includes('kid2') ? 'male' : 'female',
        index: payload.childIndex || 0
      }];
      localStorage.setItem('children', JSON.stringify(children));
      localStorage.setItem('activeChildIndex', '0');
      localStorage.setItem('childrenNames', payload.childName);
    }
  } catch {
    /* ignore malformed token */
  }
}

export default { initChildModeFromUrl, hideParentAccess };
