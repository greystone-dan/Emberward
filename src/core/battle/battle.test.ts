import { describe, expect, it } from 'vitest';
import { FLAGS } from '../../config/flags';
import { applyAction, legalActions, newBattle, spellCost } from './battle';
import { hpOf } from './stats';
import { act, at, card, clash, setup, unit } from '../test/kit';
import { scenarioFight } from '../scenarios';

describe('battle flow', () => {
  it('starts in wave 1 with 3 actions each and the player first', () => {
    const st = setup({ playerCards: ['Lampwick Squire'] });
    expect(st.wave).toBe(1);
    expect(st.actionsLeft).toEqual([FLAGS.actionsInWaveOne, FLAGS.actionsInWaveOne]);
    expect(st.turn).toBe(0);
    expect(st.initiative).toBe(0);
  });

  it('summon is free, spends the card, fires Kindle and alternates the turn', () => {
    let st = setup({ playerCards: ['Lampwick Squire'], enemyCards: ['e_sentry'] });
    st = act(st, { type: 'summon', card: card(st, 'Lampwick Squire'), lane: 1, row: 0 });
    const u = unit(st, 'Lampwick Squire');
    expect(u.shield).toBe(2); // Kindle: Shield 2
    expect(st.sides[0].cards[0]!.spent).toBe(true);
    expect(st.sides[0].embers).toBe(10);
    expect(st.turn).toBe(1);
    expect(st.actionsLeft[0]).toBe(2);
  });

  it('a spent card is not playable again and occupied cells are refused', () => {
    let st = setup({ playerCards: ['Lampwick Squire', 'Tallow Imp'] });
    st = act(st, { type: 'summon', card: card(st, 'Lampwick Squire'), lane: 0, row: 0 });
    st = act(st, { type: 'pass' }); // enemy passes
    const acts = legalActions(st);
    expect(acts.filter((a) => a.type === 'summon' && a.card === 1000)).toHaveLength(0);
    expect(acts.filter((a) => a.type === 'summon' && a.lane === 0 && a.row === 0)).toHaveLength(0);
    const r = applyAction(st, { type: 'summon', card: 1001, lane: 0, row: 0 });
    expect(r.state.errors[0]).toMatch(/CELL_OCCUPIED/);
  });

  it('passing ends a side\'s wave; first to pass gains 1 ember; the other side keeps acting', () => {
    let st = setup({ playerCards: ['Lampwick Squire', 'Tallow Imp'], enemyCards: ['e_sentry', 'e_sentry'] });
    st = act(st, { type: 'pass' });
    expect(st.sides[0].embers).toBe(11);
    expect(st.passed[0]).toBe(true);
    expect(st.turn).toBe(1);
    st = act(st, { type: 'summon', card: card(st, 'e_sentry', 1), lane: 0, row: 0 });
    expect(st.turn).toBe(1); // player passed, enemy keeps the turn
    expect(st.wave).toBe(1);
    st = act(st, { type: 'pass' });
    expect(st.sides[1].embers).toBe(5); // not first to pass
    expect(st.wave).toBe(2); // Clash resolved, next wave
    expect(st.initiative).toBe(1);
    expect(st.turn).toBe(1);
    expect(st.actionsLeft).toEqual([2, 2]);
  });

  it('running out of actions on both sides resolves the Clash', () => {
    let st = setup({ playerCards: ['Lampwick Squire', 'Tallow Imp', 'Drift Lantern'], enemyCards: ['e_sentry', 'e_sentry', 'e_sentry'] });
    for (let i = 0; i < 3; i++) {
      st = act(st, { type: 'summon', card: st.sides[0].cards[i]!.uid, lane: i as 0 | 1 | 2, row: 2 });
      st = act(st, { type: 'summon', card: st.sides[1].cards[i]!.uid, lane: i as 0 | 1 | 2, row: 2 });
    }
    expect(st.wave).toBe(2);
  });

  it('cast pays the cost, needs a legal target and resolves immediately', () => {
    let st = setup({ playerCards: ['Lampwick Squire'], enemy: [{ name: 'e_sentry', lane: 2, row: 0 }], embers: 3 });
    const c = card(st, 'Lampwick Squire');
    expect(spellCost(st, 0, st.sides[0].cards[0]!)).toBe(1);
    const bad = applyAction(st, { type: 'cast', card: c, targets: [{ lane: 9 as 0 }] });
    expect(bad.state.errors[0]).toMatch(/BAD_TARGET/);
    st = act(st, { type: 'cast', card: c, targets: [{ lane: 2 }] });
    expect(st.sides[0].embers).toBe(2);
    expect(hpOf(st, unit(st, 'Drowned Sentry', 1))).toBe(1); // 4 - 3
    expect(st.sides[0].cards[0]!.spent).toBe(true);
  });

  it('cannot cast without enough embers', () => {
    const st = setup({ playerCards: ['Kiln Mortar'], enemy: [{ name: 'e_sentry', lane: 0, row: 0 }], embers: 2 });
    expect(legalActions(st).filter((a) => a.type === 'cast')).toHaveLength(0);
    const r = applyAction(st, { type: 'cast', card: 1000, targets: [{ unit: unit(st, 'Drowned Sentry', 1).id }] });
    expect(r.state.errors[0]).toMatch(/NOT_ENOUGH_EMBERS/);
  });

  it('moving is not an action: Swift steps are free, extra steps cost 1, Rooted never moves', () => {
    let st = setup({ player: [{ name: 'Tallow Imp', lane: 0, row: 2 }, { name: 'Lantern Sentry', lane: 3, row: 2 }], embers: 5 });
    const imp = unit(st, 'Tallow Imp');
    st = act(st, { type: 'move', unit: imp.id, lane: 0, row: 1 });
    expect(st.actionsLeft[0]).toBe(3);
    expect(st.sides[0].embers).toBe(5); // Swift 1
    expect(st.turn).toBe(0);
    st = act(st, { type: 'move', unit: imp.id, lane: 1, row: 1 });
    expect(st.sides[0].embers).toBe(4); // paid step
    expect(legalActions(st).some((a) => a.type === 'move' && a.unit === unit(st, 'Lantern Sentry').id)).toBe(false);
    const r = applyAction(st, { type: 'move', unit: unit(st, 'Lantern Sentry').id, lane: 2, row: 2 });
    expect(r.state.errors[0]).toMatch(/ROOTED/);
  });

  it('after the last wave the side with more face damage wins; the player takes the difference as HP', () => {
    // Enemy archer shoots the face every wave; the player has nothing.
    let st = setup({ enemy: [{ name: 'e_hook', lane: 0, row: 2 }] });
    for (let w = 0; w < FLAGS.wavesPerBattle; w++) st = clash(st).state;
    expect(st.phase).toBe('over');
    expect(st.outcome).toBe('waveLimit');
    expect(st.winner).toBe(1);
    expect(st.sides[0].hp).toBe(FLAGS.playerHp - 6 - 6); // 6 face damage taken + the difference again
  });

  it('a Warden at 0 loses at once; losing the whole board is not a loss', () => {
    let st = setup({ player: [{ name: 'Bone Gnawer', lane: 0, row: 0 }], enemy: [{ name: 'e_salthound', lane: 0, row: 0 }] });
    st.sides[1].hp = 1;
    st = clash(st).state;
    expect(st.phase).toBe('action'); // the player's gnawer died but the hound only killed a unit
    expect(st.units.filter((u) => u.side === 0 && !u.token)).toHaveLength(0);
    let st2 = setup({ player: [{ name: 'Marrowhound', lane: 1, row: 0 }] });
    st2.sides[1].hp = 2;
    st2 = clash(st2).state;
    expect(st2.phase).toBe('over');
    expect(st2.winner).toBe(0);
    expect(st2.outcome).toBe('kill');
  });

  it('simultaneous zero: the player wins by flag', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 0 }], enemy: [{ name: 'e_salthound', lane: 1, row: 0 }] });
    st.sides[0].hp = 1;
    st.sides[1].hp = 1;
    st = clash(st).state;
    expect(st.winner).toBe(FLAGS.simultaneousZeroPlayerWins ? 0 : 1);
  });

  it('applyAction never mutates its input and state round-trips through JSON', () => {
    const st = setup({ playerCards: ['Lampwick Squire'] });
    const snapshot = JSON.stringify(st);
    applyAction(st, { type: 'summon', card: 1000, lane: 0, row: 0 });
    expect(JSON.stringify(st)).toBe(snapshot);
    expect(JSON.parse(JSON.stringify(st))).toEqual(st);
  });

  it('newBattle is deterministic for a seed and config', () => {
    const a = newBattle(scenarioFight('s', 0, 0)).state;
    const b = newBattle(scenarioFight('s', 0, 0)).state;
    expect(a).toEqual(b);
  });

  it('actions after the battle ends are errors, and the enemy summons appear on the enemy grid', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 1, row: 0 }], enemyCards: ['e_sentry'] });
    st.sides[1].hp = 1;
    st = act(st, { type: 'pass' });
    st = act(st, { type: 'summon', card: card(st, 'e_sentry', 1), lane: 3, row: 0 });
    expect(at(st, 1, 3, 0)?.name).toBe('Drowned Sentry');
    st = act(st, { type: 'pass' });
    expect(st.phase).toBe('over');
    expect(applyAction(st, { type: 'pass' }).state.errors).toContain('ACTION_AFTER_END');
  });
});
