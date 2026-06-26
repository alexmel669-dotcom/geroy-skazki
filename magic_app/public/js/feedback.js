let selectedRating = 0;

function ensureFeedbackModal() {
  if (document.getElementById('feedbackModal')) return;

  const modal = document.createElement('div');
  modal.id = 'feedbackModal';
  modal.className = 'feedback-modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="feedback-box">
      <h3>💬 Ваш отзыв</h3>
      <p class="feedback-sub">Оцените «Герой Сказок» — это поможет нам стать лучше</p>
      <div class="feedback-stars" id="feedbackStars"></div>
      <textarea id="feedbackText" rows="4" placeholder="Что понравилось? Что улучшить?" maxlength="1000"></textarea>
      <label class="feedback-extend" id="feedbackExtendWrap" style="display:none;">
        <input type="checkbox" id="feedbackExtend"> Продлить тариф на 7 дней за отзыв ⭐
      </label>
      <p class="feedback-error" id="feedbackError"></p>
      <div class="feedback-actions">
        <button type="button" class="modal-btn secondary" id="feedbackCancel">Отмена</button>
        <button type="button" class="modal-btn" id="feedbackSubmit">Отправить</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const starsEl = document.getElementById('feedbackStars');
  starsEl.innerHTML = [1, 2, 3, 4, 5].map((n) =>
    `<button type="button" class="star-btn" data-star="${n}" aria-label="${n} звёзд">☆</button>`
  ).join('');

  starsEl.querySelectorAll('.star-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.dataset.star, 10);
      starsEl.querySelectorAll('.star-btn').forEach((b, i) => {
        b.textContent = i < selectedRating ? '★' : '☆';
        b.classList.toggle('active', i < selectedRating);
      });
    });
  });

  document.getElementById('feedbackCancel')?.addEventListener('click', closeFeedbackModal);
  document.getElementById('feedbackSubmit')?.addEventListener('click', submitFeedback);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeFeedbackModal();
  });
}

function openFeedbackModal() {
  ensureFeedbackModal();
  selectedRating = 0;
  document.getElementById('feedbackText').value = '';
  document.getElementById('feedbackError').textContent = '';
  document.querySelectorAll('#feedbackStars .star-btn').forEach((b) => {
    b.textContent = '☆';
    b.classList.remove('active');
  });
  const hasPlan = localStorage.getItem('userPlan') && localStorage.getItem('userPlan') !== 'free';
  const wrap = document.getElementById('feedbackExtendWrap');
  if (wrap) wrap.style.display = hasPlan && localStorage.getItem('userToken') ? 'block' : 'none';
  document.getElementById('feedbackModal').style.display = 'flex';
}

function closeFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  if (modal) modal.style.display = 'none';
}

async function submitFeedback() {
  const errEl = document.getElementById('feedbackError');
  if (!selectedRating) {
    errEl.textContent = 'Выберите оценку от 1 до 5';
    return;
  }

  const token = localStorage.getItem('userToken');
  const body = {
    rating: selectedRating,
    text: document.getElementById('feedbackText')?.value.trim() || '',
    page: window.location.pathname,
    requestExtend: document.getElementById('feedbackExtend')?.checked === true
  };

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Не удалось отправить';
      return;
    }
    closeFeedbackModal();
    alert(data.extended
      ? 'Спасибо! Тариф продлён на 7 дней 🎉'
      : 'Спасибо за отзыв! 💜');
    if (data.plan) localStorage.setItem('userPlan', data.plan);
  } catch {
    errEl.textContent = 'Ошибка сети';
  }
}

export function initFeedbackButton() {
  if (document.getElementById('feedbackFab')) return;
  ensureFeedbackModal();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'feedbackFab';
  btn.className = 'feedback-fab';
  btn.textContent = '💬 Отзывы';
  btn.addEventListener('click', openFeedbackModal);
  document.body.appendChild(btn);
}

export default { initFeedbackButton, openFeedbackModal };
