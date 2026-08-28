import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { computeScore } from '../engine';
import { Board } from './Board';
import { capitalize, formatDuration } from './format';

export function Play() {
  const puzzle = useGame((s) => s.puzzle);
  const boxes = useGame((s) => s.boxes);
  const mode = useGame((s) => s.mode);
  const mistakes = useGame((s) => s.mistakes);
  const elapsedMs = useGame((s) => s.elapsedMs);
  const solved = useGame((s) => s.solved);
  const running = useGame((s) => s.running);

  const addBox = useGame((s) => s.addBox);
  const removeBoxAt = useGame((s) => s.removeBoxAt);
  const clearBoxes = useGame((s) => s.clearBoxes);
  const undo = useGame((s) => s.undo);
  const redo = useGame((s) => s.redo);
  const tick = useGame((s) => s.tick);
  const abandon = useGame((s) => s.abandon);
  const nextFree = useGame((s) => s.nextFree);
  const startDaily = useGame((s) => s.startDaily);
  const navigate = useGame((s) => s.navigate);

  const canUndo = useGame((s) => s.history.length > 0);
  const canRedo = useGame((s) => s.future.length > 0);

  // Drive the timer once a second while the game is running.
  useEffect(() => {
    if (!running || solved) return;
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running, solved, tick]);

  if (!puzzle) {
    return (
      <div className="play">
        <p>No puzzle loaded.</p>
        <button className="btn" onClick={() => navigate('home')}>
          Home
        </button>
      </div>
    );
  }

  const score = solved ? computeScore(puzzle.difficulty, elapsedMs, mistakes) : 0;

  return (
    <div className="play">
      <header className="play__bar">
        <button className="btn btn--ghost" onClick={abandon} aria-label="Back to home">
          ‹ Home
        </button>
        <div className="play__meta">
          <span className="badge">{mode === 'daily' ? 'Daily' : 'Free'}</span>
          <span className="badge">{capitalize(puzzle.difficulty)}</span>
        </div>
      </header>

      <div className="play__stats">
        <div className="pill">
          <span className="pill__label">Time</span>
          <span className="pill__value">{formatDuration(elapsedMs)}</span>
        </div>
        <div className="pill">
          <span className="pill__label">Mistakes</span>
          <span className="pill__value">{mistakes}</span>
        </div>
      </div>

      <div className="play__board-wrap">
        <Board
          puzzle={puzzle}
          boxes={boxes}
          onAddBox={addBox}
          onRemoveBox={removeBoxAt}
          interactive={!solved}
        />
      </div>

      <div className="play__controls">
        <button className="btn" onClick={undo} disabled={!canUndo || solved}>
          Undo
        </button>
        <button className="btn" onClick={redo} disabled={!canRedo || solved}>
          Redo
        </button>
        <button className="btn" onClick={clearBoxes} disabled={boxes.length === 0 || solved}>
          Clear
        </button>
      </div>

      <p className="play__hint muted">
        Drag to draw a box — drawing over existing boxes redraws them. Tap a box to remove
        it. Each box must hold one number equal to its area.
      </p>

      {solved && (
        <div className="overlay">
          <div className="overlay__card">
            <h2>Solved!</h2>
            <div className="overlay__stats">
              <div className="stat">
                <span className="stat__value">{formatDuration(elapsedMs)}</span>
                <span className="stat__label">Time</span>
              </div>
              <div className="stat">
                <span className="stat__value">{mistakes}</span>
                <span className="stat__label">Mistakes</span>
              </div>
              <div className="stat">
                <span className="stat__value">{score}</span>
                <span className="stat__label">Score</span>
              </div>
            </div>
            <div className="overlay__actions">
              {mode === 'free' ? (
                <button className="btn btn--primary" onClick={nextFree}>
                  Next puzzle →
                </button>
              ) : (
                <button className="btn btn--primary" onClick={startDaily}>
                  Replay
                </button>
              )}
              <button className="btn" onClick={() => navigate('stats')}>
                Stats
              </button>
              <button className="btn btn--ghost" onClick={() => navigate('home')}>
                Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
