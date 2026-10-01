// ========================================
// psychologist-dashboard.js — кабинет психолога
// ========================================


import { apiFetch } from './api-base.js';
const STORAGE_EMAIL = 'psyEmail';
const STORAGE_TOKEN = 'userToken';

let state = {
  email: localStorage.getItem(STORAGE_EMAIL) || localStorage.getItem('userEmail') || '',
  token: localStorage.getItem(STORAGE_TOKEN) || '',
  slots: [],
  activeChatParent: null,
  chatPoll: null
};

function authHeaders(json = true) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (state.token) {
    headers.Authorization = state.token.startsWith('Bearer ')
      ? state.token
      : `Bearer ${state.token}`;
  }
  return headers;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showApply() {
  const apply = document.getElementById('psyApplySection');
  const login = document.getElementById('psyLogin');
  const dash = document.getElementById('psyDashboard');
  if (apply) apply.hidden = false;
  if (login) login.hidden = true;
  if (dash) dash.hidden = true;
  if (state.chatPoll) {
    clearInterval(state.chatPoll);
    state.chatPoll = null;
  }
}

function showLogin() {
  document.getElementById('psyApplySection') && (document.getElementById('psyApplySection').hidden = true);
  document.getElementById('psyLogin').hidden = false;
  document.getElementById('psyDashboard').hidden = true;
  if (state.chatPoll) {
    clearInterval(state.chatPoll);
    state.chatPoll = null;
  }
}

function showDashboard() {
  document.getElementById('psyApplySection') && (document.getElementById('psyApplySection').hidden = true);
  document.getElementById('psyLogin').hidden = true;
  document.getElementById('psyDashboard').hidden = false;
}

async function checkPsychologistAccess() {
  const token = localStorage.getItem(STORAGE_TOKEN);
  if (!token) {
    showApply();
    return false;
  }

  try {
    const res = await apiFetch('/api/verify-token', {
      headers: {
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!data.valid || data.user?.role !== 'psychologist') {
      alert('Доступ только для психологов-партнёров');
      showApply();
      location.hash = 'apply';
      return false;
    }

    state.token = token;
    state.email = data.user?.email || state.email;
    localStorage.setItem(STORAGE_EMAIL, state.email);
    localStorage.setItem('userRole', 'psychologist');
    showDashboard();
    await loadAll();
    return true;
  } catch {
    showApply();
    return false;
  }
}

async function psyLogin() {
  const email = document.getElementById('psyEmail')?.value.trim().toLowerCase();
  const password = document.getElementById('psyPassword')?.value;
  const errEl = document.getElementById('psyLoginError');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = 'Введите email и пароль';
    return;
  }

  const btn = document.getElementById('psyLoginBtn');
  btn.disabled = true;
  btn.textContent = 'Вход…';

  try {
    const res = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Неверный логин или пароль';
      return;
    }

    if (data.user?.role !== 'psychologist') {
      errEl.textContent = 'Доступ только для психологов-партнёров';
      return;
    }

    state.token = data.token || localStorage.getItem(STORAGE_TOKEN) || '';
    state.email = data.user?.email || email;
    localStorage.setItem(STORAGE_TOKEN, state.token);
    localStorage.setItem(STORAGE_EMAIL, state.email);
    localStorage.setItem('userEmail', state.email);
    localStorage.setItem('isAuth', 'true');
    localStorage.setItem('userRole', 'psychologist');

    showDashboard();
    await loadAll();
  } catch {
    errEl.textContent = 'Ошибка сети';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Войти';
  }
}

function psyLogout() {
  state = { email: '', token: '', slots: [], activeChatParent: null, chatPoll: null };
  localStorage.removeItem(STORAGE_EMAIL);
  showApply();
}

function switchTab(tab) {
  document.querySelectorAll('.psy-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.psy-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });
  if (tab === 'chat' && state.activeChatParent) loadChatMessages();
  if (tab === 'bookings') loadBookings();
  if (tab === 'reviews') loadReviews();
  if (tab === 'slots') loadSlots();
  if (tab === 'clients') loadDashboard().then((d) => d && renderStats(d)).catch(() => {});
}

async function loadDashboard() {
  const res = await apiFetch(`/api/psychologist-dashboard?email=${encodeURIComponent(state.email)}`, {
    headers: authHeaders(false)
  });
  if (res.status === 403 || res.status === 401) {
    document.getElementById('psyLoginError').textContent =
      'Нет доступа. Аккаунт должен быть в списке психологов-партнёров.';
    showLogin();
    return null;
  }
  if (!res.ok) throw new Error('dashboard failed');
  return res.json();
}

function renderStats(data) {
  document.getElementById('psyGreeting').textContent = `Здравствуйте, ${data.name || 'коллега'}!`;
  document.getElementById('psyPromoCode').textContent = data.promoCode || '—';
  document.getElementById('statClients').textContent = data.totalClients ?? 0;
  document.getElementById('statChats').textContent = data.activeChats ?? 0;
  document.getElementById('statBookings').textContent = data.bookingsThisWeek ?? 0;
  document.getElementById('statRating').textContent = data.averageRating ?? '0';
  document.getElementById('statEarned').textContent = `${data.totalEarned ?? 0}₽`;

  let promoBox = document.getElementById('psyPromoCodesBox');
  if (!promoBox) {
    promoBox = document.createElement('div');
    promoBox.id = 'psyPromoCodesBox';
    promoBox.className = 'psy-promo-box';
    const grid = document.getElementById('psyStatGrid');
    grid?.parentElement?.insertBefore(promoBox, grid.nextSibling);
  }
  promoBox.innerHTML = `
    <h3>🔗 Ваши промокоды</h3>
    <p><strong>Ваш код:</strong> <code>${escapeHtml(data.promoCode || '—')}</code></p>
    <p><strong>Код для клиентов:</strong> <code>${escapeHtml(data.clientPromoCode || '—')}</code></p>
    <p class="psy-promo-hint">Дайте клиентский код родителям — они получат Premium, а вы увидите их в дашборде.</p>
  `;

  const upcoming = document.getElementById('psyUpcoming');
  const list = data.upcomingBookings || [];
  upcoming.innerHTML = list.length
    ? list.map((b) => `
        <div class="psy-card">
          <strong>${escapeHtml(b.date)} ${escapeHtml(b.time)}</strong>
          <div>${escapeHtml(b.parentName || b.parentEmail)} · ${escapeHtml(b.childName || 'ребёнок')}</div>
          ${b.concern ? `<small>${escapeHtml(b.concern)}</small>` : ''}
        </div>
      `).join('')
    : '<p class="psy-empty">Пока нет записей</p>';

  const clients = document.getElementById('psyClients');
  const recent = data.recentClients || [];
  clients.innerHTML = recent.length
    ? recent.map((c) => {
        const parentEmail = String(c.userEmail || c.email || '').toLowerCase();
        return `
        <div class="psy-card">
          <strong>${escapeHtml(c.parentName || parentEmail || 'Клиент')}</strong>
          <small>${escapeHtml(c.activatedAt ? new Date(c.activatedAt).toLocaleDateString('ru-RU') : '')}</small>
          <div class="psy-card-actions">
            ${parentEmail ? `<button type="button" class="psy-btn psy-btn-secondary" data-open-chat="${escapeHtml(parentEmail)}">Открыть чат</button>` : ''}
            ${parentEmail ? `<button type="button" class="psy-btn psy-btn-ghost" data-child-stats="${escapeHtml(parentEmail)}">📊 Данные ребёнка</button>` : ''}
          </div>
          <div class="psy-child-stats" data-stats-for="${escapeHtml(parentEmail)}" hidden></div>
        </div>
      `;
      }).join('')
    : '<p class="psy-empty">Клиенты появятся после активации промокода</p>';

  clients.querySelectorAll('[data-open-chat]').forEach((btn) => {
    btn.addEventListener('click', () => openChat(btn.getAttribute('data-open-chat')));
  });
  clients.querySelectorAll('[data-child-stats]').forEach((btn) => {
    btn.addEventListener('click', () => toggleChildStats(btn.getAttribute('data-child-stats'), btn));
  });
}

const FEAR_LABELS_PSY = {
  darkness: '🌑 Темнота',
  monsters: '👹 Монстры',
  loud_noises: '🔊 Громкие звуки',
  strangers: '👤 Незнакомцы',
  separation: '💔 Разлука',
  school: '🏫 Школа',
  peers: '🧑‍🤝‍🧑 Сверстники'
};

const MOOD_LABELS_PSY = {
  happy: '😊 Радостное',
  neutral: '😐 Спокойное',
  sad: '😢 Грустное',
  anxious: '😟 Тревожное',
  excited: '🤩 Весёлое',
  tired: '😴 Уставшее'
};

function renderChildStats(box, data) {
  const fears = data.fearStats || {};
  const fearRows = Object.keys(FEAR_LABELS_PSY)
    .map((key) => ({ key, label: FEAR_LABELS_PSY[key], value: Math.max(0, Number(fears[key]) || 0) }))
    .filter((f) => f.value > 0)
    .sort((a, b) => b.value - a.value);

  const mood = MOOD_LABELS_PSY[data.mood] || null;
  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString('ru-RU') : '';

  box.innerHTML = `
    <div class="psy-child-stats-inner">
      <p class="psy-child-stats-head">
        👶 <strong>${escapeHtml(data.childName || 'Ребёнок')}</strong>
        ${mood ? `<span class="psy-mood">${escapeHtml(mood)}</span>` : ''}
      </p>
      ${fearRows.length
        ? `<ul class="psy-fears">${fearRows.map((f) => `<li><span>${escapeHtml(f.label)}</span><strong>${f.value}</strong></li>`).join('')}</ul>`
        : '<p class="psy-empty">Страхи пока не отмечены</p>'}
      <small class="psy-consent-note">Согласие родителя · обновлено ${escapeHtml(updated)}</small>
    </div>
  `;
  box.hidden = false;
}

async function toggleChildStats(parentEmail, btn) {
  const email = String(parentEmail || '').trim().toLowerCase();
  if (!email) return;

  const box = document.querySelector(`[data-stats-for="${CSS.escape(email)}"]`);
  if (!box) return;

  if (!box.hidden) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }

  if (btn) btn.disabled = true;
  box.hidden = false;
  box.innerHTML = '<p class="psy-empty">Загрузка…</p>';

  try {
    const url = `/api/psychologist-child-stats?psychologistEmail=${encodeURIComponent(state.email)}&parentEmail=${encodeURIComponent(email)}`;
    const res = await apiFetch(url, { headers: authHeaders(false) });
    const data = await res.json().catch(() => ({}));

    if (res.status === 403) {
      box.innerHTML = `<p class="psy-empty">🔒 ${escapeHtml(data.error || 'Родитель не дал согласие на передачу данных')}</p>`;
      return;
    }
    if (!res.ok) {
      box.innerHTML = '<p class="psy-empty">Не удалось загрузить данные</p>';
      return;
    }
    renderChildStats(box, data);
  } catch (e) {
    console.error('child stats error:', e);
    box.innerHTML = '<p class="psy-empty">Ошибка сети</p>';
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function loadBookings() {
  const res = await apiFetch(`/api/psychologist-booking?psychologistEmail=${encodeURIComponent(state.email)}`, {
    headers: authHeaders(false)
  });
  if (!res.ok) return;
  const data = await res.json();
  const list = data.bookings || [];
  const el = document.getElementById('psyBookings');
  el.innerHTML = list.length
    ? list.slice().reverse().map((b) => `
        <div class="psy-card">
          <strong>${escapeHtml(b.date)} · ${escapeHtml(b.time)} · ${escapeHtml(b.status || '')}</strong>
          <div>${escapeHtml(b.parentName || b.parentEmail)} / ${escapeHtml(b.childName || '—')}</div>
          ${b.concern ? `<small>${escapeHtml(b.concern)}</small>` : ''}
        </div>
      `).join('')
    : '<p class="psy-empty">Записей пока нет</p>';
}

async function loadReviews() {
  const res = await apiFetch(`/api/psychologist-reviews?psychologistEmail=${encodeURIComponent(state.email)}`, {
    headers: authHeaders(false)
  });
  if (!res.ok) return;
  const reviews = await res.json();
  const el = document.getElementById('psyReviews');
  el.innerHTML = Array.isArray(reviews) && reviews.length
    ? reviews.slice().reverse().map((r) => `
        <div class="psy-card">
          <strong>${escapeHtml(r.parentName || 'Родитель')}</strong>
          <div class="psy-stars">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</div>
          <div>${escapeHtml(r.text || '')}</div>
          <small>${r.createdAt ? escapeHtml(new Date(r.createdAt).toLocaleDateString('ru-RU')) : ''}</small>
        </div>
      `).join('')
    : '<p class="psy-empty">Отзывов пока нет</p>';
}

async function loadSlots() {
  const res = await apiFetch(`/api/psychologist-booking?psychologistEmail=${encodeURIComponent(state.email)}`, {
    headers: authHeaders(false)
  });
  if (!res.ok) return;
  const data = await res.json();
  state.slots = Array.isArray(data.slots) ? data.slots : [];
  renderSlots();
}

function renderSlots() {
  const el = document.getElementById('psySlotsList');
  el.innerHTML = state.slots.length
    ? state.slots.map((s, i) => `
        <div class="psy-card">
          <strong>${escapeHtml(s.day)} · ${escapeHtml(s.start)}${s.end ? `–${escapeHtml(s.end)}` : ''}</strong>
          <button type="button" class="psy-btn psy-btn-ghost" data-remove-slot="${i}">Удалить</button>
        </div>
      `).join('')
    : '<p class="psy-empty">Слоты не заданы</p>';

  el.querySelectorAll('[data-remove-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.slots.splice(Number(btn.getAttribute('data-remove-slot')), 1);
      renderSlots();
    });
  });
}

function addSlot() {
  const day = document.getElementById('slotDay')?.value;
  const start = document.getElementById('slotStart')?.value;
  const end = document.getElementById('slotEnd')?.value;
  if (!day || !start) {
    alert('Укажите день и время начала');
    return;
  }
  state.slots.push({ day, start, end: end || '', available: true });
  renderSlots();
}

async function saveSlots() {
  const res = await apiFetch('/api/psychologist-booking', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ psychologistEmail: state.email, slots: state.slots })
  });
  const data = await res.json();
  if (res.ok && data.success) {
    alert('Слоты сохранены');
    state.slots = data.slots || state.slots;
    renderSlots();
  } else {
    alert(data.error || 'Не удалось сохранить');
  }
}

async function refreshChatList() {
  const chatsEl = document.getElementById('psyChatList');
  if (!chatsEl) return;

  try {
    const res = await apiFetch(`/api/psychologist-chat?psychologistEmail=${encodeURIComponent(state.email)}`,
      { headers: authHeaders(false) }
    );
    let chats = res.ok ? await res.json() : [];
    if (!Array.isArray(chats)) chats = [];

    // Дополнить клиентами из рефералов, если чата ещё нет
    const dash = await loadDashboard().catch(() => null);
    const fromClients = (dash?.recentClients || [])
      .map((c) => ({
        parentEmail: c.userEmail || c.email,
        parentName: c.parentName || c.userEmail || c.email,
        lastMessage: ''
      }))
      .filter((c) => c.parentEmail);
    const known = new Set(chats.map((c) => String(c.parentEmail || '').toLowerCase()));
    fromClients.forEach((c) => {
      const key = String(c.parentEmail).toLowerCase();
      if (!known.has(key)) {
        chats.push(c);
        known.add(key);
      }
    });

    if (state.activeChatParent && !known.has(state.activeChatParent)) {
      chats.unshift({ parentEmail: state.activeChatParent, parentName: state.activeChatParent });
    }

    if (!chats.length) {
      chatsEl.innerHTML = '<p class="psy-empty">Нет активных чатов</p>';
      return;
    }

    chatsEl.innerHTML = chats.map((c) => {
      const email = String(c.parentEmail || '').toLowerCase();
      const active = email === state.activeChatParent ? ' active' : '';
      return `
        <button type="button" class="psy-card psy-chat-item${active}" data-chat="${escapeHtml(email)}">
          <strong>${escapeHtml(c.parentName || email)}</strong>
          <small>${escapeHtml(c.lastMessage || 'Нет сообщений')}</small>
        </button>
      `;
    }).join('');

    chatsEl.querySelectorAll('[data-chat]').forEach((btn) => {
      btn.addEventListener('click', () => openChat(btn.getAttribute('data-chat')));
    });
  } catch (e) {
    console.error(e);
    chatsEl.innerHTML = '<p class="psy-empty">Не удалось загрузить чаты</p>';
  }
}

function openChat(parentEmail) {
  state.activeChatParent = String(parentEmail || '').trim().toLowerCase();
  if (!state.activeChatParent) return;

  const emailInput = document.getElementById('psyChatParentEmail');
  if (emailInput) emailInput.value = state.activeChatParent;
  document.getElementById('psyChatTitle').textContent = `Чат с ${state.activeChatParent}`;
  document.getElementById('chatPlaceholder').style.display = 'none';
  document.getElementById('psyChatMessages').style.display = 'flex';
  document.getElementById('psyChatCompose').style.display = 'flex';

  switchTab('chat');
  loadChatMessages();
  refreshChatList();
  if (state.chatPoll) clearInterval(state.chatPoll);
  state.chatPoll = setInterval(loadChatMessages, 5000);
}

async function loadChatMessages() {
  if (!state.activeChatParent) return;
  const url = `/api/psychologist-chat?psychologistEmail=${encodeURIComponent(state.email)}&parentEmail=${encodeURIComponent(state.activeChatParent)}`;
  const res = await apiFetch(url, { headers: authHeaders(false) });
  if (!res.ok) return;
  const messages = await res.json();
  const box = document.getElementById('psyChatMessages');
  if (!box) return;
  box.innerHTML = (Array.isArray(messages) ? messages : []).map((m) => {
    const out = m.role === 'psychologist' || m.from === state.email;
    const time = m.timestamp
      ? new Date(m.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `<div class="psy-msg ${out ? 'out' : 'in'}">${escapeHtml(m.message)}<time>${escapeHtml(time)}</time></div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('psyChatInput');
  const text = input?.value.trim();
  if (!text || !state.activeChatParent) return;

  const res = await apiFetch('/api/psychologist-chat', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      from: state.email,
      to: state.activeChatParent,
      psychologistEmail: state.email,
      parentEmail: state.activeChatParent,
      message: text,
      role: 'psychologist'
    })
  });
  if (res.ok) {
    input.value = '';
    await loadChatMessages();
    await refreshChatList();
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Не удалось отправить');
  }
}

async function loadAll() {
  try {
    const data = await loadDashboard();
    if (!data) return;
    renderStats(data);
    await Promise.all([loadBookings(), loadReviews(), loadSlots(), refreshChatList()]);
  } catch (e) {
    console.error(e);
    document.getElementById('psyLoginError').textContent = 'Не удалось загрузить кабинет';
    showLogin();
  }
}

document.getElementById('psyLoginBtn')?.addEventListener('click', psyLogin);
document.getElementById('psyPassword')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') psyLogin();
});
document.getElementById('psyLogoutBtn')?.addEventListener('click', psyLogout);
document.getElementById('psyTabs')?.addEventListener('click', (e) => {
  const tab = e.target.closest('.psy-tab')?.dataset?.tab;
  if (tab) switchTab(tab);
});
document.getElementById('psyAddSlotBtn')?.addEventListener('click', addSlot);
document.getElementById('psySaveSlotsBtn')?.addEventListener('click', saveSlots);
document.getElementById('psyOpenChatBtn')?.addEventListener('click', () => {
  openChat(document.getElementById('psyChatParentEmail')?.value);
});
document.getElementById('psyChatSend')?.addEventListener('click', sendChatMessage);
document.getElementById('psyChatInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChatMessage();
});

document.addEventListener('DOMContentLoaded', async () => {
  if (location.hash === '#cabinet' || (state.email && state.token)) {
    await checkPsychologistAccess();
  } else {
    showApply();
    if (state.email) {
      const emailInput = document.getElementById('psyEmail');
      if (emailInput) emailInput.value = state.email;
    }
  }
});
