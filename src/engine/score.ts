// Scoring: combine solve time and mistakes into a single score.
// Pure and tunable; raw durationMs + mistakes are stored per game so scores
// can be recomputed retroactively if these constants change.

import type { Difficulty } from './types';

export interface ScoreParams {
  base: number; // points before time/mistake adjustments
  targetMs: number; // reference solve time for the time factor
  mistakePenalty: number; // fractional penalty per mistake
  mistakeFloor: number; // minimum multiplier from mistakes (clamp)
}

export const SCORE_PARAMS: Record<Difficulty, ScoreParams> = {
  easy: { base: 1000, targetMs: 90_000, mistakePenalty: 0.05, mistakeFloor: 0.2 },
  medium: { base: 1600, targetMs: 180_000, mistakePenalty: 0.05, mistakeFloor: 0.2 },
  hard: { base: 2400, targetMs: 360_000, mistakePenalty: 0.04, mistakeFloor: 0.2 },
  expert: { base: 3200, targetMs: 600_000, mistakePenalty: 0.04, mistakeFloor: 0.2 },
};

/**
 * score = base * timeFactor * mistakeFactor
 *   timeFactor    = targetMs / (targetMs + durationMs)   // decays with time
 *   mistakeFactor = clamp(1 - penalty * mistakes, floor, 1)
 */
export function computeScore(
  difficulty: Difficulty,
  durationMs: number,
  mistakes: number,
): number {
  const p = SCORE_PARAMS[difficulty];
  const safeDuration = Math.max(0, durationMs);
  const timeFactor = p.targetMs / (p.targetMs + safeDuration);
  const mistakeFactor = Math.max(
    p.mistakeFloor,
    1 - p.mistakePenalty * Math.max(0, mistakes),
  );
  return Math.round(p.base * timeFactor * mistakeFactor);
}
