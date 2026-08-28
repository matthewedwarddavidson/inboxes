import { useGame } from '../store/gameStore';
import { DIFFICULTIES } from '../engine';
import { capitalize, formatDuration } from './format';

export function StatsView() {
  const stats = useGame((s) => s.stats);
  const games = useGame((s) => s.games);
  const navigate = useGame((s) => s.navigate);

  const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  const recent = [...games]
    .filter((g) => g.status === 'won')
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .slice(0, 10);

  return (
    <div className="stats-view">
      <header className="subheader">
        <button className="btn btn--ghost" onClick={() => navigate('home')}>
          ‹ Home
        </button>
        <h1>Stats</h1>
      </header>

      <section className="summary-grid">
        <div className="stat card">
          <span className="stat__value">{stats.played}</span>
          <span className="stat__label">Played</span>
        </div>
        <div className="stat card">
          <span className="stat__value">{winRate}%</span>
          <span className="stat__label">Win rate</span>
        </div>
        <div className="stat card">
          <span className="stat__value">{stats.currentStreak}</span>
          <span className="stat__label">Streak</span>
        </div>
        <div className="stat card">
          <span className="stat__value">{stats.longestStreak}</span>
          <span className="stat__label">Best streak</span>
        </div>
        <div className="stat card">
          <span className="stat__value">{stats.totalScore.toLocaleString()}</span>
          <span className="stat__label">Total score</span>
        </div>
      </section>

      <section className="card">
        <h2>By difficulty</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Difficulty</th>
              <th>Played</th>
              <th>Won</th>
              <th>Best time</th>
              <th>Avg time</th>
              <th>Best score</th>
            </tr>
          </thead>
          <tbody>
            {DIFFICULTIES.map((d) => {
              const ds = stats.byDifficulty[d];
              return (
                <tr key={d}>
                  <td>{capitalize(d)}</td>
                  <td>{ds.played}</td>
                  <td>{ds.won}</td>
                  <td>{ds.bestMs !== undefined ? formatDuration(ds.bestMs) : '—'}</td>
                  <td>{ds.avgMs !== undefined ? formatDuration(ds.avgMs) : '—'}</td>
                  <td>{ds.bestScore ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Recent wins</h2>
        {recent.length === 0 ? (
          <p className="muted">No games yet — go play one!</p>
        ) : (
          <ul className="history">
            {recent.map((g) => (
              <li key={g.id} className="history__row">
                <span className="badge">{g.mode === 'daily' ? 'Daily' : 'Free'}</span>
                <span>{capitalize(g.difficulty)}</span>
                <span>{g.durationMs !== undefined ? formatDuration(g.durationMs) : '—'}</span>
                <span className="muted">{g.mistakes} mistakes</span>
                <span className="history__score">{g.score ?? 0}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
