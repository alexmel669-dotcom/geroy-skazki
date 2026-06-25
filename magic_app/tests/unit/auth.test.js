import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../api/_lib/crypto.js';
import { sanitizeText } from '../../public/js/security.js';

describe('Auth', () => {
  it('хеширует пароль', () => {
    const hash = hashPassword('test123');
    expect(hash).toBeTruthy();
    expect(hash.length).toBeGreaterThan(20);
  });

  it('проверяет правильный пароль', () => {
    const hash = hashPassword('test123');
    expect(verifyPassword('test123', hash)).toBe(true);
  });

  it('отклоняет неправильный пароль', () => {
    const hash = hashPassword('test123');
    expect(verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('Security', () => {
  it('фильтрует запрещённые слова', () => {
    const text = 'Это страшно и ужасно';
    const cleaned = sanitizeText(text, 6);
    expect(cleaned.toLowerCase()).not.toContain('страшно');
    expect(cleaned.toLowerCase()).not.toContain('ужасно');
  });

  it('пропускает разрешённый сленг для старших', () => {
    const text = 'Это круто и классно';
    const cleaned = sanitizeText(text, 12);
    expect(cleaned).toContain('круто');
    expect(cleaned).toContain('классно');
  });
});

describe('Dictionary', () => {
  it('определяет тип запроса', async () => {
    const { detectRequestType } = await import('../../public/js/dictionary.js');
    expect(detectRequestType('расскажи сказку про дракона')).toBe('story');
    expect(detectRequestType('как дела?')).toBe('chat');
  });
});
