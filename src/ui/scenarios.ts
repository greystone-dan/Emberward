import { scriptedIntent } from '../core/ai/scripted';
import type { GameStore } from './store';

/**
 * Screenshot and test scenarios (`?scenario=`): what to do after the battle is built.
 * - battle-wave1: a fresh fight (nothing extra).
 * - battle-wave3: both sides play scripted until wave 3 begins, then it is the player's turn.
 * - card-inspect: the first card in the player's deck is selected.
 */
export function applyScenarioSetup(store: GameStore, name: string): void {
  if (name === 'battle-wave3' || name === 'battle-wave5') {
    const target = name === 'battle-wave3' ? 3 : 5;
    const wasSkip = store.skip;
    store.skip = true;
    let guard = 0;
    while (store.state.phase === 'action' && store.state.wave < target && guard++ < 200) {
      if (store.state.turn === 0) store.dispatch(scriptedIntent(store.state, 0).action);
      else store.advanceTime(10_000);
    }
    store.skip = wasSkip;
  }
  if (name === 'card-inspect') {
    const first = store.state.sides[0].cards[0];
    if (first) store.select({ kind: 'card', uid: first.uid, side: 0 });
  }
}
