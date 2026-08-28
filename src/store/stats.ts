// Aggregate stats derived from the games log. Pure and unit-tested.

import { DIFFICULTIES, type Difficulty } from '../engine/types';
import type { GameRecord, Stats } from './types';

function emptyDifficultyStats() {
  return { played: 0, won: 0 } as Stats['byDifficulty'][Difficulty];
}

export function emptyStats(): Stats {
  const byDifficulty = {} as Stats['byDifficulty'];
  for (const d of DIFFICULTIES) byDifficulty[d] = emptyDifficultyStats();
  return {
    played: 0,
    won: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalScore: 0,
    byDifficulty,
  };
}

/**
 * Streaks are based on daily-puzzle wins over consecutive UTC days.
 * A day is "won" if any daily game that day has status 'won'.
 */
function computeDailyStreaks(games: GameRecord[]): {
  current: number;
  longest: number;
} {
  const wonDays = new Set<string>();
  for (const g of games) {
    if (g.mode === 'daily' && g.status === 'won' && g.dailyKey) {
      wonDays.add(g.dailyKey);
    }
  }
  if (wonDays.size === 0) return { current: 0, longest: 0 };

  const days = [...wonDays].sort(); // ascending YYYY-MM-DD
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (isNextDay(days[i - 1], days[i])) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }

  // Current streak: consecutive days ending today or yesterday (UTC).
  const todayKey = utcKeyFromDate(new Date());
  const yesterdayKey = utcKeyFromDate(new Date(Date.now() - 86_400_000));
  const last = days[days.length - 1];
  let current = 0;
  if (last === todayKey || last === yesterdayKey) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (isNextDay(days[i - 1], days[i])) current++;
      else break;
    }
  }
  return { current, longest };
}

function utcKeyFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isNextDay(prev: string, next: string): boolean {
  const p = Date.parse(`${prev}T00:00:00Z`);
  const n = Date.parse(`${next}T00:00:00Z`);
  return n - p === 86_400_000;
}

export function computeStats(games: GameRecord[]): Stats {
  const stats = emptyStats();

  for (const g of games) {
    if (g.status === 'in-progress') continue;
    stats.played++;
    const ds = stats.byDifficulty[g.difficulty];
    ds.played++;

    if (g.status === 'won') {
      stats.won++;
      ds.won++;
      if (typeof g.durationMs === 'number') {
        ds.bestMs = ds.bestMs === undefined ? g.durationMs : Math.min(ds.bestMs, g.durationMs);
      }
      if (typeof g.score === 'number') {
        stats.totalScore += g.score;
        ds.bestScore =
          ds.bestScore === undefined ? g.score : Math.max(ds.bestScore, g.score);
      }
    }
  }

  // Averages over won games with the relevant field.
  for (const d of DIFFICULTIES) {
    const won = games.filter((g) => g.difficulty === d && g.status === 'won');
    const times = won.map((g) => g.durationMs).filter((v): v is number => typeof v === 'number');
    const scores = won.map((g) => g.score).filter((v): v is number => typeof v === 'number');
    if (times.length) {
      stats.byDifficulty[d].avgMs = Math.round(
        times.reduce((s, v) => s + v, 0) / times.length,
      );
    }
    if (scores.length) {
      stats.byDifficulty[d].avgScore = Math.round(
        scores.reduce((s, v) => s + v, 0) / scores.length,
      );
    }
  }

  const streaks = computeDailyStreaks(games);
  stats.currentStreak = streaks.current;
  stats.longestStreak = streaks.longest;

  return stats;
}
