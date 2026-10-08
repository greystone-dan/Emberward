import { useEffect, useSyncExternalStore } from 'react';
import { BattleScreen } from './battle/BattleScreen';
import type { RunStore } from './runStore';
import { DriftScreen, HearthScreen, MapScreen, MarketScreen, MusterScreen, RewardScreen, RunOverScreen, ScoutScreen, ShrineScreen, TitleScreen, WardenSelect } from './run/RunScreens';
import type { GameStore } from './store';

/** The whole game: a run store that hands the battle screen a battle store while a battle is on. */
export function RunApp({ store }: { store: RunStore }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const run = store.run;
  const screen = store.screen;
  if (screen === 'title' || !run) return <TitleScreen store={store} />;
  if (screen === 'battle' && store.battle) return <BattleScreen store={store.battle} onRestart={() => store.leaveBattle()} restartLabel="Continue" />;
  switch (run.phase) {
    case 'wardenSelect':
      return <WardenSelect store={store} run={run} />;
    case 'drift':
      return <DriftScreen store={store} run={run} />;
    case 'map':
      return <MapScreen store={store} run={run} />;
    case 'muster':
      return <MusterScreen store={store} run={run} />;
    case 'reward':
      return <RewardScreen store={store} run={run} />;
    case 'market':
      return <MarketScreen store={store} run={run} />;
    case 'hearth':
      return <HearthScreen store={store} run={run} />;
    case 'shrine':
      return <ShrineScreen store={store} run={run} />;
    case 'scout':
      return <ScoutScreen store={store} run={run} />;
    case 'over':
      return <RunOverScreen store={store} run={run} />;
    case 'battle':
      return <TitleScreen store={store} />;
  }
}

/** The standalone battle sandbox (`?scenario=battle-*`), kept for tests and screenshots. */
export function SandboxApp({ store, onRestart }: { store: GameStore; onRestart: () => void }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  useEffect(() => () => store.stopClock(), [store]);
  return <BattleScreen store={store} onRestart={onRestart} />;
}
