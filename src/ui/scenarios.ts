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
  if (name === 'levels') {
    // Put the levelled cards on the board so Spark, Flame and Fire sit side by side.
    const wasSkip = store.skip;
    store.skip = true;
    const cards = store.state.sides[0].cards;
    const lanes = [0, 1, 2, 3] as const;
    cards.slice(-3).forEach((c, i) => store.dispatch({ type: 'summon', card: c.uid, lane: lanes[i]!, row: 0 }));
    store.skip = wasSkip;
    const last = store.state.sides[0].cards[store.state.sides[0].cards.length - 1];
    if (last) store.select({ kind: 'card', uid: last.uid, side: 0 });
  }
  if (name === 'card-inspect') {
    const first = store.state.sides[0].cards[0];
    if (first) store.select({ kind: 'card', uid: first.uid, side: 0 });
  }
}
