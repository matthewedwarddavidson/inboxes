import { describe, expect, it } from 'vitest';
import { createRng, hashString } from '../engine/rng';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it('int stays within bounds', () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('shuffle preserves elements', () => {
    const rng = createRng(7);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle([...arr]);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(arr);
  });
});

describe('hashString', () => {
  it('is deterministic', () => {
    expect(hashString('2026-08-28')).toBe(hashString('2026-08-28'));
  });

  it('differs for different inputs', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
