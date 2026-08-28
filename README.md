# inboxes
Recreation of The Economist's games "inboxes"

See [DESIGN.md](DESIGN.md) for the design and build plan.

## Quick start

```sh
make start      # install deps (if needed) and launch the dev server
```

Then open http://localhost:5173/.

## Other commands

```sh
make test       # run the test suite
make build      # type-check and build the production bundle
make preview    # serve the production build
make typecheck  # run the TypeScript type checker
make clean      # remove node_modules and dist
make help       # list all commands
```

## Project layout

- `src/engine/` — pure, DOM-free game logic: puzzle generation, solver
  (uniqueness verification), rules/validation, scoring, and the daily puzzle.
- `src/store/` — Zustand game state plus IndexedDB persistence and stats.
- `src/ui/` — React UI: home, board, stats, and settings screens.

The game is [Shikaku](https://en.wikipedia.org/wiki/Shikaku): partition the
8×12 grid into rectangles so each contains exactly one number equal to its area.
