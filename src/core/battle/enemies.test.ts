import { describe, expect, it } from 'vitest';
import { FLAGS } from '../../config/flags';
import { applyAction, legalActions, newBattle, type BattleConfig } from './battle';
import { bossConfig } from '../run/encounters';
import { at, card, clash, setup, unit } from '../test/kit';
import type { BattleState } from '../types';

/** SPEC §12: the three elites each break one rule; the boss has phases; elites and the boss use the greedy AI. */

function withEnemy(st: BattleState, patch: Partial<BattleConfig>): BattleState {
  void st;
  return newBattle({ seed: 't', player: { hp: FLAGS.playerHp, embers: 10, cards: [] }, enemy: { hp: 22, embers: 4, cards: [] }, ...patch }).state;
}

describe('elites', () => {
  it('The Choir Abbot fills two empty cells on its side with Choristers at Wave End while it lives (lane A, Front first)', () => {
    const st = newBattle({
      seed: 't',
      kind: 'elite',
      elite: { kind: 'choirAbbot' },
      player: { hp: FLAGS.playerHp, embers: 10, cards: [] },
      enemy: { hp: 22, embers: 4, cards: [], board: [{ key: 'e_abbot', level: 1, lane: 1, row: 2 }] },
    }).state;
    const after = clash(st).state;
    const enemies = after.units.filter((u) => u.side === 1);
    expect(enemies).toHaveLength(1 + FLAGS.abbotRefill);
    const choristers = enemies.filter((u) => u.key === 't_chorister');
    expect(choristers).toHaveLength(2);
    expect(choristers.map((u) => [u.lane, u.row])).toEqual([[0, 0], [0, 1]]);
  });

  it('The Tide-Caller pulls the player Front row one lane toward A at Wave Start; Rooted units stay', () => {
    const st = newBattle({
      seed: 't',
      kind: 'elite',
      elite: { kind: 'tideCaller' },
      player: { hp: FLAGS.playerHp, embers: 10, cards: [], board: [{ key: 'e_sentry', level: 1, lane: 1, row: 0 }, { key: 'e_salthound', level: 1, lane: 3, row: 0 }] },
      enemy: { hp: 22, embers: 4, cards: [], board: [{ key: 'e_tideCaller', level: 1, lane: 2, row: 2 }] },
    }).state;
    const after = clash(st).state;
    expect(after.wave).toBe(2);
    expect(at(after, 0, 1, 0)?.key).toBe('e_sentry'); // Rooted
    expect(at(after, 0, 2, 0)?.key).toBe('e_salthound');
  });

  it('The Brazier Knight is immune to Burn and heals its Warden one per Burning unit at Wave End, capped', () => {
    let st = setup({ kind: 'elite', playerCards: ['Kiln Mortar'], enemy: [{ name: 'e_brazierKnight', lane: 1, row: 0 }, { name: 'e_waxen', lane: 2, row: 0 }], embers: 10 });
    st = { ...st, elite: { kind: 'brazierKnight' } };
    st.sides[1].hp = 10;
    // Kiln Mortar's spell burns a cell and the cells around it: aim at the Waxen beside the Knight.
    const waxenId = st.units.find((u) => u.side === 1 && u.key === 'e_waxen')!.id;
    const r = applyAction(st, { type: 'cast', card: card(st, 'Kiln Mortar'), targets: [{ unit: waxenId }] });
    expect(r.state.errors).toEqual([]);
    expect(unit(r.state, 'The Brazier Knight', 1).burn).toBe(0);
    expect(r.state.units.find((u) => u.id === waxenId)!.burn).toBeGreaterThan(0);
    const burning = r.state.units.filter((u) => u.burn > 0).length;
    expect(burning).toBeGreaterThan(0);
    // Both sides pass: the only attacks are the Knight's and the Waxen's into empty lanes (face), so the
    // Warden takes no damage and Wave End heals it one per Burning unit still standing.
    const res = clash(r.state);
    const stillBurning = r.state.units.filter((u) => u.burn > 0 && res.state.units.some((x) => x.id === u.id)).length;
    expect(res.state.sides[1].hp).toBe(10 + Math.min(FLAGS.knightHealCap, stillBurning));
  });
});

describe('boss', () => {
  it('snuffs one lane a wave, two at 26 HP with Kiln Breath, and its own lane D at 12 HP', () => {
    let st = withEnemy(null as never, { kind: 'boss', boss: true, player: { hp: FLAGS.playerHp, embers: 10, cards: [], board: [{ key: 'e_salthound', level: 1, lane: 1, row: 0 }, { key: 'e_salthound', level: 1, lane: 2, row: 1 }] }, enemy: { hp: 40, embers: 5, cards: [] } });
    expect(st.boss?.darkLanes).toEqual([0]);
    expect(st.boss?.nextDarkLanes).toEqual([1]);
    st = clash(st).state;
    expect(st.boss?.darkLanes).toEqual([1]);
    expect(st.boss?.nextDarkLanes).toEqual([2]);
    expect(st.units.every((u) => u.burn === 0)).toBe(true);
    st.sides[1].hp = FLAGS.bossPhase2Hp;
    const r = clash(st);
    st = r.state;
    expect(st.boss?.nextDarkLanes).toHaveLength(2);
    expect(r.events.some((e) => e.type === 'note' && e.text.startsWith('Kiln Breath'))).toBe(true);
    expect(at(st, 0, 1, 0)?.burn).toBeGreaterThan(0); // frontmost unit scorched
    expect(st.boss?.ownLaneDark).toBe(false);
    st.sides[1].hp = FLAGS.bossPhase3Hp;
    st = clash(st).state;
    expect(st.boss?.ownLaneDark).toBe(true);
  });
});

describe('boss phases and relics', () => {
  it('a card with fromWave is not playable before that wave', () => {
    const st = newBattle({ seed: 'p', kind: 'boss', boss: true, player: { hp: FLAGS.playerHp, embers: 10, cards: [] }, enemy: bossConfig() }).state;
    st.turn = 1;
    const furnace = st.sides[1].cards.find((c) => c.fromWave === 5)!;
    expect(legalActions(st, 1).some((a) => a.type === 'summon' && a.card === furnace.uid)).toBe(false);
    const r = applyAction(st, { type: 'summon', card: furnace.uid, lane: 0, row: 2 });
    expect(r.state.errors[0]).toMatch(/NOT_YET/);
    const effigy = st.sides[1].cards.find((c) => c.fromWave === undefined)!;
    expect(legalActions(st, 1).some((a) => a.type === 'summon' && a.card === effigy.uid)).toBe(true);
  });
  it('Cracked Bell shields units summoned into the Front row in wave 1', () => {
    let st = setup({ playerCards: ['Wandering Squire', 'Wandering Squire'], relics: ['Cracked Bell'] });
    st = applyAction(st, { type: 'summon', card: card(st, 'Wandering Squire'), lane: 0, row: 0 }).state;
    expect(at(st, 0, 0, 0)?.shield).toBe(FLAGS.crackedBellShield);
    st = applyAction(st, { type: 'pass' }).state; // enemy
    st = applyAction(st, { type: 'summon', card: card(st, 'Wandering Squire'), lane: 1, row: 1 }).state;
    expect(at(st, 0, 1, 1)?.shield).toBe(0);
  });
});
