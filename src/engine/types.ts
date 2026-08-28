// Core domain types for the Inboxes (Shikaku) engine.
// The engine is pure: no DOM, no React. Deterministic given a seed.

/** A rectangle covering cells [row0..row1] x [col0..col1], inclusive. */
export interface Rect {
  row0: number;
  col0: number;
  row1: number;
  col1: number;
}

/** A clue: the single numbered cell a rectangle must contain. `value` === rect area. */
export interface Clue {
  row: number;
  col: number;
  value: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

export type Mode = 'daily' | 'free';

export interface Puzzle {
  id: string;
  width: number; // columns
  height: number; // rows
  seed: number;
  difficulty: Difficulty;
  clues: Clue[];
  solution: Rect[];
  createdAt: number;
}

/** Fixed board dimensions (8 wide x 12 high) per the design. */
export const BOARD_WIDTH = 8;
export const BOARD_HEIGHT = 12;

/** Area (number of cells) covered by a rectangle. */
export function rectArea(r: Rect): number {
  return (r.row1 - r.row0 + 1) * (r.col1 - r.col0 + 1);
}

/** Whether a cell (row, col) lies within a rectangle. */
export function rectContains(r: Rect, row: number, col: number): boolean {
  return row >= r.row0 && row <= r.row1 && col >= r.col0 && col <= r.col1;
}

/** Whether two rectangles overlap (share any cell). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.col0 <= b.col1 &&
    a.col1 >= b.col0 &&
    a.row0 <= b.row1 &&
    a.row1 >= b.row0
  );
}

/** Structural equality for rectangles. */
export function rectEquals(a: Rect, b: Rect): boolean {
  return (
    a.row0 === b.row0 &&
    a.col0 === b.col0 &&
    a.row1 === b.row1 &&
    a.col1 === b.col1
  );
}
