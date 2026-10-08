import { describe, expect, it } from 'vitest';
import { activeTiers, effectiveAtk, effectiveMaxHp, hpOf, kinship, traitCounts } from './stats';
import { act, clash, maybeUnit, setup, unit } from '../test/kit';

describe('traits (SPEC §8)', () => {
  it('counts different cards: copies and Flames count once, tokens never', () => {
    const st = setup({ player: [{ name: 'Tallow Imp', lane: 0, row: 2 }, { name: 'Tallow Imp', lane: 1, row: 2 }, { name: 'Lampwick Squire', lane: 0, row: 0, level: 2 }, { name: 'Lampwick Squire', lane: 1, row: 0 }, { name: 't_wisp', lane: 2, row: 0 }] });
    const counts = traitCounts(st, 0);
    expect(counts.get('Waxborn')).toBe(2);
    expect(counts.get('Marksman')).toBe(1);
    expect(counts.get('Guardian')).toBe(1);
    expect(activeTiers(st, 0)).toEqual([{ trait: 'Waxborn', n: 2, count: 2 }]);
  });
  it('tiers stack and are recomputed live when a unit leaves', () => {
    let st = setup({ player: [{ name: 'Bell Warden', lane: 0, row: 0 }, { name: 'Gargoyle', lane: 1, row: 0 }, { name: 'Great Bell', lane: 2, row: 1 }, { name: 'Chain Acolyte', lane: 3, row: 0 }], enemy: [{ name: 'Bellfounder Titan', lane: 1, row: 0 }] });
    unit(st, 'Gargoyle').damage = 4;
    expect(traitCounts(st, 0).get('Bellforged')).toBe(4);
    st = clash(st).state; // Gargoyle dies to the Titan
    expect(maybeUnit(st, 'Gargoyle')).toBeUndefined();
    expect(traitCounts(st, 0).get('Bellforged')).toBe(3);
    expect(activeTiers(st, 0).find((t) => t.trait === 'Bellforged')?.n).toBe(2);
  });
  it('Kinship: +1/+1 per orthogonal neighbour sharing a trait, max +2', () => {
    const st = setup({ player: [{ name: 'Tallow Imp', lane: 1, row: 1 }, { name: 'Lampwick Squire', lane: 0, row: 1 }, { name: 'Wickmonger', lane: 2, row: 1 }, { name: 'Ember Hound', lane: 1, row: 0 }, { name: 'Marrowhound', lane: 1, row: 2 }] });
    const imp = unit(st, 'Tallow Imp');
    expect(kinship(st, imp)).toBe(2);
    expect(effectiveAtk(st, imp)).toBe(1 + 2);
    expect(effectiveMaxHp(st, imp)).toBe(2 + 2);
    expect(kinship(st, unit(st, 'Marrowhound'))).toBe(0); // Beast/Bonebound/Reaper shares nothing with the Imp
  });
  it('Bellforged 2 shields each wave; Guardian 2 shields the ally behind a Front-row Guardian', () => {
    const st = setup({ player: [{ name: 'Bell Warden', lane: 0, row: 0 }, { name: 'Tallow Bulwark', lane: 1, row: 0 }, { name: 'Tower Archer', lane: 0, row: 2 }] });
    expect(unit(st, 'Tower Archer').shield).toBe(2 + 2); // Bellforged 2 + Guardian 2 (Bell Warden, Tallow Bulwark, Tower Archer are all Bellforged → 3; Guardians: 2)
    expect(unit(st, 'Tallow Bulwark').shield).toBe(2);
  });
  it('Marksman 2 gives Back-row Marksmen +1 Power; Tower Archer +1 with a Guardian Ahead', () => {
    const st = setup({ player: [{ name: 'Tower Archer', lane: 0, row: 2 }, { name: 'Drowned Archer', lane: 2, row: 2 }, { name: 'Bell Warden', lane: 0, row: 1 }] });
    expect(effectiveAtk(st, unit(st, 'Tower Archer'))).toBe(2 + 1 + 1 + 1); // Marksman 2 in the Back row, Guardian Ahead, Kinship with it
    expect(effectiveAtk(st, unit(st, 'Drowned Archer'))).toBe(2 + 1);
  });
  it('Brawler 2: +2 health, +1 Power with another Brawler Beside', () => {
    const st = setup({ player: [{ name: 'Iron Penitent', lane: 0, row: 0 }, { name: 'Wandering Squire', lane: 1, row: 0 }] });
    const p = unit(st, 'Iron Penitent');
    expect(effectiveMaxHp(st, p)).toBe(5 + 2 + 1); // +2 Brawler, +1 Kinship (both Pilgrim/Brawler)
    expect(effectiveAtk(st, p)).toBe(3 + 1 + 1);
  });
  it('Chanter 2 lets auras reach diagonals', () => {
    const st = setup({ player: [{ name: 'Candlewright', lane: 1, row: 1 }, { name: 'Smoke Wraith', lane: 3, row: 2 }, { name: 'Marrowhound', lane: 0, row: 0 }, { name: 'Wandering Squire', lane: 1, row: 0 }] });
    expect(effectiveAtk(st, unit(st, 'Marrowhound'))).toBe(3 + 1); // diagonal aura
    expect(effectiveAtk(st, unit(st, 'Wandering Squire'))).toBe(2 + 1 + 1); // Ahead aura + Kinship (Pilgrim)
  });
  it('Drowned 2 adds +1 to Poison applied; Waxborn 2 adds +1 to hits on Burning enemies', () => {
    let st = setup({ player: [{ name: 'Drowned Archer', lane: 0, row: 2 }, { name: 'Moray', lane: 1, row: 0 }], enemy: [{ name: 'e_crab', lane: 0, row: 0 }] });
    st = clash(st).state;
    expect(unit(st, 'Belfry Crab', 1).poison).toBe(2 - 1); // 1 + 1, then decayed by 1
    st = setup({ player: [{ name: 'Tallow Imp', lane: 0, row: 2 }, { name: 'Wickmonger', lane: 1, row: 1 }], enemy: [{ name: 'Kelp Wraith', lane: 0, row: 0 }] });
    unit(st, 'Kelp Wraith', 1).burn = 1;
    st = clash(st).state;
    expect(hpOf(st, unit(st, 'Kelp Wraith', 1))).toBe(5 - 2 - 2); // 1+1 from the Imp on a Burning target, then a Burn 2 tick (1 + 1 applied)
  });
  it('Reaper 2 pays 1 ember per kill; Binder 2 stuns pulled enemies', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 0 }, { name: 'The Grey Reaper', lane: 1, row: 0 }], enemy: [{ name: 'e_salthound', lane: 1, row: 0 }] });
    st = clash(st).state;
    expect(st.sides[0].embers).toBe(10 + 1 + 1); // pass first + Reaper 2
    st = setup({ player: [{ name: 'Moray', lane: 0, row: 0 }, { name: 'Kelp Wraith', lane: 1, row: 1 }], playerCards: ['Siren of Vael'], enemy: [{ name: 'e_hook', lane: 2, row: 2 }], embers: 5 });
    st = act(st, { type: 'cast', card: 1000, targets: [{ lane: 2 }] });
    const hook = unit(st, 'Tide Hook', 1);
    expect(hook.row).toBe(0);
    expect(hook.stunned).toBe(true);
  });
  it('Abyssal 1: the first Abyssal summoned does not use an action', () => {
    let st = setup({ playerCards: ['The Grey Reaper', 'Leviathan Calf'] });
    st = act(st, { type: 'summon', card: 1000, lane: 0, row: 0 });
    expect(st.actionsLeft[0]).toBe(3);
  });
});
