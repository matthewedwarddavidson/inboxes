import { useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { DIFFICULTIES } from '../engine';
import { capitalize } from './format';

export function SettingsView() {
  const settings = useGame((s) => s.settings);
  const updateSettings = useGame((s) => s.updateSettings);
  const resetStats = useGame((s) => s.resetStats);
  const exportData = useGame((s) => s.exportData);
  const importData = useGame((s) => s.importData);
  const navigate = useGame((s) => s.navigate);

  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inboxes-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      await importData(text);
      setMessage('Data imported.');
    } catch {
      setMessage('Import failed: invalid file.');
    }
  };

  const handleReset = async () => {
    if (window.confirm('Reset all stats and history? This cannot be undone.')) {
      await resetStats();
      setMessage('Stats reset.');
    }
  };

  return (
    <div className="settings-view">
      <header className="subheader">
        <button className="btn btn--ghost" onClick={() => navigate('home')}>
          ‹ Home
        </button>
        <h1>Settings</h1>
      </header>

      <section className="card">
        <h2>Default free-play difficulty</h2>
        <div className="difficulty-picker">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              className={`chip ${d === settings.defaultDifficulty ? 'chip--active' : ''}`}
              onClick={() => updateSettings({ defaultDifficulty: d })}
            >
              {capitalize(d)}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Appearance</h2>
        <label className="row">
          <span>Theme</span>
          <select
            value={settings.theme}
            onChange={(e) => updateSettings({ theme: e.target.value as 'light' | 'dark' })}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Data</h2>
        <div className="play__controls">
          <button className="btn" onClick={handleExport}>
            Export
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <button className="btn btn--danger" onClick={handleReset}>
            Reset stats
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportFile(file);
            e.target.value = '';
          }}
        />
        {message && <p className="muted">{message}</p>}
      </section>

      <p className="muted">Board size is fixed at 8 × 12.</p>
    </div>
  );
}
