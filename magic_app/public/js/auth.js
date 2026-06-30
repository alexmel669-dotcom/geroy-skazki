import { initAvatarImages } from './config.js';

const API_BASE = '/api';

const ERROR_MESSAGES = {
  'Invalid credentials': 'Неверный email или пароль',
  'Email and password required': 'Введите email и пароль',
  'User already exists': 'Этот email уже зарегистрирован',
  'Password must be at least 6 characters': 'Пароль должен быть не менее 6 символов',
  'Internal server error': 'Ошибка сервера. Попробуйте позже'
};

function translateError(msg) {
  return ERROR_MESSAGES[msg] || msg;
}

// Проверка авторизации
export async function checkAuth() {
  const guestMode = localStorage.getItem('guestMode');
  if (guestMode === 'true') {
    console.log('👤 Гостевой режим');
    return true;
  }

  const cookieToken = getCookie('token');
  const savedToken = localStorage.getItem('userToken');
  const token = cookieToken || savedToken;

  if (!token) {
    clearAuthData();
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/verify-token`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.valid) {
        console.log('✅ Токен валиден');
        localStorage.setItem('isAuth', 'true');
        localStorage.setItem('userToken', token);
        if (data.user?.plan) localStorage.setItem('userPlan', data.user.plan);
        if (data.user?.planExpiry) localStorage.setItem('planExpiry', data.user.planExpiry);
        if (data.user?.promocodeUsed) localStorage.setItem('promocodeUsed', data.user.promocodeUsed);
        if (data.user?.parentName) localStorage.setItem('parentName', data.user.parentName);
        return true;
      }
    }

    console.log('❌ Токен невалиден');
    clearAuthData();
    return false;
  } catch (error) {
    console.warn('Auth check failed (offline):', error.message);
    const wasAuth = localStorage.getItem('isAuth') === 'true';
    if (wasAuth && savedToken) {
      console.log('Offline mode: using saved session');
      return true;
    }
    return false;
  }
}

// Функция входа
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  const errorEl = document.getElementById('loginError');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  // Валидация
  if (!email || !password) {
    showError(errorEl, 'Заполни все поля!');
    return;
  }
  
  if (!isValidEmail(email)) {
    showError(errorEl, 'Введи правильный email!');
    return;
  }
  
  // Блокируем кнопку
  setButtonLoading(submitBtn, true);
  hideError(errorEl);
  
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Вход выполнен');
      localStorage.setItem('isAuth', 'true');
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userEmail', data.user?.email || email);
      localStorage.setItem('guestMode', 'false');
      if (data.user?.plan) localStorage.setItem('userPlan', data.user.plan);
      if (data.user?.planExpiry) localStorage.setItem('planExpiry', data.user.planExpiry);
      else localStorage.removeItem('planExpiry');
      if (data.user?.promocodeUsed) localStorage.setItem('promocodeUsed', data.user.promocodeUsed);
      else localStorage.removeItem('promocodeUsed');
      if (data.user?.role) localStorage.setItem('userRole', data.user.role);
      if (data.user?.parentName) localStorage.setItem('parentName', data.user.parentName);
      if (data.user?.children?.length) {
        localStorage.setItem('children', JSON.stringify(data.user.children));
        localStorage.setItem('childrenNames', data.user.children.map(c => c.name).join(', '));
        localStorage.setItem('activeChildIndex', data.user.children.length > 1 ? '-1' : '0');
      }
      const redirect = new URLSearchParams(window.location.search).get('redirect');
      window.location.href = redirect === 'parent' ? '/parent.html' : '/app.html';
    } else {
      showError(errorEl, translateError(data.error) || 'Ошибка входа');
    }
  } catch (error) {
    console.error('Login error:', error);
    showError(errorEl, 'Ошибка сети. Проверь интернет.');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

// Функция регистрации
async function handleRegister(e) {
  e.preventDefault();
  
  const email = document.getElementById('regEmail')?.value.trim();
  const password = document.getElementById('regPassword')?.value;
  const confirm = document.getElementById('regPasswordConfirm')?.value;
  const errorEl = document.getElementById('regError');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  // Валидация
  if (!email || !password || !confirm) {
    showError(errorEl, 'Заполни все поля!');
    return;
  }
  
  if (!isValidEmail(email)) {
    showError(errorEl, 'Введи правильный email!');
    return;
  }
  
  if (password.length < 6) {
    showError(errorEl, 'Пароль должен быть минимум 6 символов');
    return;
  }
  
  if (password !== confirm) {
    showError(errorEl, 'Пароли не совпадают!');
    return;
  }
  
  setButtonLoading(submitBtn, true);
  hideError(errorEl);
  
  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Регистрация успешна');
      localStorage.setItem('isAuth', 'true');
      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userEmail', data.user?.email || email);
      localStorage.setItem('guestMode', 'false');
      if (data.user?.plan) localStorage.setItem('userPlan', data.user.plan || 'free');
      window.location.href = '/app.html';
    } else {
      showError(errorEl, translateError(data.error) || 'Ошибка регистрации');
    }
  } catch (error) {
    console.error('Register error:', error);
    showError(errorEl, 'Ошибка сети. Проверь интернет.');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

// Выход
export async function logout() {
  try {
    const response = await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    console.log('🚪 Выход выполнен');
  } catch (error) {
    console.warn('Logout error:', error);
  } finally {
    clearAuthData();
    window.location.href = '/login.html';
  }
}

// Вспомогательные функции
function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.style.display = 'block';
  element.style.animation = 'none';
  element.offsetHeight; // reflow
  element.style.animation = 'slideUp 0.3s';
}

function hideError(element) {
  if (!element) return;
  element.style.display = 'none';
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Загрузка...' : button.getAttribute('data-original-text') || button.textContent;
  if (!isLoading) {
    button.setAttribute('data-original-text', button.textContent);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showPasswordReset() {
  const panel = document.getElementById('passwordReset');
  const form = document.getElementById('loginForm');
  if (panel) panel.style.display = 'block';
  if (form) form.style.display = 'none';
  document.getElementById('forgotPasswordLink')?.style.setProperty('display', 'none');
}

async function getSecretQuestion() {
  const email = document.getElementById('resetEmail')?.value.trim();
  const errorEl = document.getElementById('resetError');
  hideError(errorEl);

  if (!email || !isValidEmail(email)) {
    showError(errorEl, 'Введите корректный email');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/get-secret-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await response.json();
    const textEl = document.getElementById('secretQuestionText');
    const step2 = document.getElementById('resetStep2');
    if (textEl) textEl.textContent = data.question || 'Кличка вашего первого питомца?';
    if (step2) step2.style.display = 'block';
  } catch {
    showError(errorEl, 'Ошибка сети. Проверьте интернет.');
  }
}

async function resetPassword() {
  const email = document.getElementById('resetEmail')?.value.trim();
  const secretAnswer = document.getElementById('secretAnswerInput')?.value.trim();
  const newPassword = document.getElementById('newPassword')?.value;
  const errorEl = document.getElementById('resetError');
  hideError(errorEl);

  if (!email || !secretAnswer || !newPassword) {
    showError(errorEl, 'Заполните все поля');
    return;
  }
  if (newPassword.length < 6) {
    showError(errorEl, 'Пароль должен быть не менее 6 символов');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, secretAnswer, newPassword })
    });
    const data = await response.json();
    if (response.ok) {
      alert(data.message || 'Пароль изменён. Теперь можно войти.');
      window.location.href = '/login.html';
    } else {
      showError(errorEl, data.error || 'Не удалось сменить пароль');
    }
  } catch {
    showError(errorEl, 'Ошибка сети. Проверьте интернет.');
  }
}

function clearAuthData() {
  const fixedKeys = [
    'isAuth', 'userToken', 'userEmail', 'userRole', 'userPlan', 'planExpiry',
    'promocodeUsed', 'isPremium', 'guestMode', 'parentName', 'parentPinOk',
    'children', 'childrenNames', 'activeChildIndex', 'profileChildName', 'profileChildAge',
    'profileComplete', 'parentConcerns', 'parentAlerts', 'childMode', 'currentCharacter',
    'lastAppVisit', 'geroy-last-visit', 'geroy-streak', 'analytics_events', 'error_log'
  ];
  fixedKeys.forEach((k) => localStorage.removeItem(k));
  Object.keys(localStorage).forEach((k) => {
    if (/^(stats_|chatHistory_|gameProgress_|planCounters|geroy-notif-|notificationSettings)/.test(k)) {
      localStorage.removeItem(k);
    }
  });
  sessionStorage.removeItem('parentPinOk');
  sessionStorage.removeItem('admin-token');
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Инициализация обработчиков форм
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initAvatarImages();
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
      const btn = loginForm.querySelector('button[type="submit"]');
      if (btn) btn.setAttribute('data-original-text', btn.textContent);
    }

    document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      showPasswordReset();
    });
    document.getElementById('getSecretQuestionBtn')?.addEventListener('click', getSecretQuestion);
    document.getElementById('resetPasswordBtn')?.addEventListener('click', resetPassword);

    window.showPasswordReset = showPasswordReset;
    window.getSecretQuestion = getSecretQuestion;
    window.resetPassword = resetPassword;

    if (registerForm && !document.getElementById('child1Name')) {
      registerForm.addEventListener('submit', handleRegister);
      const btn = registerForm.querySelector('button[type="submit"]');
      if (btn) btn.setAttribute('data-original-text', btn.textContent);
    }

    // Синхронизация cookie-токена в localStorage для кнопки выхода
    const cookieToken = getCookie('token');
    if (cookieToken && !localStorage.getItem('userToken')) {
      localStorage.setItem('userToken', cookieToken);
    }
  });
}
