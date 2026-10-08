import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/silkscreen/400.css';
import './ui/theme.css';
import './ui/run.css';
import './ui/gloom.css';
import { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { RunApp, SandboxApp } from './ui/App';
import { installDebugApi, readParams } from './ui/debug';
import { RunStore } from './ui/runStore';
import { GameStore, scenarioConfig } from './ui/store';
import { applyScenarioSetup, applyRunScenario, isBattleScenario } from './ui/scenarios';
import { installAudioUnlock } from './ui/audio';
import { SettingsButton } from './ui/SettingsPanel';
import { TooltipLayer } from './ui/tooltip';
import { Gloom } from './ui/Gloom';

const params = readParams();
installAudioUnlock();

if (isBattleScenario(params.scenario)) {
  // The battle sandbox: one fight, no run around it.
  const store = new GameStore(scenarioConfig(params.seed, params.scenario));
  function loadScenario(name: string) {
    store.load(scenarioConfig(params.seed, name));
    applyScenarioSetup(store, name);
  }
  installDebugApi({ battle: store, loadScenario });
  applyScenarioSetup(store, params.scenario);
  function Sandbox() {
    const [, bump] = useState(0);
    useSyncExternalStore(store.subscribe, store.getVersion);
    return (
      <div className={`app${store.skip ? ' no-anim' : ''}`} data-testid="app">
        <Gloom />
        <SettingsButton />
        <TooltipLayer />
        <SandboxApp
          store={store}
          onRestart={() => {
            store.load(scenarioConfig(`${params.seed}-${Date.now()}`, params.scenario));
            bump((n) => n + 1);
          }}
        />
      </div>
    );
  }
  createRoot(document.getElementById('root')!).render(<Sandbox />);
} else {
  const run = new RunStore(params.seed);
  installDebugApi({ run, loadScenario: (name) => applyRunScenario(run, name) });
  void run.boot().then(() => applyRunScenario(run, params.scenario));
  function Game() {
    useSyncExternalStore(run.subscribe, run.getVersion);
    const skip = run.battle?.skip ?? false;
    return (
      <div className={`app${skip ? ' no-anim' : ''}`} data-testid="app">
        <Gloom />
        <SettingsButton />
        <TooltipLayer />
        <RunApp store={run} />
      </div>
    );
  }
  createRoot(document.getElementById('root')!).render(<Game />);
}
