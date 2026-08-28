// Central game store (Zustand). Orchestrates the current puzzle, the player's
// boxes, timer, mistakes, persistence, and derived stats.

import { create } from 'zustand';
import {
  computeScore,
  dailyFor,
  generate,
  isMistakeBox,
  isSolved,
  rectsOverlap,
  type Difficulty,
  type Mode,
  type Puzzle,
  type Rect,
} from '../engine';
import {
  clearGames,
  clearSavedGame,
  getAllGames,
  getSavedGame,
  getSettings,
  putGame,
  putSavedGame,
  putSettings,
} from './db';
import { computeStats, emptyStats } from './stats';
import type { GameRecord, SavedGame, Settings, Stats } from './types';

export type Screen = 'home' | 'play' | 'stats' | 'settings';

const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  defaultDifficulty: 'easy',
  autoCheck: true,
  theme: 'light',
};

export interface AddBoxResult {
  ok: boolean;
  replaced?: boolean;
}

interface GameState {
  ready: boolean;
  screen: Screen;

  puzzle: Puzzle | null;
  mode: Mode;
  dailyKey?: string;

  boxes: Rect[];
  history: Rect[][];
  future: Rect[][];

  mistakes: number;
  startedAt: number;
  elapsedMs: number;
  running: boolean;
  solved: boolean;
  recordId: string | null;

  settings: Settings;
  stats: Stats;
  games: GameRecord[];

  init: () => Promise<void>;
  navigate: (screen: Screen) => void;

  startDaily: () => void;
  startFree: (difficulty: Difficulty) => void;
  nextFree: () => void;

  addBox: (rect: Rect) => AddBoxResult;
  removeBoxAt: (index: number) => void;
  clearBoxes: () => void;
  undo: () => void;
  redo: () => void;

  tick: () => void;
  abandon: () => void;

  updateSettings: (patch: Partial<Omit<Settings, 'id'>>) => Promise<void>;
  resetStats: () => Promise<void>;
  exportData: () => Promise<string>;
  importData: (json: string) => Promise<void>;
}

function newRecordId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export const useGame = create<GameState>((set, get) => {
  async function saveCurrent(): Promise<void> {
    const s = get();
    if (!s.puzzle || s.solved) return;
    const saved: SavedGame = {
      id: 'current',
      puzzleSeed: s.puzzle.seed,
      mode: s.mode,
      difficulty: s.puzzle.difficulty,
      dailyKey: s.dailyKey,
      boxes: s.boxes,
      startedAt: s.startedAt,
      elapsedMs: s.elapsedMs,
      mistakes: s.mistakes,
    };
    await putSavedGame(saved);
  }

  async function refreshStats(): Promise<void> {
    const games = await getAllGames();
    set({ games, stats: computeStats(games) });
  }

  function beginGame(puzzle: Puzzle, mode: Mode, dailyKey?: string): void {
    set({
      puzzle,
      mode,
      dailyKey,
      boxes: [],
      history: [],
      future: [],
      mistakes: 0,
      startedAt: Date.now(),
      elapsedMs: 0,
      running: true,
      solved: false,
      recordId: newRecordId(),
      screen: 'play',
    });
    void saveCurrent();
  }

  async function finishGame(): Promise<void> {
    const s = get();
    if (!s.puzzle) return;
    const durationMs = s.elapsedMs;
    const difficulty = s.puzzle.difficulty;
    const score = computeScore(difficulty, durationMs, s.mistakes);

    // Daily counts once: skip a new counted record if this day is already won.
    const alreadyWonDaily =
      s.mode === 'daily' &&
      s.dailyKey !== undefined &&
      s.games.some(
        (g) => g.mode === 'daily' && g.status === 'won' && g.dailyKey === s.dailyKey,
      );

    set({ running: false, solved: true });

    if (!alreadyWonDaily) {
      const record: GameRecord = {
        id: s.recordId ?? newRecordId(),
        puzzleId: s.puzzle.id,
        seed: s.puzzle.seed,
        mode: s.mode,
        difficulty,
        startedAt: s.startedAt,
        finishedAt: Date.now(),
        durationMs,
        status: 'won',
        mistakes: s.mistakes,
        score,
        dailyKey: s.dailyKey,
      };
      await putGame(record);
    }
    await clearSavedGame();
    await refreshStats();
  }

  return {
    ready: false,
    screen: 'home',
    puzzle: null,
    mode: 'free',
    dailyKey: undefined,
    boxes: [],
    history: [],
    future: [],
    mistakes: 0,
    startedAt: 0,
    elapsedMs: 0,
    running: false,
    solved: false,
    recordId: null,
    settings: DEFAULT_SETTINGS,
    stats: emptyStats(),
    games: [],

    async init() {
      const [settings, games, saved] = await Promise.all([
        getSettings(),
        getAllGames(),
        getSavedGame(),
      ]);
      const resolvedSettings = settings ?? DEFAULT_SETTINGS;
      set({
        settings: resolvedSettings,
        games,
        stats: computeStats(games),
        ready: true,
      });

      // Resume an in-progress game if present.
      if (saved) {
        const puzzle = generate(saved.puzzleSeed, saved.difficulty);
        set({
          puzzle,
          mode: saved.mode,
          dailyKey: saved.dailyKey,
          boxes: saved.boxes,
          history: [],
          future: [],
          mistakes: saved.mistakes,
          startedAt: Date.now() - saved.elapsedMs,
          elapsedMs: saved.elapsedMs,
          running: false,
          solved: false,
          recordId: newRecordId(),
        });
      }
    },

    navigate(screen) {
      set({ screen });
    },

    startDaily() {
      const { seed, difficulty, dateKey } = dailyFor();
      const puzzle = generate(seed, difficulty);
      beginGame(puzzle, 'daily', dateKey);
    },

    startFree(difficulty) {
      const seed = Math.floor(Math.random() * 0xffffffff);
      const puzzle = generate(seed, difficulty);
      beginGame(puzzle, 'free', undefined);
    },

    nextFree() {
      const difficulty = get().puzzle?.difficulty ?? get().settings.defaultDifficulty;
      const seed = Math.floor(Math.random() * 0xffffffff);
      const puzzle = generate(seed, difficulty);
      beginGame(puzzle, 'free', undefined);
    },

    addBox(rect) {
      const s = get();
      if (!s.puzzle || s.solved) return { ok: false };
      // Economist-style redraw: a new box replaces any boxes it overlaps.
      const remaining = s.boxes.filter((b) => !rectsOverlap(b, rect));
      const replaced = remaining.length !== s.boxes.length;
      const nextBoxes = [...remaining, rect];
      const mistake = isMistakeBox(rect, s.puzzle.clues);
      set({
        history: [...s.history, s.boxes],
        future: [],
        boxes: nextBoxes,
        mistakes: s.mistakes + (mistake ? 1 : 0),
      });

      if (isSolved(nextBoxes, s.puzzle)) {
        void finishGame();
      } else {
        void saveCurrent();
      }
      return { ok: true, replaced };
    },

    removeBoxAt(index) {
      const s = get();
      if (s.solved) return;
      const nextBoxes = s.boxes.filter((_, i) => i !== index);
      set({
        history: [...s.history, s.boxes],
        future: [],
        boxes: nextBoxes,
      });
      void saveCurrent();
    },

    clearBoxes() {
      const s = get();
      if (s.solved || s.boxes.length === 0) return;
      set({ history: [...s.history, s.boxes], future: [], boxes: [] });
      void saveCurrent();
    },

    undo() {
      const s = get();
      if (s.history.length === 0 || s.solved) return;
      const prev = s.history[s.history.length - 1];
      set({
        boxes: prev,
        history: s.history.slice(0, -1),
        future: [s.boxes, ...s.future],
      });
      void saveCurrent();
    },

    redo() {
      const s = get();
      if (s.future.length === 0 || s.solved) return;
      const next = s.future[0];
      set({
        boxes: next,
        history: [...s.history, s.boxes],
        future: s.future.slice(1),
      });
      void saveCurrent();
    },

    tick() {
      const s = get();
      if (!s.running || s.solved) return;
      set({ elapsedMs: Date.now() - s.startedAt });
    },

    abandon() {
      const s = get();
      set({ running: false });
      if (s.puzzle && !s.solved) void clearSavedGame();
      set({ screen: 'home' });
    },

    async updateSettings(patch) {
      const next = { ...get().settings, ...patch };
      set({ settings: next });
      await putSettings(next);
    },

    async resetStats() {
      await clearGames();
      await clearSavedGame();
      set({ games: [], stats: emptyStats() });
    },

    async exportData() {
      const games = await getAllGames();
      return JSON.stringify({ version: 1, games, settings: get().settings }, null, 2);
    },

    async importData(json) {
      const data = JSON.parse(json) as { games?: GameRecord[]; settings?: Settings };
      if (Array.isArray(data.games)) {
        for (const g of data.games) await putGame(g);
      }
      if (data.settings) {
        await putSettings(data.settings);
        set({ settings: data.settings });
      }
      await refreshStats();
    },
  };
});
