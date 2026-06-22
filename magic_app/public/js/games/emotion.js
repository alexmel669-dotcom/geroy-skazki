import { appState } from '../core.js';
import { showModal } from '../ui.js';
import { updateAchievement } from '../achievements.js';

export function startEmotionGame() {
  if (appState.gameActive) return;
  appState.gameActive = true;
  const emotions = [
    { emoji: '😊', name: 'радость' },
    { emoji: '😢', name: 'грусть' },
    { emoji: '😨', name: 'страх' },
    { emoji: '😡', name: 'злость' },
    { emoji: '😴', name: 'сонливость' },
    { emoji: '😍', name: 'любовь' }
  ];
  let score = 0;
  let currentEmotion = emotions[Math.floor(Math.random() * emotions.length)];

  const container = document.createElement('div');
  container.className = 'game-overlay';

  const emojiDisplay = document.createElement('div');
  emojiDisplay.style.cssText = 'font-size:100px;margin:20px 0;';
  emojiDisplay.textContent = currentEmotion.emoji;

  const question = document.createElement('div');
  question.textContent = 'Что я чувствую?';

  const scoreDisplay = document.createElement('div');
  scoreDisplay.textContent = 'Правильно: 0/5';

  const options = document.createElement('div');
  options.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;';

  function updateQuestion() {
    if (score >= 5) {
      updateAchievement('emotion_master');
      showModal('Победа!', 'Ты угадал все эмоции!');
      container.remove();
      appState.gameActive = false;
      return;
    }
    currentEmotion = emotions[Math.floor(Math.random() * emotions.length)];
    emojiDisplay.textContent = currentEmotion.emoji;
    const answers = [...emotions].sort(() => Math.random() - 0.5).slice(0, 3);
    if (!answers.includes(currentEmotion)) {
      answers[Math.floor(Math.random() * 3)] = currentEmotion;
    }
    options.innerHTML = '';
    answers.forEach(em => {
      const btn = document.createElement('button');
      btn.textContent = em.name;
      btn.style.cssText = 'padding:15px 25px;border-radius:30px;background:#4a4a6a;color:#fff;border:none;font-size:1rem;cursor:pointer;';
      btn.onclick = () => {
        if (em.name === currentEmotion.name) {
          score++;
          scoreDisplay.textContent = `Правильно: ${score}/5`;
          updateQuestion();
        }
      };
      options.appendChild(btn);
    });
  }
  updateQuestion();

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Закрыть';
  closeBtn.style.cssText = 'padding:10px 20px;border-radius:30px;background:#ff4081;color:#fff;border:none;cursor:pointer;margin-top:15px;';
  closeBtn.onclick = () => {
    container.remove();
    appState.gameActive = false;
  };

  container.appendChild(emojiDisplay);
  container.appendChild(question);
  container.appendChild(options);
  container.appendChild(scoreDisplay);
  container.appendChild(closeBtn);
  document.body.appendChild(container);
}
