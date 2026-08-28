import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import { Home } from './Home';
import { Play } from './Play';
import { StatsView } from './StatsView';
import { SettingsView } from './SettingsView';

export function App() {
  const ready = useGame((s) => s.ready);
  const screen = useGame((s) => s.screen);
  const theme = useGame((s) => s.settings.theme);
  const init = useGame((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (!ready) {
    return (
      <div className="app app--loading">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="app">
      {screen === 'home' && <Home />}
      {screen === 'play' && <Play />}
      {screen === 'stats' && <StatsView />}
      {screen === 'settings' && <SettingsView />}
    </div>
  );
}
