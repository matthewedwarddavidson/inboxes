import { describe, expect, it } from 'vitest';
import { generate } from '../engine/generator';
import { solve, isValidSolution } from '../engine/solver';
import { DIFFICULTIES, rectArea, BOARD_HEIGHT, BOARD_WIDTH } from '../engine/types';

describe('generate', () => {
  it('is deterministic for the same seed + difficulty', () => {
    const a = generate(42, 'medium');
    const b = generate(42, 'medium');
    expect(a.clues).toEqual(b.clues);
    expect(a.solution).toEqual(b.solution);
    expect(a.id).toBe(b.id);
  });

  it('produces different puzzles for different seeds', () => {
    const a = generate(1, 'medium');
    const b = generate(2, 'medium');
    expect(a.clues).not.toEqual(b.clues);
  });

  for (const difficulty of DIFFICULTIES) {
    describe(`difficulty: ${difficulty}`, () => {
      it('clue values sum to the board area', () => {
        const p = generate(100, difficulty);
        const sum = p.clues.reduce((s, c) => s + c.value, 0);
        expect(sum).toBe(BOARD_WIDTH * BOARD_HEIGHT);
      });

      it('every clue area matches its solution rectangle', () => {
        const p = generate(101, difficulty);
        expect(p.solution.length).toBe(p.clues.length);
        for (let i = 0; i < p.clues.length; i++) {
          expect(rectArea(p.solution[i])).toBe(p.clues[i].value);
        }
      });

      it('the stored solution is valid', () => {
        const p = generate(102, difficulty);
        expect(isValidSolution(p.clues, p.solution, p.width, p.height)).toBe(true);
      });

      it('generated puzzles have a unique solution across many seeds', () => {
        for (let seed = 0; seed < 25; seed++) {
          const p = generate(seed, difficulty);
          const res = solve(p.clues, p.width, p.height, 2);
          expect(res.count).toBe(1);
        }
      });
    });
  }
});
