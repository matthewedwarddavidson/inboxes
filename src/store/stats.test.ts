import { describe, expect, it } from 'vitest';
import { computeStats, emptyStats } from '../store/stats';
import type { GameRecord } from '../store/types';

function game(overrides: Partial<GameRecord>): GameRecord {
  return {
    id: Math.random().toString(36),
    puzzleId: 'p',
    seed: 1,
    mode: 'free',
    difficulty: 'easy',
    startedAt: 0,
    status: 'won',
    mistakes: 0,
    ...overrides,
  };
}

describe('emptyStats', () => {
  it('has zeroed totals and all difficulty buckets', () => {
    const s = emptyStats();
    expect(s.played).toBe(0);
    expect(Object.keys(s.byDifficulty).sort()).toEqual(
      ['easy', 'expert', 'hard', 'medium'].sort(),
    );
  });
});

describe('computeStats', () => {
  it('ignores in-progress games', () => {
    const s = computeStats([game({ status: 'in-progress' })]);
    expect(s.played).toBe(0);
  });

  it('counts played and won', () => {
    const s = computeStats([
      game({ status: 'won', difficulty: 'easy', durationMs: 1000, score: 500 }),
      game({ status: 'abandoned', difficulty: 'easy' }),
    ]);
    expect(s.played).toBe(2);
    expect(s.won).toBe(1);
    expect(s.byDifficulty.easy.played).toBe(2);
    expect(s.byDifficulty.easy.won).toBe(1);
  });

  it('computes best/avg time and score', () => {
    const s = computeStats([
      game({ difficulty: 'medium', durationMs: 2000, score: 400 }),
      game({ difficulty: 'medium', durationMs: 4000, score: 800 }),
    ]);
    expect(s.byDifficulty.medium.bestMs).toBe(2000);
    expect(s.byDifficulty.medium.avgMs).toBe(3000);
    expect(s.byDifficulty.medium.bestScore).toBe(800);
    expect(s.byDifficulty.medium.avgScore).toBe(600);
    expect(s.totalScore).toBe(1200);
  });

  it('computes a daily streak over consecutive days', () => {
    const today = new Date();
    const key = (offsetDays: number) => {
      const d = new Date(today.getTime() - offsetDays * 86_400_000);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const s = computeStats([
      game({ mode: 'daily', status: 'won', dailyKey: key(0) }),
      game({ mode: 'daily', status: 'won', dailyKey: key(1) }),
      game({ mode: 'daily', status: 'won', dailyKey: key(2) }),
    ]);
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
  });

  it('breaks the streak on a gap', () => {
    const s = computeStats([
      game({ mode: 'daily', status: 'won', dailyKey: '2026-08-01' }),
      game({ mode: 'daily', status: 'won', dailyKey: '2026-08-03' }),
    ]);
    expect(s.longestStreak).toBe(1);
    expect(s.currentStreak).toBe(0); // neither day is today/yesterday
  });
});
