// Solver for Inboxes (Shikaku).
//
// A puzzle is solved by choosing, for each clue, exactly one rectangle that:
//   - has area equal to the clue's value,
//   - contains that clue,
//   - contains no other clue,
//   - does not overlap any other chosen rectangle.
//
// Because the clue values sum to the board area, a set of non-overlapping
// rectangles (one per clue) necessarily tiles the whole board. So we only need
// to enforce "one per clue" + "no overlaps".
//
// Used for uniqueness verification during generation.

import type { Clue, Rect } from './types';
import { rectArea } from './types';

/** All rectangles of the given area that contain (row, col) and fit on the board. */
export function rectanglesForClue(
  clue: Clue,
  width: number,
  height: number,
): Rect[] {
  const rects: Rect[] = [];
  const { row, col, value } = clue;
  for (let h = 1; h <= value; h++) {
    if (value % h !== 0) continue;
    const w = value / h;
    if (w > width || h > height) continue;
    // Top-left corner ranges so the rect stays on-board AND covers (row, col).
    const row0Min = Math.max(0, row - h + 1);
    const row0Max = Math.min(row, height - h);
    const col0Min = Math.max(0, col - w + 1);
    const col0Max = Math.min(col, width - w);
    for (let r0 = row0Min; r0 <= row0Max; r0++) {
      for (let c0 = col0Min; c0 <= col0Max; c0++) {
        rects.push({ row0: r0, col0: c0, row1: r0 + h - 1, col1: c0 + w - 1 });
      }
    }
  }
  return rects;
}

/** Candidate rectangles per clue, excluding rects that cover another clue. */
export function buildCandidates(
  clues: Clue[],
  width: number,
  height: number,
): Rect[][] {
  return clues.map((clue) => {
    const rects = rectanglesForClue(clue, width, height);
    return rects.filter((r) => {
      // Must not contain any OTHER clue.
      for (const other of clues) {
        if (other === clue) continue;
        if (
          other.row >= r.row0 &&
          other.row <= r.row1 &&
          other.col >= r.col0 &&
          other.col <= r.col1
        ) {
          return false;
        }
      }
      return true;
    });
  });
}

export interface SolveResult {
  /** Number of solutions found (capped at `limit`). */
  count: number;
  /** The first solution found (one rect per clue, in clue order), if any. */
  solution?: Rect[];
}

/**
 * Count solutions up to `limit` (default 2, enough for a uniqueness test).
 * Uses MRV (minimum-remaining-values) ordering + backtracking with an
 * occupancy grid, plus a per-cell coverage feasibility prune.
 */
export function solve(
  clues: Clue[],
  width: number,
  height: number,
  limit = 2,
): SolveResult {
  // Validate the clue sum matches the board area up front.
  const totalArea = clues.reduce((s, c) => s + c.value, 0);
  if (totalArea !== width * height) {
    return { count: 0 };
  }

  const candidates = buildCandidates(clues, width, height);
  // Dead on arrival if any clue has no candidates.
  if (candidates.some((c) => c.length === 0)) return { count: 0 };

  const n = clues.length;
  const occupied = new Uint8Array(width * height); // 0 = free, else clueIndex+1
  const chosen: (Rect | undefined)[] = new Array(n).fill(undefined);
  const placed = new Uint8Array(n);

  const idx = (row: number, col: number) => row * width + col;

  const canPlace = (r: Rect): boolean => {
    for (let row = r.row0; row <= r.row1; row++) {
      for (let col = r.col0; col <= r.col1; col++) {
        if (occupied[idx(row, col)] !== 0) return false;
      }
    }
    return true;
  };

  const fill = (r: Rect, value: number) => {
    for (let row = r.row0; row <= r.row1; row++) {
      for (let col = r.col0; col <= r.col1; col++) {
        occupied[idx(row, col)] = value;
      }
    }
  };

  // Feasibility prune: every currently-free cell must be coverable by at least
  // one remaining candidate of some unplaced clue.
  const feasible = (): boolean => {
    // Mark cells reachable by some unplaced clue candidate that currently fits.
    const reachable = new Uint8Array(width * height);
    for (let i = 0; i < n; i++) {
      if (placed[i]) continue;
      for (const r of candidates[i]) {
        if (!canPlace(r)) continue;
        for (let row = r.row0; row <= r.row1; row++) {
          for (let col = r.col0; col <= r.col1; col++) {
            reachable[idx(row, col)] = 1;
          }
        }
      }
    }
    for (let cell = 0; cell < occupied.length; cell++) {
      if (occupied[cell] === 0 && reachable[cell] === 0) return false;
    }
    return true;
  };

  let count = 0;
  let firstSolution: Rect[] | undefined;

  const search = (): void => {
    if (count >= limit) return;

    // Select unplaced clue with fewest currently-placeable candidates (MRV).
    let best = -1;
    let bestCount = Infinity;
    for (let i = 0; i < n; i++) {
      if (placed[i]) continue;
      let c = 0;
      for (const r of candidates[i]) {
        if (canPlace(r)) c++;
        if (c >= bestCount) break;
      }
      if (c === 0) return; // dead end
      if (c < bestCount) {
        bestCount = c;
        best = i;
        if (c === 1) break;
      }
    }

    if (best === -1) {
      // All clues placed => a full valid tiling.
      count++;
      if (!firstSolution) {
        firstSolution = chosen.map((r) => r!) as Rect[];
      }
      return;
    }

    for (const r of candidates[best]) {
      if (!canPlace(r)) continue;
      fill(r, best + 1);
      chosen[best] = r;
      placed[best] = 1;

      if (feasible()) search();

      placed[best] = 0;
      chosen[best] = undefined;
      fill(r, 0);
      if (count >= limit) return;
    }
  };

  search();
  return { count, solution: firstSolution };
}

/** Convenience: true iff the clue set has exactly one solution. */
export function hasUniqueSolution(
  clues: Clue[],
  width: number,
  height: number,
): boolean {
  return solve(clues, width, height, 2).count === 1;
}

/** Sanity check that a proposed solution is consistent with its clues. */
export function isValidSolution(
  clues: Clue[],
  solution: Rect[],
  width: number,
  height: number,
): boolean {
  if (solution.length !== clues.length) return false;
  const occupied = new Uint8Array(width * height);
  for (let i = 0; i < solution.length; i++) {
    const r = solution[i];
    const clue = clues[i];
    if (rectArea(r) !== clue.value) return false;
    if (
      clue.row < r.row0 ||
      clue.row > r.row1 ||
      clue.col < r.col0 ||
      clue.col > r.col1
    ) {
      return false;
    }
    for (let row = r.row0; row <= r.row1; row++) {
      for (let col = r.col0; col <= r.col1; col++) {
        const k = row * width + col;
        if (occupied[k]) return false; // overlap
        occupied[k] = 1;
      }
    }
  }
  return occupied.every((v) => v === 1); // full coverage
}
