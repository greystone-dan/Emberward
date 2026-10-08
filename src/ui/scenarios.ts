import { scriptedIntent } from '../core/ai/scripted';
import type { GameStore } from './store';

/**
 * Screenshot and test scenarios (`?scenario=`): what to do after the battle is built.
 * - battle-wave1: a fresh fight (nothing extra).
 * - battle-wave3: both sides play scripted until wave 3 begins, then it is the player's turn.
 * - card-inspect: the first card in the player's deck is selected.
 * - elite0..2 / boss / boss-wave3: an elite or the boss battle (the greedy AI); boss-waveN plays on to wave N.
 */
export function applyScenarioSetup(store: GameStore, name: string): void {
  const wm = /^(?:battle|boss)-wave(\d)$/.exec(name);
  if (wm) {
    const target = Number(wm[1]);
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

export function isBattleScenario(name: string): boolean {
  return /^(fight\d+|warden\d-fight\d+|battle-wave\d|card-inspect|levels|elite\d|boss|boss-wave\d)$/.test(name);
}

/**
 * Run scenarios for screenshots and tests. The bot plays until the named phase is on screen.
 * - run-warden: the Warden select. run-drift: the opening Drift. run-map / run-muster / run-market /
 *   run-hearth / run-shrine / run-reward: the first such screen the bot reaches. run-battle: a run battle.
 */
export function applyRunScenario(store: import('./runStore').RunStore, name: string): void {
  const m = /^run-(\w+)$/.exec(name);
  if (!m) return;
  const want = m[1]!;
  store.newRun();
  if (want === 'warden') return;
  store.dispatch({ type: 'chooseWarden', warden: 0 });
  if (want === 'drift') return;
  const target: Record<string, string> = { map: 'map', muster: 'muster', market: 'market', hearth: 'hearth', shrine: 'shrine', reward: 'reward', battle: 'battle', over: 'over' };
  const phase = target[want];
  if (!phase) return;
  let guard = 0;
  while (store.run && store.run.phase !== phase && store.run.phase !== 'over' && guard++ < 3000) {
    // Step the bot one action at a time, but never stop inside the opening Drift for later targets.
    store.bot(1);
  }
  if (want !== 'battle' && store.battle) store.leaveBattle();
}
