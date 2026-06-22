import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.VERCEL ? '/tmp' : join(process.cwd(), '.data');
const EVENTS_FILE = join(DATA_DIR, 'geroy-analytics.json');

function loadEvents() {
  if (!globalThis.__geroyAnalytics) {
    globalThis.__geroyAnalytics = [];
    try {
      if (existsSync(EVENTS_FILE)) {
        globalThis.__geroyAnalytics = JSON.parse(readFileSync(EVENTS_FILE, 'utf8'));
      }
    } catch (err) {
      console.warn('Analytics load failed:', err.message);
    }
  }
  return globalThis.__geroyAnalytics;
}

function persistEvents() {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(EVENTS_FILE, JSON.stringify(globalThis.__geroyAnalytics || [], null, 2));
  } catch (err) {
    console.warn('Analytics persist failed:', err.message);
  }
}

export function appendEvents(events) {
  const list = loadEvents();
  const now = Date.now();
  events.forEach(ev => {
    list.push({ ...ev, receivedAt: now });
  });
  while (list.length > 5000) list.shift();
  persistEvents();
}

export function getAnalyticsStats() {
  const list = loadEvents();
  const dayAgo = Date.now() - 86400000;
  const games = {};
  const characters = {};

  list.forEach(ev => {
    if (ev.name === 'game_selected') {
      const id = ev.data || 'unknown';
      games[id] = (games[id] || 0) + 1;
    }
    if (ev.name === 'character_change') {
      const id = ev.data || 'unknown';
      characters[id] = (characters[id] || 0) + 1;
    }
  });

  const topGames = Object.entries(games).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCharacters = Object.entries(characters).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return {
    totalEvents: list.length,
    eventsLast24h: list.filter(e => (e.receivedAt || e.timestamp) >= dayAgo).length,
    alertEvents: list.filter(e => e.name === 'alert_words').length,
    topGames,
    topCharacters
  };
}
