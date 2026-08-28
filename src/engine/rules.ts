// Player-facing rules: validate the current partition, detect mistakes,
// and detect completion. Pure functions over the player's drawn boxes.

import {
  rectArea,
  rectContains,
  rectsOverlap,
  type Clue,
  type Puzzle,
  type Rect,
} from './types';

export type BoxState =
  | 'complete' // exactly one clue inside and area matches
  | 'partial' // exactly one clue inside but area doesn't match yet
  | 'invalid'; // zero or multiple clues inside

export interface BoxEvaluation {
  state: BoxState;
  clue?: Clue; // the single clue inside, if exactly one
  overlaps: boolean; // overlaps another box on the board
}

/** Which clues fall inside a box. */
export function cluesInside(box: Rect, clues: Clue[]): Clue[] {
  return clues.filter((c) => rectContains(box, c.row, c.col));
}

/** Evaluate a single box against the puzzle clues and the other boxes. */
export function evaluateBox(box: Rect, clues: Clue[], others: Rect[]): BoxEvaluation {
  const inside = cluesInside(box, clues);
  const overlaps = others.some((o) => o !== box && rectsOverlap(box, o));

  if (inside.length !== 1) {
    return { state: 'invalid', overlaps };
  }
  const clue = inside[0];
  const state: BoxState = rectArea(box) === clue.value ? 'complete' : 'partial';
  return { state, clue, overlaps };
}

/**
 * A "mistake" for scoring purposes: a committed box that can never be part of a
 * solution — it overlaps another box, contains zero or multiple clues, or has
 * the wrong area for the single clue it contains.
 */
export function isMistakeBox(box: Rect, clues: Clue[], others: Rect[]): boolean {
  const evalResult = evaluateBox(box, clues, others);
  if (evalResult.overlaps) return true;
  if (evalResult.state === 'invalid') return true;
  if (evalResult.state === 'partial') return true;
  return false;
}

/** True once the drawn boxes form a valid, complete solution to the puzzle. */
export function isSolved(boxes: Rect[], puzzle: Puzzle): boolean {
  const { clues, width, height } = puzzle;
  if (boxes.length !== clues.length) return false;

  const occupied = new Uint8Array(width * height);
  for (const box of boxes) {
    const inside = cluesInside(box, clues);
    if (inside.length !== 1) return false;
    if (rectArea(box) !== inside[0].value) return false;
    for (let row = box.row0; row <= box.row1; row++) {
      for (let col = box.col0; col <= box.col1; col++) {
        const k = row * width + col;
        if (occupied[k]) return false; // overlap
        occupied[k] = 1;
      }
    }
  }
  return occupied.every((v) => v === 1); // no gaps
}

/** Count how many board cells are currently covered by exactly one box. */
export function coveredCellCount(boxes: Rect[], width: number, height: number): number {
  const occupied = new Uint8Array(width * height);
  for (const box of boxes) {
    for (let row = box.row0; row <= box.row1; row++) {
      for (let col = box.col0; col <= box.col1; col++) {
        occupied[row * width + col] = 1;
      }
    }
  }
  let count = 0;
  for (const v of occupied) count += v;
  return count;
}
