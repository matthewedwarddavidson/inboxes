import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { dailyFor, DIFFICULTIES, type Difficulty } from '../engine';
import { capitalize } from './format';

export function Home() {
  const startDaily = useGame((s) => s.startDaily);
  const startFree = useGame((s) => s.startFree);
  const navigate = useGame((s) => s.navigate);
  const defaultDifficulty = useGame((s) => s.settings.defaultDifficulty);
  const stats = useGame((s) => s.stats);

  const [difficulty, setDifficulty] = useState<Difficulty>(defaultDifficulty);
  const daily = dailyFor();

  return (
    <div className="home">
      <header className="home__header">
        <h1 className="home__title">inboxes</h1>
        <p className="home__subtitle">Fill the grid with rectangles.</p>
      </header>

      <section className="card">
        <h2>Daily puzzle</h2>
        <p className="muted">
          {daily.dateKey} · {capitalize(daily.difficulty)}
        </p>
        <button className="btn btn--primary" onClick={startDaily}>
          Play today’s puzzle
        </button>
      </section>

      <section className="card">
        <h2>Free play</h2>
        <div className="difficulty-picker">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              className={`chip ${d === difficulty ? 'chip--active' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {capitalize(d)}
            </button>
          ))}
        </div>
        <button className="btn btn--primary" onClick={() => startFree(difficulty)}>
          Start {capitalize(difficulty)} puzzle
        </button>
      </section>

      <section className="home__quickstats">
        <div className="stat">
          <span className="stat__value">{stats.played}</span>
          <span className="stat__label">Played</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.won}</span>
          <span className="stat__label">Won</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.currentStreak}</span>
          <span className="stat__label">Streak</span>
        </div>
      </section>

      <nav className="home__nav">
        <button className="btn" onClick={() => navigate('stats')}>
          Stats
        </button>
        <button className="btn" onClick={() => navigate('settings')}>
          Settings
        </button>
      </nav>
    </div>
  );
}
