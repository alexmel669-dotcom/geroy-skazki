// game-engine.js — универсальный игровой движок
import { trackEvent } from './analytics.js';

export class GameEngine {
  constructor(config) {
    this.config = {
      name: 'Игра',
      maxScore: 100,
      timeLimit: 0,
      containerId: null,
      gameId: 'game',
      emoji: '🎮',
      ...config
    };
    this.state = 'idle';
    this.score = 0;
    this.stars = 0;
    this.elapsed = 0;
    this.timerId = null;
    this.listeners = {};
    this.root = null;
    this.ui = {};
  }

  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach((cb) => cb(data));
  }

  mount(container) {
    const host = typeof container === 'string' ? document.getElementById(container) : container;
    if (!host) throw new Error('GameEngine: container not found');

    this.root = document.createElement('div');
    this.root.className = 'ge-root';
    this.root.innerHTML = `
      <header class="ge-header">
        <div class="ge-title"><span class="ge-emoji">${this.config.emoji}</span> ${this.config.name}</div>
        <div class="ge-stats">
          <span class="ge-stat" data-stat="score">⭐ <b>0</b></span>
          <span class="ge-stat" data-stat="time">⏱ <b>0:00</b></span>
        </div>
        <button type="button" class="ge-btn ge-pause">⏸</button>
        <button type="button" class="ge-btn ge-exit">✕</button>
      </header>
      <div class="ge-body"></div>
      <div class="ge-overlay ge-pause-overlay" hidden>
        <div class="ge-overlay-box"><h3>Пауза</h3><button type="button" class="ge-resume modal-btn">Продолжить</button></div>
      </div>
      <div class="ge-overlay ge-finish-overlay" hidden>
        <div class="ge-overlay-box"><h3 class="ge-finish-title">Готово!</h3><p class="ge-finish-text"></p>
        <button type="button" class="ge-restart modal-btn">Ещё раз</button>
        <button type="button" class="ge-finish-exit modal-btn secondary">Закрыть</button></div>
      </div>
    `;
    host.appendChild(this.root);

    this.ui.body = this.root.querySelector('.ge-body');
    this.ui.score = this.root.querySelector('[data-stat="score"] b');
    this.ui.time = this.root.querySelector('[data-stat="time"] b');
    this.ui.pauseOverlay = this.root.querySelector('.ge-pause-overlay');
    this.ui.finishOverlay = this.root.querySelector('.ge-finish-overlay');
    this.ui.finishTitle = this.root.querySelector('.ge-finish-title');
    this.ui.finishText = this.root.querySelector('.ge-finish-text');

    this.root.querySelector('.ge-pause').onclick = () => this.pause();
    this.root.querySelector('.ge-exit').onclick = () => this.exit();
    this.root.querySelector('.ge-resume').onclick = () => this.resume();
    this.root.querySelector('.ge-restart').onclick = () => this.restart();
    this.root.querySelector('.ge-finish-exit').onclick = () => this.exit();

    return this.ui.body;
  }

  start() {
    this.state = 'playing';
    this.score = 0;
    this.elapsed = 0;
    this._updateStats();
    if (this.config.timeLimit > 0) this._startTimer();
    this.emit('start');
    trackEvent(`${this.config.gameId}_started`);
  }

  _startTimer() {
    clearInterval(this.timerId);
    const started = Date.now();
    this.timerId = setInterval(() => {
      if (this.state !== 'playing') return;
      this.elapsed = Math.floor((Date.now() - started) / 1000);
      this._updateStats();
      if (this.config.timeLimit && this.elapsed >= this.config.timeLimit) {
        this.finish(false);
      }
    }, 1000);
  }

  addScore(points) {
    if (this.state !== 'playing') return;
    this.score += points;
    this.stars = Math.min(3, Math.floor(this.score / Math.max(1, this.config.maxScore / 3)));
    this._updateStats();
    this.emit('score', { score: this.score, stars: this.stars });
    if (this.score >= this.config.maxScore) this.finish(true);
  }

  _updateStats() {
    if (this.ui.score) this.ui.score.textContent = String(this.score);
    if (this.ui.time) {
      const m = Math.floor(this.elapsed / 60);
      const s = this.elapsed % 60;
      this.ui.time.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (this.ui.pauseOverlay) this.ui.pauseOverlay.hidden = false;
    this.emit('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    if (this.ui.pauseOverlay) this.ui.pauseOverlay.hidden = true;
    this.emit('resume');
  }

  finish(won) {
    this.state = 'finished';
    clearInterval(this.timerId);
    if (this.ui.finishOverlay) {
      this.ui.finishOverlay.hidden = false;
      if (this.ui.finishTitle) this.ui.finishTitle.textContent = won ? '🎉 Победа!' : '💪 Почти!';
      if (this.ui.finishText) this.ui.finishText.textContent = `Очки: ${this.score} · Звёзды: ${'⭐'.repeat(this.stars || 1)}`;
    }
    this._saveResult(won);
    this.emit('finish', { won, score: this.score, stars: this.stars });
    trackEvent(`${this.config.gameId}_finished`, { won, score: this.score });
  }

  async _saveResult(won) {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [{
            name: 'game_result',
            data: { gameId: this.config.gameId, won, score: this.score, stars: this.stars },
            timestamp: Date.now()
          }]
        })
      });
    } catch { /* ignore */ }
  }

  restart() {
    if (this.ui.finishOverlay) this.ui.finishOverlay.hidden = true;
    if (this.ui.pauseOverlay) this.ui.pauseOverlay.hidden = true;
    this.ui.body.innerHTML = '';
    this.start();
    this.emit('restart');
  }

  exit() {
    clearInterval(this.timerId);
    this.state = 'idle';
    this.root?.remove();
    this.emit('exit');
  }
}

export function createGame(config) {
  return new GameEngine(config);
}

export default { GameEngine, createGame };
