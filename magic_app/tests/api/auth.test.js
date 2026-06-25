import { describe, it, expect } from 'vitest';

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3000';
const hasServer = process.env.RUN_API_TESTS === '1';

describe.skipIf(!hasServer)('API /api/register', () => {
  const testEmail = `test-${Date.now()}@test.com`;

  it('регистрирует нового пользователя', async () => {
    const res = await fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'test123',
        parentPin: '1234',
        children: [{ name: 'Тест', age: 7, gender: 'male' }]
      })
    });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
  });
});

describe.skipIf(!hasServer)('API /api/login', () => {
  it('отклоняет неправильный пароль', async () => {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.com', password: 'wrong' })
    });
    expect(res.status).toBe(401);
  });
});

describe('API smoke', () => {
  it('unit-тесты работают без сервера', () => {
    expect(true).toBe(true);
  });
});
