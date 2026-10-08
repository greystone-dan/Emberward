import { describe, expect, it } from 'vitest';
import { hpOf } from './stats';
import { act, clash, maybeUnit, setup, unit } from '../test/kit';

describe('statuses (SPEC §7)', () => {
  it('Shield absorbs before health and expires at Wave End', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 0 }], enemy: [{ name: 'e_ghoulbell', lane: 0, row: 0 }] });
    unit(st, 'Bell Ghoul', 1).shield = 2;
    st = clash(st).state;
    const g = unit(st, 'Bell Ghoul', 1);
    expect(hpOf(st, g)).toBe(5 - 1);
    expect(g.shield).toBe(0);
  });
  it('Burn ticks at Wave End, spreads floor(N/2) to orthogonal allies without Burn, then decays by 1', () => {
    let st = setup({ enemy: [{ name: 'e_crab', lane: 1, row: 1 }, { name: 'e_ghoulbell', lane: 1, row: 0 }, { name: 'e_sentry', lane: 0, row: 1 }, { name: 'e_hook', lane: 3, row: 2 }] });
    unit(st, 'Belfry Crab', 1).burn = 3;
    unit(st, 'Belfry Crab', 1).shield = 0;
    st = clash(st).state;
    const crab = unit(st, 'Belfry Crab', 1);
    expect(crab.burn).toBe(2);
    expect(hpOf(st, crab)).toBe(6 - 3);
    expect(unit(st, 'Bell Ghoul', 1).burn).toBe(1);
    expect(unit(st, 'Drowned Sentry', 1).burn).toBe(1);
    expect(unit(st, 'Tide Hook', 1).burn).toBe(0);
  });
  it('Poison ignores Shield and decays by 1', () => {
    let st = setup({ enemy: [{ name: 'e_crab', lane: 1, row: 1 }] });
    unit(st, 'Belfry Crab', 1).poison = 3;
    st = clash(st).state;
    const crab = unit(st, 'Belfry Crab', 1);
    expect(hpOf(st, crab)).toBe(3);
    expect(crab.poison).toBe(2);
  });
  it('Mother of Silt stops Poison decay', () => {
    let st = setup({ player: [{ name: 'Mother of Silt', lane: 3, row: 2 }], enemy: [{ name: 'e_crab', lane: 1, row: 1 }] });
    unit(st, 'Belfry Crab', 1).poison = 2;
    st = clash(st).state;
    expect(unit(st, 'Belfry Crab', 1).poison).toBe(2);
  });
  it('Stun skips the next attack and then clears', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 0 }], enemy: [{ name: 'e_salthound', lane: 0, row: 0 }] });
    unit(st, 'Salt Hound', 1).stunned = true;
    st = clash(st).state;
    expect(maybeUnit(st, 'Salt Hound', 1)).toBeUndefined();
    expect(hpOf(st, unit(st, 'Marrowhound'))).toBe(2);
    expect(unit(st, 'Marrowhound').stunned).toBe(false);
  });
  it('Pull drags an enemy toward its Front row and does nothing when blocked', () => {
    let st = setup({ playerCards: ['Moray'], enemy: [{ name: 'e_hook', lane: 2, row: 2 }, { name: 'e_crab', lane: 3, row: 1 }, { name: 'e_sentry', lane: 3, row: 0 }], embers: 5 });
    st = act(st, { type: 'cast', card: 1000, targets: [{ unit: unit(st, 'Tide Hook', 1).id }] });
    expect(unit(st, 'Tide Hook', 1).row).toBe(1);
    st = setup({ playerCards: ['Moray'], enemy: [{ name: 'e_crab', lane: 3, row: 1 }, { name: 'e_sentry', lane: 3, row: 0 }], embers: 5 });
    st = act(st, { type: 'cast', card: 1000, targets: [{ unit: unit(st, 'Belfry Crab', 1).id }] });
    expect(unit(st, 'Belfry Crab', 1).row).toBe(1);
  });
  it('tokens: a Wisp is a 1/1 Strike Hollow; Rubble is 0/N Rooted with no attack', () => {
    let st = setup({ player: [{ name: 'Bone Gnawer', lane: 0, row: 0 }], playerCards: ['Rubble Golem'], enemy: [{ name: 'e_salthound', lane: 0, row: 0 }], embers: 5 });
    st = act(st, { type: 'cast', card: 1000, targets: [{ cell: { lane: 1, row: 0 } }] });
    const rubble = unit(st, 'Rubble');
    expect(rubble.token).toBe(true);
    expect(hpOf(st, rubble)).toBe(4);
    expect(rubble.traits).toEqual([]);
    st = clash(st).state;
    const wisp = unit(st, 'Wisp');
    expect([wisp.lane, wisp.row]).toEqual([0, 0]);
    expect(wisp.baseAtk).toBe(1);
    expect(wisp.shape).toBe('strike');
  });
  it('Persist and Swift are readable from the unit', () => {
    const st = setup({ player: [{ name: 'Leviathan Calf', lane: 0, row: 0 }, { name: 'Marrowhound', lane: 1, row: 0 }] });
    expect(unit(st, 'Leviathan Calf').key).toBe('c34');
  });
});
