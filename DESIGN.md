# Inboxes — Design & Plan

A browser-based recreation of The Economist's daily puzzle **"inboxes"**, with unlimited
auto-generated puzzles, seamless next-puzzle navigation, and personal statistics
(games played, win rate, solve-time averages, streaks).

---

## 1. The game

### 1.1 Rules

"Inboxes" is a variant of the classic logic puzzle **Shikaku** ("Divide by Box").

- The board is a grid: **8 columns wide × 12 rows high = 96 cells** (fixed for now).
- Some cells contain a number.
- The player partitions the entire grid into axis-aligned **rectangular boxes** such that:
  1. Every box is a solid rectangle (no L-shapes).
  2. Every box contains **exactly one** numbered cell.
  3. Every box's **area** (width × height in cells) equals the number it contains.
- The numbers always sum to the total number of cells, so a correct solution tiles the
  whole board with **no gaps and no overlaps**.

A well-formed puzzle has **exactly one** valid solution.

### 1.2 Why this matters for the build

Because the puzzle is Shikaku, we get two things "for free" from existing research:

- A **generator** that produces solvable, unique puzzles by first creating a random
  rectangle tiling and then placing one clue per rectangle.
- A **solver** (constraint propagation + backtracking) that both validates uniqueness
  during generation and can power hints for the player.

---

## 2. Goals & non-goals

### Goals
- Faithfully recreate the play experience in the browser (desktop + mobile/touch).
- Generate an effectively **unlimited** supply of unique, solvable puzzles.
- Make **"next puzzle"** a single click/tap — no date navigation.
- Track and display **personal stats**: games played, completions, average time, best
  time, average/best score, current/longest streak, per-difficulty breakdowns.
- Offer two modes: a **daily puzzle** (UTC-date-seeded, random difficulty) and a
  **free-play** mode where the player picks the difficulty.
- **Score** each solve from time taken and mistakes made.
- Fully **offline-capable**; no account required to play.

### Non-goals (initially)
- Multiplayer / leaderboards / social features.
- Server-side accounts and cross-device sync (designed for later, not built first).
- Reproducing Economist branding/art; we build our own clean visual style.

---

## 3. Tech stack

Recommended stack (no strong constraints from the user; optimized for a fast, offline,
low-maintenance webapp):

| Concern            | Choice                                              | Why |
|--------------------|-----------------------------------------------------|-----|
| Language           | **TypeScript**                                       | Type safety across game logic + UI |
| UI framework       | **React** + **Vite**                                 | Fast dev, small footprint, huge ecosystem |
| Rendering          | **SVG** (or Canvas) grid                             | Crisp lines, easy hit-testing, scales to mobile |
| State management    | **Zustand** (or React context + reducer)            | Lightweight; game state is small |
| Styling            | CSS Modules or Tailwind                              | Either is fine; pick one and stay consistent |
| Persistence        | **IndexedDB** (via `idb`) with localStorage fallback | Store history + stats locally |
| Offline            | **PWA** (service worker via `vite-plugin-pwa`)       | Installable, works offline |
| Testing            | **Vitest** + React Testing Library; Playwright (e2e) | Unit-test generator/solver heavily |

Generation and solving are pure TypeScript functions with **no UI dependency**, so they
can run on the main thread for small boards or in a **Web Worker** to keep the UI smooth.

> Alternative: a static site + local-only storage needs **no backend at all**. A backend
> (section 9) is optional and only needed for cross-device sync or shared daily puzzles.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         UI (React)                        │
│  Board view · Clue rendering · Drag-to-draw boxes ·       │
│  Timer · Stats dashboard · "Next puzzle" · Settings       │
└───────────────┬───────────────────────┬──────────────────┘
                │                         │
        game state (Zustand)      stats/history store
                │                         │
┌───────────────▼──────────┐   ┌──────────▼───────────────┐
│      Engine (pure TS)     │   │   Persistence (IndexedDB) │
│  • generator              │   │   • games log             │
│  • solver / validator     │   │   • aggregate stats       │
│  • move/rules model       │   │   • settings              │
│  • hint provider          │   │   • RNG seeds             │
│  (optionally in a Worker) │   └───────────────────────────┘
└───────────────────────────┘
```

### 4.1 Module boundaries

- `engine/` — no DOM, no React. Deterministic given a seed. Independently testable.
  - `types.ts` — `Grid`, `Rect`, `Clue`, `Puzzle`, `Solution`, `Move`.
  - `generator.ts` — produce puzzles from a seed + difficulty.
  - `solver.ts` — solve / count solutions (used for uniqueness verification + scoring).
  - `rules.ts` — validate a player's current partition, detect completion.
  - `score.ts` — compute a game score from duration + mistakes.
  - `daily.ts` — derive the daily puzzle's seed + difficulty from a UTC date.
  - `rng.ts` — seedable PRNG (e.g. mulberry32 / xorshift) for reproducible puzzles.
- `store/` — game state + persistence.
- `ui/` — components.

---

## 5. Data model

```ts
// A rectangle covers cells [row0..row1] x [col0..col1], inclusive.
interface Rect { row0: number; col0: number; row1: number; col1: number; }

// A clue = the numbered cell that a rectangle must contain.
interface Clue { row: number; col: number; value: number; } // value === rect area

interface Puzzle {
  id: string;            // stable id (e.g. `${width}x${height}-${seed}`)
  width: number;         // columns (8)
  height: number;        // rows (12)
  seed: number;          // reproducible generation
  difficulty: Difficulty;
  clues: Clue[];         // givens shown to the player
  solution: Rect[];      // canonical solution (one rect per clue)
  createdAt: number;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
type Mode = 'daily' | 'free';

// A finished/attempted game record.
interface GameRecord {
  puzzleId: string;
  seed: number;
  mode: Mode;            // 'daily' or 'free'
  difficulty: Difficulty;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  status: 'won' | 'abandoned' | 'in-progress';
  mistakes: number;      // invalid box attempts (see section 9.1)
  score?: number;        // computed on completion (see section 9.1)
}

// Aggregate stats are derived from GameRecord[] but cached for fast display.
interface Stats {
  played: number;
  won: number;
  currentStreak: number;
  longestStreak: number;
  byDifficulty: Record<Difficulty, {
    played: number; won: number;
    bestMs?: number; avgMs?: number;
    bestScore?: number; avgScore?: number;
  }>;
}
```

Puzzles are **reproducible from `(width, height, seed, difficulty)`**, so we don't need to
store the full grid to replay one — the id is enough. We still store the solution in the
record for quick validation/replay.

---

## 6. Puzzle generation

Goal: unlimited puzzles that are (a) guaranteed solvable, (b) uniquely solvable, and
(c) tunable by difficulty.

### 6.1 Algorithm (generate-then-clue)

1. **Seed the RNG** with the puzzle seed for reproducibility.
2. **Random rectangle tiling**: partition the WxH grid into rectangles so they exactly
   tile the board. Two workable approaches:
   - *Recursive splitting*: start with the whole board; repeatedly pick a rectangle and
     split it horizontally/vertically at a random line, biased by difficulty (min/max
     area constraints). Stop when target piece-count/size distribution is reached.
   - *Growth/seed-fill*: scatter seeds and grow rectangles greedily, backtracking on
     conflicts. (Splitting is simpler and always yields a valid tiling.)
3. **Place one clue per rectangle**: the clue value = rectangle area; position = a random
   cell inside that rectangle (clue position affects difficulty).
4. **Uniqueness check**: run the solver to count solutions.
   - If exactly 1 → accept.
   - If >1 → adjust (move a clue toward a corner, re-split an ambiguous region) and retry,
     or regenerate with the next seed.
5. **Difficulty scoring**: rate the accepted puzzle (section 6.3); if it doesn't match the
   requested band, iterate. Cap attempts and fall back to nearest band.

Because everything is seeded, `generate(width, height, seed, difficulty)` is a pure
function → the same seed always yields the same puzzle. "Next puzzle" just increments the
seed (or draws a new random one).

### 6.2 Difficulty levers
- Distribution of rectangle sizes (more small boxes = easier; large + thin boxes = harder).
- Clue placement (center of rect = easier; ambiguous edge placement = harder).
- Number of "forced" deductions vs. required guesses/lookahead depth from the solver.
- Board fill patterns (long 1×n strips increase difficulty).

### 6.3 Difficulty scoring
Estimate difficulty from the **solver's effort**: number of naked/forced placements before
any branching, maximum backtracking depth, and count of cells resolved purely by logic.
Map that score to `easy/medium/hard/expert` thresholds (calibrated with a test corpus).

---

## 7. Solver

Used for uniqueness verification during generation (and available later for optional
hints, which are out of scope for now). Model as **exact-cover-like constraint solving**:

- For each clue, enumerate all rectangles of the correct area that contain that clue and
  fit on the board without covering another clue.
- Each grid cell must be covered by exactly one chosen rectangle → exact cover.
- Solve with **constraint propagation** (naked singles: if a cell can only belong to one
  candidate rectangle, fix it; if a clue has only one candidate, place it) plus
  **backtracking** (or Algorithm X / DLX) on the remaining choices.
- `countSolutions(puzzle, limit = 2)` short-circuits at 2 → cheap uniqueness test.

The same solver can later power **hints** (reveal the next forced box) if we choose to add
them, but hints are deliberately out of scope for the initial build.

---

## 8. UI / UX

### 8.1 Board interaction
- Render grid as SVG; clue numbers centered in their cells.
- **Draw a box**: press/drag from one corner to the opposite corner; release to commit a
  rectangle. Tap an existing box to select; drag edges to resize; tap-and-hold or a delete
  affordance to remove.
- Live feedback:
  - Box turns valid/complete color when its area matches the single clue inside it.
  - Conflicts (overlap, no clue, two clues, wrong area) shown in an error color.
  - Optional "auto-check" toggle vs. "check on complete."
- **Completion**: when the whole board is tiled with all-valid boxes, run `rules.isSolved`,
  stop the timer, record the game, and show a completion overlay with time + a big
  **"Next puzzle →"** button.

### 8.2 Core screens
1. **Home** — choose **Daily puzzle** or **Free play** (with difficulty picker).
2. **Play** — board, timer, live mistake count, mode/difficulty label, controls
   (undo/redo, erase, new). Shows the computed score on completion.
3. **Next puzzle** — in free play, one action generates/loads the next seed at the chosen
   difficulty; the daily puzzle is fixed per UTC day.
4. **Stats dashboard** — games played, win %, average & best times, average & best score,
   streaks, per-difficulty breakdown, simple history list; small charts (e.g. solve-time
   and score trends).
5. **Settings** — default free-play difficulty, auto-check on/off, theme (light/dark), data
   export/import (JSON), reset stats. (Board size fixed at 8×12 for now.)

### 8.3 Quality-of-life
- Undo/redo stack of moves.
- Persist in-progress game so a refresh doesn't lose state.
- Keyboard support on desktop; large touch targets on mobile.
- Colorblind-friendly palette; respect `prefers-reduced-motion`.

---

## 9. Persistence, scoring & stats

### 9.1 Modes & daily puzzle
- **Free play**: player selects a difficulty; "Next puzzle" draws a fresh seed at that
  difficulty. Effectively unlimited.
- **Daily puzzle**: one shared puzzle per **UTC calendar day**. The seed is derived
  deterministically from the date (e.g. `seed = hash("YYYY-MM-DD")`), and the **difficulty
  is chosen pseudo-randomly from that same seed** so it varies day to day but is identical
  for everyone. `daily.ts` exposes `dailyFor(date): { seed, difficulty }`. A day's result
  counts once toward stats/streak (replays don't overwrite the first completion).

### 9.2 Scoring (time + mistakes)
Each completed game gets a **score** derived from solve time and mistakes made, so faster
+ cleaner solves rank higher. A simple, tunable model:

```
score = round(
  base[difficulty]                       // harder puzzles worth more
  * timeFactor                           // decays as time grows
  * (1 - mistakePenalty * mistakes)      // clamped so it never goes below a floor
)

timeFactor    = targetMs / (targetMs + durationMs)   // or an exp/linear decay
mistakePenalty ≈ 0.05                                 // 5% per mistake, clamped
```

Notes:
- `base[difficulty]` and `targetMs` are constants we can tune from real play data later.
- A **mistake** = committing an invalid box (overlaps another box, contains zero or
  multiple clues, or has the wrong area). We can debounce so a single bad drag counts once.
- The formula lives in `engine/score.ts` and is pure/unit-tested, so it's easy to retune.
- We store raw `durationMs` + `mistakes` on every `GameRecord`, so scores can be
  **recomputed retroactively** if we change the formula.

### 9.3 Storage
- **IndexedDB** stores:
  - `games` — append-only `GameRecord[]`.
  - `stats` — cached aggregate, recomputed on each game end.
  - `settings`, and the **current in-progress game** (auto-save on every move, debounced).
- **Averages/streaks/scores** are derived from `games`; cache in `stats` for instant
  display.
- **Export/Import** (JSON) lets users back up or move data between devices without a
  backend.

### Optional backend (future)
Only needed for cross-device sync, shared daily puzzles, or global leaderboards:
- Small API (e.g. Node/Express or a serverless function) + Postgres/SQLite.
- Endpoints: `GET /puzzle/:seed`, `GET /daily`, `POST /games`, `GET /stats`.
- Since puzzles are seed-reproducible, "sync" mostly means syncing `GameRecord`s, not
  puzzle blobs. Keep the client fully functional offline; treat sync as an enhancement.

---

## 10. Testing strategy
- **Engine unit tests** (Vitest): generator always yields a fully-tiled board; every clue's
  area equals its rectangle; solver confirms **exactly one** solution for generated puzzles;
  seeds are deterministic.
- **Property-based tests**: for many random seeds, assert solvability + uniqueness invariants.
- **Rules tests**: completion detection, overlap/gap detection, area validation.
- **Performance**: generation + uniqueness check for 8×12 stays well under a frame budget
  (move to a Web Worker if needed).
- **E2E** (Playwright): draw boxes, complete a puzzle, verify stats update and "next puzzle"
  loads a new board.

---

## 11. Milestones

**M1 — Engine core (headless)**
- Types, seedable RNG, generator (recursive splitting), solver, uniqueness check.
- Tests proving solvable + unique puzzles for 8×12.

**M2 — Playable board (MVP)**
- SVG grid, draw/resize/delete boxes, live validation, completion detection, timer,
  live mistake count.
- Load a puzzle by seed; free-play "Next puzzle" button.

**M3 — Persistence, scoring & stats**
- Scoring (time + mistakes), IndexedDB history, aggregate stats, dashboard, resume
  in-progress game.

**M4 — Modes & polish**
- Daily puzzle (UTC-date seed + random difficulty) vs. free-play difficulty selection,
  undo/redo, settings, themes.

**M5 — PWA & QoL**
- Offline install, mobile touch polish, data export/import, charts.

**M6 (optional) — Backend**
- Sync, shared daily puzzle, leaderboards.

---

## 12. Decisions & open questions

### Decided
- **Board size**: fixed at **8 wide × 12 high** for now (may revisit later).
- **Difficulty tiers**: **easy, medium, hard, expert**. No calibrated target solve times.
- **Daily puzzle**: a **UTC-date-seeded** puzzle of **random difficulty**, plus a separate
  **free-play** mode where the player selects the difficulty.
- **Mistakes**: **tracked**, and combined with time to compute each game's **score**.
- **Hints**: **not for now** (solver still supports them if we add them later).

### Still open
- **Scoring constants**: exact `base[difficulty]`, `targetMs`, and `mistakePenalty` values,
  and the decay curve — best tuned once we have some real solve data.
- **Mistake definition granularity**: does resizing/redrawing the same bad box count each
  time, or once until corrected?
- **Daily difficulty distribution**: uniform across the four tiers, or weighted?
- **Streak rules**: does an abandoned daily break the streak, and does free play affect it
  at all (or is streak daily-only)?
