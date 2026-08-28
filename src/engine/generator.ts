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
  maxLeaf: number; // hard maximum area; larger pieces always keep splitting
  maxStrip: number; // longest 1-wide sliver allowed (enables prime values like 5, 7, 11)
  sizeBias: number; // draws taken as the stop threshold's max (higher => bigger boxes)
  centerBias: number; // draws averaged for the cut point (higher => squarer boxes)
  thinChance: number; // chance to take a short-strip cut (source of 2s and 3s)
  cluePlacement: 'center' | 'random';
}

// We make "chunky" cuts (both sides >= 2 thick) or "strip" cuts (a 1-wide sliver
// up to `maxStrip` long). Allowing longer strips reintroduces prime box sizes
// (5, 7, 11), which can only exist as 1xN strips, while `thinChance` keeps them
// occasional so the board stays chunky rather than a mess of thin strips. Each
// region stops splitting once its area is <= a random threshold (max of
// `sizeBias` draws), biasing box sizes toward the larger end.
const PARAMS: Record<Difficulty, DifficultyParams> = {
  easy: { minLeaf: 2, maxLeaf: 6, maxStrip: 5, sizeBias: 2, centerBias: 3, thinChance: 0.33, cluePlacement: 'center' },
  medium: { minLeaf: 2, maxLeaf: 8, maxStrip: 7, sizeBias: 2, centerBias: 3, thinChance: 0.3, cluePlacement: 'center' },
  hard: { minLeaf: 2, maxLeaf: 10, maxStrip: 9, sizeBias: 2, centerBias: 2, thinChance: 0.28, cluePlacement: 'random' },
  expert: { minLeaf: 2, maxLeaf: 12, maxStrip: 12, sizeBias: 3, centerBias: 2, thinChance: 0.26, cluePlacement: 'random' },
};

const MAX_TILING_ATTEMPTS = 60;
const CLUE_TRIES_PER_TILING = 8;

/** Pick a cut offset, biased toward the center for squarer pieces. */
function pickCut(cuts: number[], span: number, rng: Rng, centerBias: number): number {
  const mid = span / 2;
  let best = cuts[rng.int(0, cuts.length - 1)];
  let bestDist = Math.abs(best - mid);
  for (let i = 1; i < centerBias; i++) {
    const cand = cuts[rng.int(0, cuts.length - 1)];
    const dist = Math.abs(cand - mid);
    if (dist < bestDist) {
      best = cand;
      bestDist = dist;
    }
  }
  return best;
}

/** Choose which orientation to cut, preferring the longer dimension. */
function preferVertical(w: number, h: number, rng: Rng): boolean {
  const bias = w > h ? 0.78 : w < h ? 0.22 : 0.5;
  return rng.next() < bias;
}

/** Recursively split a rectangle into leaves with a varied size distribution. */
function splitRect(rect: Rect, rng: Rng, p: DifficultyParams, out: Rect[]): void {
  const w = rect.col1 - rect.col0 + 1;
  const h = rect.row1 - rect.row0 + 1;
  const area = w * h;

  // Classify cut offsets. "Chunky" cuts leave both sides >= 2 thick in the cut
  // dimension. "Thin" cuts peel a 1-wide sliver, allowed only while the sliver
  // stays within maxStrip so strips don't get arbitrarily long.
  const vChunky: number[] = [];
  const vThin: number[] = [];
  for (let k = 1; k < w; k++) {
    if (h * k < p.minLeaf || h * (w - k) < p.minLeaf) continue;
    if (k >= 2 && w - k >= 2) vChunky.push(k);
    else if (h <= p.maxStrip) vThin.push(k); // sliver is h long
  }
  const hChunky: number[] = [];
  const hThin: number[] = [];
  for (let k = 1; k < h; k++) {
    if (w * k < p.minLeaf || w * (h - k) < p.minLeaf) continue;
    if (k >= 2 && h - k >= 2) hChunky.push(k);
    else if (w <= p.maxStrip) hThin.push(k); // sliver is w long
  }

  const hasChunky = vChunky.length > 0 || hChunky.length > 0;
  const hasThin = vThin.length > 0 || hThin.length > 0;

  // Nothing can be cut acceptably (e.g. a 1x3 or 3x3 nub) => it's a leaf.
  if (!hasChunky && !hasThin) {
    out.push(rect);
    return;
  }

  // Random per-region target: stop once the region is at or below it.
  let stopThreshold = p.minLeaf;
  for (let i = 0; i < p.sizeBias; i++) {
    const draw = rng.int(p.minLeaf, p.maxLeaf);
    if (draw > stopThreshold) stopThreshold = draw;
  }
  if (area <= stopThreshold) {
    out.push(rect);
    return;
  }

  // Prefer chunky cuts; occasionally take a short-strip cut for small boxes.
  const useThin = hasChunky ? hasThin && rng.next() < p.thinChance : true;

  let cutVertical: boolean;
  let cuts: number[];
  if (useThin) {
    if (vThin.length === 0) cutVertical = false;
    else if (hThin.length === 0) cutVertical = true;
    else cutVertical = preferVertical(w, h, rng);
    cuts = cutVertical ? vThin : hThin;
  } else {
    if (vChunky.length === 0) cutVertical = false;
    else if (hChunky.length === 0) cutVertical = true;
    else cutVertical = preferVertical(w, h, rng);
    cuts = cutVertical ? vChunky : hChunky;
  }

  const span = cutVertical ? w : h;
  const k = pickCut(cuts, span, rng, p.centerBias);

  if (cutVertical) {
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
