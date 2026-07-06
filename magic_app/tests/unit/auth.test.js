import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../api/_lib/crypto.js';
import { sanitizeText } from '../../public/js/security.js';
import { detectRequestType } from '../../public/js/dictionary.js';

describe('Auth', () => {
  it('хеширует пароль', async () => {
    const hash = await hashPassword('test123');
    expect(hash).toBeTruthy();
    expect(hash.length).toBeGreaterThan(20);
  });

  it('проверяет правильный пароль', async () => {
    const hash = await hashPassword('test123');
    const valid = await verifyPassword('test123', hash);
    expect(valid).toBe(true);
  });

  it('отклоняет неправильный пароль', async () => {
    const hash = await hashPassword('test123');
    const valid = await verifyPassword('wrong', hash);
    expect(valid).toBe(false);
  });
});

describe('Security', () => {
  it('фильтрует запрещённые слова', () => {
    const text = 'Это ужасно и неприятно';
    const cleaned = sanitizeText(text, 6);
    // «страшно» больше не фильтруется — ребёнок должен говорить о страхах
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
  it('определяет тип запроса', () => {
    expect(detectRequestType('расскажи сказку')).toBe('story');
    expect(detectRequestType('привет как дела')).toBe('chat');
  });
});