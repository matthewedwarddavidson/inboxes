import { describe, expect, it } from 'vitest';
import {
  buildCandidates,
  hasUniqueSolution,
  isValidSolution,
  rectanglesForClue,
  solve,
} from '../engine/solver';
import type { Clue } from '../engine/types';

describe('rectanglesForClue', () => {
  it('finds all rectangles of the right area covering the clue', () => {
    // Clue value 2 at (0,0) on a 3x3 board => 1x2 or 2x1 covering (0,0).
    const rects = rectanglesForClue({ row: 0, col: 0, value: 2 }, 3, 3);
    // Horizontal 1x2 at (0,0); vertical 2x1 at (0,0).
    expect(rects.length).toBe(2);
    for (const r of rects) {
      const area = (r.row1 - r.row0 + 1) * (r.col1 - r.col0 + 1);
      expect(area).toBe(2);
      expect(r.row0).toBeLessThanOrEqual(0);
      expect(r.row1).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects board bounds', () => {
    const rects = rectanglesForClue({ row: 2, col: 2, value: 4 }, 3, 3);
    // 2x2 covering (2,2) => only top-left at (1,1). 1x4/4x1 don't fit.
    expect(rects.length).toBe(1);
  });
});

describe('buildCandidates', () => {
  it('excludes rectangles that contain another clue', () => {
    const clues: Clue[] = [
      { row: 0, col: 0, value: 2 },
      { row: 0, col: 1, value: 2 },
    ];
    const cands = buildCandidates(clues, 2, 2);
    // The first clue's horizontal 1x2 would cover the second clue => excluded.
    for (const r of cands[0]) {
      const coversOther = 0 >= r.row0 && 0 <= r.row1 && 1 >= r.col0 && 1 <= r.col1;
      expect(coversOther).toBe(false);
    }
  });
});

describe('solve', () => {
  it('rejects clue sums that do not match the board area', () => {
    const clues: Clue[] = [{ row: 0, col: 0, value: 3 }];
    expect(solve(clues, 2, 2).count).toBe(0);
  });

  it('solves a simple 2x2 split into two 1x2 boxes', () => {
    // Two vertical dominoes side by side won't work on 2x2; use two horizontal.
    const clues: Clue[] = [
      { row: 0, col: 0, value: 2 }, // top row
      { row: 1, col: 0, value: 2 }, // bottom row
    ];
    const res = solve(clues, 2, 2, 2);
    expect(res.count).toBe(1);
    expect(res.solution).toBeDefined();
    expect(isValidSolution(clues, res.solution!, 2, 2)).toBe(true);
  });

  it('detects multiple solutions', () => {
    // A 2x2 board with a single 4-clue in a corner has exactly one solution,
    // but a symmetric ambiguous layout should yield >1. Here: 2x2 with clues
    // that allow both horizontal and vertical splits.
    const clues: Clue[] = [
      { row: 0, col: 0, value: 2 },
      { row: 1, col: 1, value: 2 },
    ];
    // Clue A at (0,0) can be horizontal top or vertical left; B mirrors.
    // Horizontal: A=top row, B=bottom row. Vertical: A=left col, B=right col.
    const res = solve(clues, 2, 2, 2);
    expect(res.count).toBe(2);
  });

  it('single full-board clue has one solution', () => {
    const clues: Clue[] = [{ row: 1, col: 1, value: 6 }];
    const res = solve(clues, 3, 2, 2);
    expect(res.count).toBe(1);
  });
});

describe('hasUniqueSolution', () => {
  it('is true for a uniquely solvable layout', () => {
    const clues: Clue[] = [
      { row: 0, col: 0, value: 2 },
      { row: 1, col: 0, value: 2 },
    ];
    expect(hasUniqueSolution(clues, 2, 2)).toBe(true);
  });
});
