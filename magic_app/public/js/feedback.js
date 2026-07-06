// feedback.js — модуль отзывов

let feedbackRating = 0;

export function openFeedbackModal() {
  const modal = document.getElementById('feedbackModal');
  if (modal) {
    modal.style.display = 'flex';
    feedbackRating = 0;
    document.getElementById('feedbackText').value = '';
    document.getElementById('feedbackSuccess').style.display = 'none';
    document.querySelectorAll('#feedbackStars span').forEach(s => s.style.opacity = '0.3');
  }
}

function closeFeedback() {
  const modal = document.getElementById('feedbackModal');
  if (modal) modal.style.display = 'none';
}

function setRating(value) {
  feedbackRating = value;
  const stars = document.querySelectorAll('#feedbackStars span');
  stars.forEach((s, i) => {
    s.style.opacity = i < value ? '1' : '0.3';
  });
}

async function submitFeedback() {
  const name = document.getElementById('feedbackName')?.value || '';
  const role = document.getElementById('feedbackRole')?.value || 'parent';
  const text = document.getElementById('feedbackText')?.value || '';
  
  if (!text.trim()) {
    alert('Напишите отзыв');
    return;
  }
  
  try {
    const res = await fetch('/api/feedbacks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, rating: feedbackRating || 5, text })
    });
    
    if (res.ok) {
      document.getElementById('feedbackSuccess').style.display = 'block';
      setTimeout(closeFeedback, 2000);
    }
  } catch (e) {
    console.error('Feedback error:', e);
  }
}

export function initFeedbackButton() {
  const btn = document.getElementById('feedbackLandingBtn');
  if (btn) {
    btn.addEventListener('click', openFeedbackModal);
  }
  
  const closeBtn = document.querySelector('#feedbackModal .feedback-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeFeedback);
  }
  
  const submitBtn = document.getElementById('submitFeedbackBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitFeedback);
  }
  
  const stars = document.querySelectorAll('#feedbackStars span');
  stars.forEach((star, i) => {
    star.addEventListener('click', () => setRating(i + 1));
  });
}

// Автоинициализация
document.addEventListener('DOMContentLoaded', initFeedbackButton);