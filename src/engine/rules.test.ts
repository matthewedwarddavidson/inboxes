import { describe, expect, it } from 'vitest';
import {
  coveredCellCount,
  evaluateBox,
  isMistakeBox,
  isSolved,
} from '../engine/rules';
import { generate } from '../engine/generator';
import type { Clue, Rect } from '../engine/types';

describe('evaluateBox', () => {
  const clues: Clue[] = [{ row: 0, col: 0, value: 4 }];

  it('is complete when one clue inside and area matches', () => {
    const box: Rect = { row0: 0, col0: 0, row1: 1, col1: 1 };
    expect(evaluateBox(box, clues, [box]).state).toBe('complete');
  });

  it('is partial when one clue inside but area wrong', () => {
    const box: Rect = { row0: 0, col0: 0, row1: 0, col1: 1 };
    expect(evaluateBox(box, clues, [box]).state).toBe('partial');
  });

  it('is invalid when no clue inside', () => {
    const box: Rect = { row0: 2, col0: 2, row1: 2, col1: 2 };
    expect(evaluateBox(box, clues, [box]).state).toBe('invalid');
  });

  it('flags overlaps', () => {
    const a: Rect = { row0: 0, col0: 0, row1: 1, col1: 1 };
    const b: Rect = { row0: 1, col0: 1, row1: 2, col1: 2 };
    expect(evaluateBox(a, clues, [a, b]).overlaps).toBe(true);
  });
});

describe('isMistakeBox', () => {
  const clues: Clue[] = [
    { row: 0, col: 0, value: 2 },
    { row: 2, col: 2, value: 2 },
  ];

  it('is a mistake when area is wrong (partial)', () => {
    const box: Rect = { row0: 0, col0: 0, row1: 0, col1: 0 }; // area 1 != 2
    expect(isMistakeBox(box, clues, [box])).toBe(true);
  });

  it('is a mistake when two clues inside', () => {
    const box: Rect = { row0: 0, col0: 0, row1: 2, col1: 2 };
    expect(isMistakeBox(box, clues, [box])).toBe(true);
  });

  it('is not a mistake when complete and non-overlapping', () => {
    const box: Rect = { row0: 0, col0: 0, row1: 0, col1: 1 };
    expect(isMistakeBox(box, clues, [box])).toBe(false);
  });
});

describe('isSolved', () => {
  it('accepts the generated canonical solution', () => {
    const puzzle = generate(5, 'easy');
    expect(isSolved(puzzle.solution, puzzle)).toBe(true);
  });

  it('rejects an incomplete board', () => {
    const puzzle = generate(5, 'easy');
    expect(isSolved(puzzle.solution.slice(1), puzzle)).toBe(false);
  });
});

describe('coveredCellCount', () => {
  it('counts unique covered cells', () => {
    const boxes: Rect[] = [
      { row0: 0, col0: 0, row1: 1, col1: 1 }, // 4 cells
      { row0: 0, col0: 0, row1: 0, col1: 2 }, // overlaps first, adds 1 new
    ];
    expect(coveredCellCount(boxes, 4, 4)).toBe(5);
  });
});
