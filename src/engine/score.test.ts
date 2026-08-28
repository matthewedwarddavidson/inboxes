import { describe, expect, it } from 'vitest';
import { computeScore } from '../engine/score';

describe('computeScore', () => {
  it('is higher for faster solves', () => {
    const fast = computeScore('medium', 60_000, 0);
    const slow = computeScore('medium', 600_000, 0);
    expect(fast).toBeGreaterThan(slow);
  });

  it('decreases with mistakes', () => {
    const clean = computeScore('medium', 120_000, 0);
    const messy = computeScore('medium', 120_000, 5);
    expect(messy).toBeLessThan(clean);
  });

  it('never drops below the mistake floor', () => {
    const many = computeScore('medium', 120_000, 1000);
    const zero = computeScore('medium', 120_000, 0);
    expect(many).toBeGreaterThan(0);
    expect(many).toBeGreaterThanOrEqual(Math.round(zero * 0.2 * 0.999));
  });

  it('harder difficulties are worth more at equal time/mistakes', () => {
    const easy = computeScore('easy', 120_000, 0);
    const expert = computeScore('expert', 120_000, 0);
    expect(expert).toBeGreaterThan(easy);
  });
});
