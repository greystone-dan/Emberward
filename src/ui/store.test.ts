import { describe as suite, expect, it } from 'vitest';
import { GameStore, scenarioConfig } from './store';
import { applyScenarioSetup } from './scenarios';
import { scriptedIntent } from '../core/ai/scripted';

suite('ui store', () => {
  it('plays a whole battle with skipped animations and keeps the log free of unnamed units', () => {
    const store = new GameStore(scenarioConfig('11', 'fight0'));
    store.skipAnimations();
    let guard = 0;
    while (store.state.phase === 'action' && guard++ < 200) store.dispatch(scriptedIntent(store.state, 0).action);
    expect(store.state.phase).toBe('over');
    expect(store.log.some((l) => /#\d+/.test(l))).toBe(false);
    expect(store.state.errors).toEqual([]);
    expect(JSON.parse(store.exportReplay()).actions.length).toBe(store.actions.length);
  });

  it('animates the Clash as frames that end on the true state, and the enemy answers after a pause', () => {
    const store = new GameStore(scenarioConfig('5', 'fight1'));
    const first = store.state.sides[0].cards[0]!;
    expect(store.dispatch({ type: 'summon', card: first.uid, lane: 0, row: 0 })).toBe(true);
    expect(store.busy).toBe(true);
    store.advanceTime(10_000); // the summon frame, then the enemy's think pause starts
    store.advanceTime(10_000);
    while (store.busy || (store.state.turn as number) === 1) store.advanceTime(10_000);
    expect(store.state.turn).toBe(0);
    store.pass();
    while (store.busy || (store.state.phase === 'action' && store.state.turn === 1)) store.advanceTime(1_000);
    expect(store.view).toBe(store.state);
    expect(store.state.wave).toBe(2);
    expect(store.log.join('\n')).toMatch(/Wave 2/);
  });

  it('builds the levels scenario with Spark, Flame and Fire on the board', () => {
    const store = new GameStore(scenarioConfig('1', 'levels'));
    store.skip = true;
    applyScenarioSetup(store, 'levels');
    const levels = store.state.units.filter((u) => u.side === 0).map((u) => u.level).sort();
    expect(levels).toContain(2);
    expect(levels).toContain(3);
  });
});
