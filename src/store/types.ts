// Persistence types shared across the store and DB layers.

import type { Difficulty, Mode, Rect } from '../engine/types';

export interface GameRecord {
  id: string; // unique record id
  puzzleId: string;
  seed: number;
  mode: Mode;
  difficulty: Difficulty;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  status: 'won' | 'abandoned' | 'in-progress';
  mistakes: number;
  score?: number;
  dailyKey?: string; // set for daily games (the UTC date key)
}

/** Saved in-progress game so a refresh doesn't lose state. */
export interface SavedGame {
  id: 'current'; // singleton key
  puzzleSeed: number;
  mode: Mode;
  difficulty: Difficulty;
  dailyKey?: string;
  boxes: Rect[];
  startedAt: number;
  elapsedMs: number;
  mistakes: number;
}

export interface Settings {
  id: 'settings';
  defaultDifficulty: Difficulty;
  autoCheck: boolean;
  theme: 'light' | 'dark';
}

export interface DifficultyStats {
  played: number;
  won: number;
  bestMs?: number;
  avgMs?: number;
  bestScore?: number;
  avgScore?: number;
}

export interface Stats {
  played: number;
  won: number;
  currentStreak: number;
  longestStreak: number;
  totalScore: number;
  byDifficulty: Record<Difficulty, DifficultyStats>;
}
