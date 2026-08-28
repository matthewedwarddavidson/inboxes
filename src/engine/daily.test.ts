import { describe, expect, it } from 'vitest';
import { dailyFor, utcDateKey } from '../engine/daily';
import { DIFFICULTIES } from '../engine/types';

describe('utcDateKey', () => {
  it('formats a UTC date as YYYY-MM-DD', () => {
    const d = new Date(Date.UTC(2026, 7, 28, 23, 59));
    expect(utcDateKey(d)).toBe('2026-08-28');
  });
});

describe('dailyFor', () => {
  it('is deterministic for a given date', () => {
    const d = new Date(Date.UTC(2026, 7, 28));
    const a = dailyFor(d);
    const b = dailyFor(d);
    expect(a).toEqual(b);
  });

  it('varies across days', () => {
    const a = dailyFor(new Date(Date.UTC(2026, 7, 28)));
    const b = dailyFor(new Date(Date.UTC(2026, 7, 29)));
    expect(a.seed).not.toBe(b.seed);
  });

  it('produces a valid difficulty', () => {
    const d = dailyFor(new Date(Date.UTC(2026, 7, 28)));
    expect(DIFFICULTIES).toContain(d.difficulty);
  });
});
