import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/silkscreen/400.css';
import './ui/theme.css';
import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { BattleScreen } from './ui/battle/BattleScreen';
import { installDebugApi, readParams } from './ui/debug';
import { GameStore, scenarioConfig } from './ui/store';
import { applyScenarioSetup } from './ui/scenarios';

const params = readParams();
const store = new GameStore(scenarioConfig(params.seed, params.scenario));
function loadScenario(name: string) {
  store.load(scenarioConfig(params.seed, name));
  applyScenarioSetup(store, name);
}
installDebugApi(store, loadScenario);
applyScenarioSetup(store, params.scenario);

function App() {
  const [, bump] = useState(0);
  useSyncExternalStore(store.subscribe, store.getVersion);
  return (
    <div className={`app${store.skip ? ' no-anim' : ''}`} data-testid="app">
      <BattleScreen
        store={store}
        onRestart={() => {
          store.load(scenarioConfig(`${params.seed}-${Date.now()}`, params.scenario));
          bump((n) => n + 1);
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
