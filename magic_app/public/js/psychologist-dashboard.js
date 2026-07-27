// ========================================
// psychologist-dashboard.js — кабинет психолога
// ========================================

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

function showLogin() {
  document.getElementById('psyLogin').hidden = false;
  document.getElementById('psyDashboard').hidden = true;
  if (state.chatPoll) {
    clearInterval(state.chatPoll);
    state.chatPoll = null;
  }
}

function showDashboard() {
  document.getElementById('psyLogin').hidden = true;
  document.getElementById('psyDashboard').hidden = false;
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
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Неверный логин или пароль';
      return;
    }

    state.token = data.token || localStorage.getItem(STORAGE_TOKEN) || '';
    state.email = data.user?.email || email;
    localStorage.setItem(STORAGE_TOKEN, state.token);
    localStorage.setItem(STORAGE_EMAIL, state.email);
    localStorage.setItem('userEmail', state.email);
    localStorage.setItem('isAuth', 'true');
    if (data.user?.role) localStorage.setItem('userRole', data.user.role);

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
  showLogin();
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
}

async function loadDashboard() {
  const res = await fetch(`/api/psychologist-dashboard?email=${encodeURIComponent(state.email)}`, {
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
    ? recent.map((c) => `
        <div class="psy-card">
          <strong>${escapeHtml(c.parentName || c.userEmail || c.email || 'Клиент')}</strong>
          <small>${escapeHtml(c.activatedAt ? new Date(c.activatedAt).toLocaleDateString('ru-RU') : '')}</small>
          ${c.userEmail || c.email ? `<button type="button" class="psy-btn psy-btn-secondary" data-open-chat="${escapeHtml(c.userEmail || c.email)}">Открыть чат</button>` : ''}
        </div>
      `).join('')
    : '<p class="psy-empty">Клиенты появятся после активации промокода</p>';

  clients.querySelectorAll('[data-open-chat]').forEach((btn) => {
    btn.addEventListener('click', () => openChat(btn.getAttribute('data-open-chat')));
  });
}

async function loadBookings() {
  const res = await fetch(`/api/psychologist-booking?psychologistEmail=${encodeURIComponent(state.email)}`, {
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
  const res = await fetch(`/api/psychologist-reviews?psychologistEmail=${encodeURIComponent(state.email)}`, {
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
  const res = await fetch(`/api/psychologist-booking?psychologistEmail=${encodeURIComponent(state.email)}`, {
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
  const res = await fetch('/api/psychologist-booking', {
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
  // Индекс чатов берём из dashboard chats via bookings clients + open chats stored locally
  const dash = await loadDashboard();
  if (!dash) return;
  const chatsEl = document.getElementById('psyChatList');
  const fromClients = (dash.recentClients || [])
    .map((c) => c.userEmail || c.email)
    .filter(Boolean);
  const emails = [...new Set([...(state.activeChatParent ? [state.activeChatParent] : []), ...fromClients])];
  chatsEl.innerHTML = emails.length
    ? emails.map((email) => `
        <button type="button" class="psy-card" data-chat="${escapeHtml(email)}" style="text-align:left;cursor:pointer;width:100%;color:inherit;background:rgba(255,255,255,0.04);">
          <strong>${escapeHtml(email)}</strong>
        </button>
      `).join('')
    : '<p class="psy-empty">Нет диалогов</p>';

  chatsEl.querySelectorAll('[data-chat]').forEach((btn) => {
    btn.addEventListener('click', () => openChat(btn.getAttribute('data-chat')));
  });
}

function openChat(parentEmail) {
  state.activeChatParent = String(parentEmail || '').trim().toLowerCase();
  if (!state.activeChatParent) return;
  document.getElementById('psyChatParentEmail').value = state.activeChatParent;
  document.getElementById('psyChatTitle').textContent = `Чат с ${state.activeChatParent}`;
  document.getElementById('psyChatInput').disabled = false;
  document.getElementById('psyChatSend').disabled = false;
  switchTab('chat');
  loadChatMessages();
  if (state.chatPoll) clearInterval(state.chatPoll);
  state.chatPoll = setInterval(loadChatMessages, 8000);
}

async function loadChatMessages() {
  if (!state.activeChatParent) return;
  const url = `/api/psychologist-chat?psychologistEmail=${encodeURIComponent(state.email)}&parentEmail=${encodeURIComponent(state.activeChatParent)}`;
  const res = await fetch(url, { headers: authHeaders(false) });
  if (!res.ok) return;
  const messages = await res.json();
  const box = document.getElementById('psyChatMessages');
  box.innerHTML = (Array.isArray(messages) ? messages : []).map((m) => {
    const out = m.role === 'psychologist' || m.from === state.email;
    const time = m.timestamp ? new Date(m.timestamp).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="psy-msg ${out ? 'out' : 'in'}">${escapeHtml(m.message)}<time>${escapeHtml(time)}</time></div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('psyChatInput');
  const text = input?.value.trim();
  if (!text || !state.activeChatParent) return;

  const res = await fetch('/api/psychologist-chat', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      psychologistEmail: state.email,
      parentEmail: state.activeChatParent,
      message: text,
      role: 'psychologist'
    })
  });
  if (res.ok) {
    input.value = '';
    await loadChatMessages();
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
  if (state.email && state.token) {
    showDashboard();
    await loadAll();
  } else {
    showLogin();
    if (state.email) document.getElementById('psyEmail').value = state.email;
  }
});
