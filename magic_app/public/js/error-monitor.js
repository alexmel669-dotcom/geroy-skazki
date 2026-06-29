// error-monitor.js — клиентский мониторинг ошибок
const MAX_BUFFER = 50;
const FLUSH_INTERVAL_MS = 30000;
const FLUSH_THRESHOLD = 10;

class ErrorMonitor {
  constructor() {
    this.buffer = [];
    this.timer = null;
    this._origConsoleError = null;
  }

  start() {
    window.addEventListener('error', (e) => {
      this.capture({
        type: 'global',
        critical: true,
        message: e.message || 'Unknown error',
        stack: e.error?.stack,
        source: e.filename,
        line: e.lineno
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.capture({
        type: 'unhandledRejection',
        critical: true,
        message: e.reason?.message || String(e.reason || 'Unhandled rejection'),
        stack: e.reason?.stack
      });
    });

    this._origConsoleError = console.error.bind(console);
    console.error = (...args) => {
      this.capture({
        type: 'console.error',
        critical: false,
        message: args.map((a) => (typeof a === 'string' ? a : a?.message || JSON.stringify(a))).join(' ')
      });
      this._origConsoleError(...args);
    };

    this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  _context() {
    return {
      userAgent: navigator.userAgent,
      url: location.href,
      character: localStorage.getItem('currentCharacter') || 'lucik',
      plan: localStorage.getItem('userPlan') || 'free',
      appVersion: localStorage.getItem('appVersion') || undefined,
      child: localStorage.getItem('activeChildIndex')
    };
  }

  capture(entry) {
    this.buffer.push({
      ...entry,
      context: this._context(),
      timestamp: Date.now()
    });
    if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
    if (this.buffer.length >= FLUSH_THRESHOLD) this.flush();
  }

  flush() {
    if (!this.buffer.length) return;
    const batch = this.buffer.splice(0, MAX_BUFFER);
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [{
          name: 'client_errors',
          data: { errors: batch },
          timestamp: Date.now()
        }]
      })
    }).catch(() => {});
  }
}

export const errorMonitor = new ErrorMonitor();

if (typeof window !== 'undefined') {
  window.errorMonitor = errorMonitor;
  errorMonitor.start();
}

export default errorMonitor;
