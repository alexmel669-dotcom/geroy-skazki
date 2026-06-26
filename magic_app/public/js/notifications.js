import { ENV } from './config.js';

const ICON = '/assets/images/avatar.svg';
const STORAGE_KEY = 'notificationSettings';

const DEFAULT_SETTINGS = {
  notifyEvening: true,
  notifyAfternoon: true,
  notifyReport: true,
  notifyInactive: true
};

export function getNotificationSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveNotificationSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getNotificationSettings(), ...settings }));
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function scheduleNotification(title, body, delayMs = 0) {
  if (Notification.permission !== 'granted') return null;

  const timerId = setTimeout(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon: ICON,
          badge: ICON,
          vibrate: [200, 100, 200],
          data: { url: '/app.html' }
        });
      }).catch(() => {
        new Notification(title, { body, icon: ICON });
      });
    } else {
      new Notification(title, { body, icon: ICON });
    }
  }, delayMs);

  return timerId;
}

function msUntilHour(hour, minute = 0) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

function alreadySentToday(key) {
  const sent = localStorage.getItem(key);
  const today = new Date().toISOString().split('T')[0];
  return sent === today;
}

function markSentToday(key) {
  localStorage.setItem(key, new Date().toISOString().split('T')[0]);
}

export async function initNotificationScheduler() {
  if (!('Notification' in window)) return;

  const settings = getNotificationSettings();
  const granted = Notification.permission === 'granted' || await requestNotificationPermission();
  if (!granted) return;

  if (settings.notifyEvening && !alreadySentToday('notifyEveningSent')) {
    scheduleNotification(
      '🌙 Люцик ждёт тебя!',
      'Пора поговорить перед сном.',
      msUntilHour(19, 0)
    );
    markSentToday('notifyEveningSent');
  }

  if (settings.notifyAfternoon && !alreadySentToday('notifyAfternoonSent')) {
    scheduleNotification(
      '🎮 Не хочешь поиграть?',
      'Люцик скучает!',
      msUntilHour(13, 0)
    );
    markSentToday('notifyAfternoonSent');
  }

  const lastVisit = parseInt(localStorage.getItem('lastAppVisit') || '0', 10);
  const threeDays = 3 * 86400000;
  if (settings.notifyInactive && lastVisit && Date.now() - lastVisit > threeDays) {
    scheduleNotification('😿 Люцик скучает!', 'Заходи поболтать.', 5000);
  }

  localStorage.setItem('lastAppVisit', String(Date.now()));
}

export function notifyParentReport() {
  const settings = getNotificationSettings();
  if (!settings.notifyReport || Notification.permission !== 'granted') return;
  scheduleNotification(
    '📊 Новый отчёт о настроении ребёнка готов.',
    'Откройте родительский кабинет.',
    1000
  );
}

export function bindNotificationSettingsUI() {
  const evening = document.getElementById('notifyEvening');
  const report = document.getElementById('notifyReport');
  const afternoon = document.getElementById('notifyAfternoon');
  if (!evening && !report) return;

  const settings = getNotificationSettings();
  if (evening) evening.checked = settings.notifyEvening;
  if (report) report.checked = settings.notifyReport;
  if (afternoon) afternoon.checked = settings.notifyAfternoon;

  const onChange = async () => {
    saveNotificationSettings({
      notifyEvening: evening?.checked ?? true,
      notifyReport: report?.checked ?? true,
      notifyAfternoon: afternoon?.checked ?? true
    });
    if (evening?.checked || report?.checked || afternoon?.checked) {
      await requestNotificationPermission();
    }
  };

  evening?.addEventListener('change', onChange);
  report?.addEventListener('change', onChange);
  afternoon?.addEventListener('change', onChange);
}

if (ENV.isDev) {
  console.log('🔔 Notifications module loaded');
}

export function checkPlanExpiryNotification() {
  const expiry = localStorage.getItem('planExpiry');
  if (!expiry) return;
  const daysLeft = Math.ceil((new Date(expiry) - Date.now()) / 86400000);
  if (daysLeft > 3 || daysLeft < 0) return;
  if (alreadySentToday('planExpiry3d')) return;
  scheduleNotification(
    '⏰ Тариф скоро закончится',
    `Осталось ${daysLeft} ${daysLeft === 1 ? 'день' : 'дня'}. Оставьте отзыв — продлим на 7 дней!`,
    2000
  );
  markSentToday('planExpiry3d');
}

export function scheduleMissYouNotification() {
  const lastVisit = localStorage.getItem('geroy-last-visit');
  if (!lastVisit) return;

  const daysSince = Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000);
  if (daysSince >= 2) {
    scheduleNotification(
      '😿 Люцик скучает!',
      `Не заходил уже ${daysSince} ${daysSince === 1 ? 'день' : 'дня'}. Я жду тебя!`,
      3000
    );
  }
}

export default {
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  scheduleNotification,
  initNotificationScheduler,
  notifyParentReport,
  bindNotificationSettingsUI,
  scheduleMissYouNotification
};
