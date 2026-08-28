// Daily puzzle: derive a deterministic seed + difficulty from a UTC date, so
// everyone gets the same puzzle each day and it varies day to day.

import { hashString } from './rng';
import { DIFFICULTIES, type Difficulty } from './types';

/** Format a Date as a UTC "YYYY-MM-DD" key. */
export function utcDateKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface DailyDescriptor {
  dateKey: string;
  seed: number;
  difficulty: Difficulty;
}

/** The daily puzzle descriptor for a given date (defaults to today, UTC). */
export function dailyFor(date: Date = new Date()): DailyDescriptor {
  const dateKey = utcDateKey(date);
  const seed = hashString(`inboxes-daily-${dateKey}`);
  // Difficulty derived from a separate hash so it's decorrelated from the seed.
  const dIndex = hashString(`inboxes-daily-diff-${dateKey}`) % DIFFICULTIES.length;
  return { dateKey, seed, difficulty: DIFFICULTIES[dIndex] };
}
