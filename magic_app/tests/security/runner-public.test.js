import { describe, expect, it, vi } from 'vitest';
import { buildChallengeCourse, challengeSeed } from '../../public/js/games/runner-challenge.js';
import leaderboard from '../../api/_handlers/leaderboard.js';

const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('@upstash/redis', () => ({ Redis: class { constructor() { return store; } } }));

describe('runner challenges', () => {
  it('accepts unsigned seeds including zero, ignores malformed links', () => {
    expect(challengeSeed('?challenge=0')).toBe(0);
    expect(challengeSeed('?challenge=4294967295')).toBe(4294967295);
    for (const raw of ['', '-1', '1.5', '12xx', '4294967296']) {
      expect(challengeSeed('?challenge=' + raw)).toBeNull();
    }
    expect(challengeSeed('')).toBeNull();
  });
  it('replays the same course without using global randomness', () => {
    const course = buildChallengeCourse(12345);
    expect(course).toEqual(buildChallengeCourse(12345));
    expect(course).not.toEqual(buildChallengeCourse(12346));
    expect(course.some(item => item.obstacle)).toBe(true);
    expect(course.some(item => !item.obstacle)).toBe(true);
    expect(course.every(item => item.meter > 0 && item.meter < 1000)).toBe(true);
  });
});

describe('public leaderboard', () => {
  const res = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() });
  it('returns only public fields even for an old entry', async () => {
    store.get.mockResolvedValue([{ name: 'Private fixture', childName: 'Private fixture', fearCategory: 'private', score: 12, date: '2026-01-01' }]);
    const response = res();
    await leaderboard({ method: 'GET', headers: {}, url: '/api/leaderboard?game=runner' }, response);
    expect(response.json).toHaveBeenCalledWith([{ name: 'Герой', score: 12, date: '2026-01-01' }]);
  });
  it('ignores identifying fields sent by an older client', async () => {
    store.get.mockResolvedValue([]);
    await leaderboard({ method: 'POST', headers: {}, body: { game: 'runner', name: 'Private fixture', fearCategory: 'private', score: 31 } }, res());
    expect(store.set).toHaveBeenCalledWith('geroy:leaderboard:runner', [{ name: 'Герой', score: 31, date: expect.any(String) }]);
  });
});
