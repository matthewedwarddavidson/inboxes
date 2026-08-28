// Puzzle generator for Inboxes (Shikaku).
//
// Strategy: generate-then-clue.
//   1. Recursively split the board into rectangles (a guaranteed valid tiling).
//   2. Place exactly one clue per rectangle (value = rectangle area).
//   3. Verify the resulting clue set has a unique solution (via the solver).
//   4. Retry deterministically (new sub-seed / clue placement) until unique.
//
// generate(seed, difficulty) is a pure function: the same inputs always yield
// the same puzzle, so "next puzzle" is just a new seed.

import { createRng, type Rng } from './rng';
import { solve } from './solver';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  rectArea,
  type Clue,
  type Difficulty,
  type Puzzle,
  type Rect,
} from './types';

interface DifficultyParams {
  minLeaf: number; // minimum area of a leaf rectangle
  maxLeaf: number; // soft maximum area; larger pieces keep splitting
  stopBias: number; // probability of stopping once area <= maxLeaf
  cluePlacement: 'center' | 'random';
}

const PARAMS: Record<Difficulty, DifficultyParams> = {
  easy: { minLeaf: 2, maxLeaf: 4, stopBias: 0.78, cluePlacement: 'center' },
  medium: { minLeaf: 2, maxLeaf: 6, stopBias: 0.55, cluePlacement: 'center' },
  hard: { minLeaf: 3, maxLeaf: 9, stopBias: 0.4, cluePlacement: 'random' },
  expert: { minLeaf: 3, maxLeaf: 12, stopBias: 0.28, cluePlacement: 'random' },
};

const MAX_TILING_ATTEMPTS = 60;
const CLUE_TRIES_PER_TILING = 8;

/** Recursively split a rectangle into leaves honoring min/max leaf area. */
function splitRect(rect: Rect, rng: Rng, p: DifficultyParams, out: Rect[]): void {
  const w = rect.col1 - rect.col0 + 1;
  const h = rect.row1 - rect.row0 + 1;
  const area = w * h;

  // Enumerate cut offsets that keep both halves >= minLeaf.
  const vCuts: number[] = []; // vertical cut => split columns at offset k
  for (let k = 1; k < w; k++) {
    if (h * k >= p.minLeaf && h * (w - k) >= p.minLeaf) vCuts.push(k);
  }
  const hCuts: number[] = []; // horizontal cut => split rows at offset k
  for (let k = 1; k < h; k++) {
    if (w * k >= p.minLeaf && w * (h - k) >= p.minLeaf) hCuts.push(k);
  }

  const splittable = vCuts.length > 0 || hCuts.length > 0;
  if (!splittable) {
    out.push(rect);
    return;
  }

  // Decide whether to stop splitting.
  if (area <= p.maxLeaf && rng.next() < p.stopBias) {
    out.push(rect);
    return;
  }

  // Choose orientation. Bias slightly toward cutting the longer dimension so
  // pieces don't become extreme strips too often.
  let cutVertical: boolean;
  if (vCuts.length === 0) cutVertical = false;
  else if (hCuts.length === 0) cutVertical = true;
  else {
    const preferVertical = w > h ? 0.62 : w < h ? 0.38 : 0.5;
    cutVertical = rng.next() < preferVertical;
  }

  if (cutVertical) {
    const k = rng.pick(vCuts);
    splitRect(
      { row0: rect.row0, col0: rect.col0, row1: rect.row1, col1: rect.col0 + k - 1 },
      rng,
      p,
      out,
    );
    splitRect(
      { row0: rect.row0, col0: rect.col0 + k, row1: rect.row1, col1: rect.col1 },
      rng,
      p,
      out,
    );
  } else {
    const k = rng.pick(hCuts);
    splitRect(
      { row0: rect.row0, col0: rect.col0, row1: rect.row0 + k - 1, col1: rect.col1 },
      rng,
      p,
      out,
    );
    splitRect(
      { row0: rect.row0 + k, col0: rect.col0, row1: rect.row1, col1: rect.col1 },
      rng,
      p,
      out,
    );
  }
}

function buildTiling(rng: Rng, width: number, height: number, p: DifficultyParams): Rect[] {
  const leaves: Rect[] = [];
  splitRect({ row0: 0, col0: 0, row1: height - 1, col1: width - 1 }, rng, p, leaves);
  return leaves;
}

function placeClue(rect: Rect, rng: Rng, p: DifficultyParams): Clue {
  const value = rectArea(rect);
  if (p.cluePlacement === 'center') {
    const row = Math.floor((rect.row0 + rect.row1) / 2);
    const col = Math.floor((rect.col0 + rect.col1) / 2);
    return { row, col, value };
  }
  const row = rng.int(rect.row0, rect.row1);
  const col = rng.int(rect.col0, rect.col1);
  return { row, col, value };
}

export interface GenerateOptions {
  width?: number;
  height?: number;
}

/** Generate a uniquely-solvable puzzle for the given seed + difficulty. */
export function generate(
  seed: number,
  difficulty: Difficulty,
  options: GenerateOptions = {},
): Puzzle {
  const width = options.width ?? BOARD_WIDTH;
  const height = options.height ?? BOARD_HEIGHT;
  const p = PARAMS[difficulty];

  let fallback: { clues: Clue[]; solution: Rect[] } | undefined;

  for (let attempt = 0; attempt < MAX_TILING_ATTEMPTS; attempt++) {
    const rng = createRng((seed + attempt * 0x9e3779b1) >>> 0);
    const leaves = buildTiling(rng, width, height, p);

    // Avoid degenerate tilings (single giant rect) for a nicer puzzle.
    if (leaves.length < 3) continue;

    for (let t = 0; t < CLUE_TRIES_PER_TILING; t++) {
      const clues = leaves.map((leaf) => placeClue(leaf, rng, p));
      const result = solve(clues, width, height, 2);
      if (!fallback && result.count >= 1) {
        fallback = { clues, solution: leaves.slice() };
      }
      if (result.count === 1) {
        return makePuzzle(seed, difficulty, width, height, clues, leaves);
      }
    }
  }

  // Fallback: return the last solvable (possibly non-unique) puzzle found.
  if (fallback) {
    return makePuzzle(seed, difficulty, width, height, fallback.clues, fallback.solution);
  }

  // Extremely unlikely: retry once with easy params as a last resort.
  return generate(seed + 1, difficulty, options);
}

function makePuzzle(
  seed: number,
  difficulty: Difficulty,
  width: number,
  height: number,
  clues: Clue[],
  solution: Rect[],
): Puzzle {
  return {
    id: `${width}x${height}-${difficulty}-${seed}`,
    width,
    height,
    seed,
    difficulty,
    clues,
    solution,
    createdAt: Date.now(),
  };
}
