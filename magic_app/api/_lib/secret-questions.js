export const SECRET_QUESTIONS = {
  pet: 'Кличка вашего первого питомца?',
  city: 'Город, в котором вы родились?',
  mother: 'Девичья фамилия мамы?'
};

export const DEFAULT_SECRET_QUESTION = SECRET_QUESTIONS.pet;

export function getSecretQuestionText(key) {
  return SECRET_QUESTIONS[key] || DEFAULT_SECRET_QUESTION;
}

export function isValidSecretQuestionKey(key) {
  return Object.prototype.hasOwnProperty.call(SECRET_QUESTIONS, key);
}

export function normalizeSecretAnswer(answer) {
  return String(answer || '').trim().toLowerCase();
}
