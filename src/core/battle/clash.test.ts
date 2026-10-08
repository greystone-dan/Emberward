import { describe, expect, it } from 'vitest';
import { previewClash } from './preview';
import { hpOf } from './stats';
import { clash, maybeUnit, setup, unit } from '../test/kit';

describe('attack shapes (SPEC §6.1)', () => {
  it('Strike hits the front-most enemy in its lane from the Front row', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 0 }], enemy: [{ name: 'e_crab', lane: 0, row: 1 }, { name: 'e_sentry', lane: 0, row: 0 }] });
    st = clash(st).state;
    expect(hpOf(st, unit(st, 'Drowned Sentry', 1))).toBe(4 - 3);
    expect(hpOf(st, unit(st, 'Belfry Crab', 1))).toBe(6);
  });
  it('Strike from Mid needs an empty cell Ahead, never from Back', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 1 }, { name: 'Wandering Squire', lane: 1, row: 2 }], enemy: [{ name: 'e_crab', lane: 0, row: 0 }, { name: 'e_crab', lane: 1, row: 0 }] });
    const arrows = previewClash(st);
    expect(arrows.some((a) => a.attacker === unit(st, 'Marrowhound').id)).toBe(true);
    expect(arrows.some((a) => a.attacker === unit(st, 'Wandering Squire').id)).toBe(false);
    st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 1 }, { name: 'Rubble Golem', lane: 0, row: 0 }], enemy: [{ name: 'e_crab', lane: 0, row: 0 }] });
    expect(previewClash(st).some((a) => a.attacker === unit(st, 'Marrowhound').id)).toBe(false);
  });
  it('an empty lane lets Strike and Shoot hit the enemy Warden', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 2, row: 0 }, { name: 'Tallow Imp', lane: 3, row: 2 }] });
    const r = clash(st);
    st = r.state;
    expect(st.sides[1].hp).toBe(12 - 3 - 1);
    expect(r.events.filter((e) => e.type === 'faceDamage')).toHaveLength(2);
  });
  it('Shoot hits the front-most enemy from any row', () => {
    let st = setup({ player: [{ name: 'Lantern Sentry', lane: 1, row: 2 }], enemy: [{ name: 'e_crab', lane: 1, row: 2 }, { name: 'Kelp Wraith', lane: 1, row: 1 }] });
    st = clash(st).state;
    expect(hpOf(st, unit(st, 'Kelp Wraith', 1))).toBe(5 - 2);
    expect(hpOf(st, unit(st, 'Belfry Crab', 1))).toBe(6);
  });
  it('Pierce hits every enemy in the lane and ignores Taunt', () => {
    let st = setup({ player: [{ name: 'Leviathan Calf', lane: 0, row: 2 }], enemy: [{ name: 'e_crab', lane: 0, row: 2 }, { name: 'e_sentry', lane: 0, row: 0 }, { name: 'e_ghoulbell', lane: 1, row: 0 }] });
    st = clash(st).state;
    expect(hpOf(st, unit(st, 'Belfry Crab', 1))).toBe(6 - 4 + 2); // its wave-start Shield 2 absorbs 2 of the 4
    expect(maybeUnit(st, 'Drowned Sentry', 1)).toBeUndefined(); // 4 damage on 4 health
    expect(hpOf(st, unit(st, 'Bell Ghoul', 1))).toBe(5); // Taunt ignored
  });
  it('Cleave hits the target and the enemies Beside it', () => {
    let st = setup({ player: [{ name: 'Bellringer Wight', lane: 1, row: 0 }], enemy: [{ name: 'e_crab', lane: 0, row: 0 }, { name: 'e_thief', lane: 1, row: 0 }, { name: 'e_thief', lane: 2, row: 0 }, { name: 'e_thief', lane: 3, row: 0 }] });
    const r = clash(st);
    st = r.state;
    expect(r.events.filter((e) => e.type === 'attack' && e.attacker === 1)).toHaveLength(3);
    expect(st.units.filter((u) => u.side === 1 && u.name === 'Candle Thief')).toHaveLength(1); // lanes B and C died, D untouched
    expect(hpOf(st, unit(st, 'Belfry Crab', 1))).toBe(6 - 3 + 2); // Beside the target too, through its Shield
  });
  it('Lob hits the back-most enemy over blockers, never from the Front row, nothing on an empty lane', () => {
    let st = setup({ player: [{ name: 'Wickmonger', lane: 0, row: 1 }, { name: 'Wickmonger', lane: 1, row: 0 }, { name: 'Wickmonger', lane: 2, row: 2 }], enemy: [{ name: 'Kelp Wraith', lane: 0, row: 0 }, { name: 'e_hook', lane: 0, row: 2 }, { name: 'e_crab', lane: 1, row: 2 }] });
    const r = clash(st);
    st = r.state;
    expect(maybeUnit(st, 'Tide Hook', 1)).toBeUndefined(); // 2 from the Lob, then a Burn 1 tick: 3 health gone
    expect(hpOf(st, unit(st, 'Kelp Wraith', 1))).toBe(5);
    expect(hpOf(st, unit(st, 'Belfry Crab', 1))).toBe(6); // Front-row Wickmonger can't Lob
    expect(st.sides[1].hp).toBe(12); // lane C empty: Lob does nothing
    expect(r.events.filter((e) => e.type === 'faceDamage')).toHaveLength(0);
  });
});

describe('Taunt', () => {
  it('redirects Strike, Shoot and Cleave in its lane even when not front-most', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 0 }, { name: 'Lantern Sentry', lane: 0, row: 2 }], enemy: [{ name: 'Kelp Wraith', lane: 0, row: 0 }, { name: 'e_ghoulbell', lane: 0, row: 2 }] });
    st = clash(st).state;
    expect(hpOf(st, unit(st, 'Kelp Wraith', 1))).toBe(5);
    expect(maybeUnit(st, 'Bell Ghoul', 1)).toBeUndefined(); // 3 + 2 = 5
  });
  it('a wide Taunt covers the neighbouring lanes', () => {
    let st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 0 }], enemy: [{ name: 'e_sentry', lane: 0, row: 0 }, { name: 'Cathedral Golem', lane: 1, row: 0 }] });
    st = clash(st).state;
    expect(hpOf(st, unit(st, 'Drowned Sentry', 1))).toBe(4);
    expect(hpOf(st, unit(st, 'Cathedral Golem', 1))).toBe(9 - 3);
  });
});

describe('beats and Wave End order', () => {
  it('resolves Front, then Mid, then Back; damage within a beat is simultaneous', () => {
    // Two 3/2 strikers facing each other both die (simultaneous), the Mid-row shooter behind still fires.
    let st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 0 }, { name: 'Tallow Imp', lane: 0, row: 1 }], enemy: [{ name: 'e_salthound', lane: 0, row: 0 }] });
    const r = clash(st);
    st = r.state;
    expect(maybeUnit(st, 'Marrowhound')).toBeUndefined();
    expect(maybeUnit(st, 'Salt Hound', 1)).toBeUndefined();
    const beats = r.events.filter((e) => e.type === 'beat').map((e) => (e as { row: number }).row);
    expect(beats).toEqual([0, 1, 2]);
    expect(st.sides[1].hp).toBe(11); // Imp shoots the face after the lane emptied in the Front beat
  });
  it('Wave End: Burn, then Poison, then triggers, then Shields expire', () => {
    let st = setup({ player: [{ name: 'Pearl Diver', lane: 3, row: 2 }], enemy: [{ name: 'e_crab', lane: 0, row: 0 }] });
    const crab = unit(st, 'Belfry Crab', 1);
    crab.burn = 2;
    crab.poison = 2;
    crab.shield = 5;
    const r = clash(st);
    st = r.state;
    const lastPass = r.events.map((e) => e.type).lastIndexOf('pass');
    const order = r.events.slice(lastPass).filter((e) => e.type === 'damage' || e.type === 'trigger').map((e) => (e.type === 'damage' ? e.source : 'trigger'));
    expect(order.slice(0, 3)).toEqual(['burn', 'poison', 'trigger']);
    expect(st.sides[0].embers).toBe(10 + 1 + 1); // pass first, then Pearl Diver: an enemy was Poisoned
    const c = unit(st, 'Belfry Crab', 1);
    expect(c.burn).toBe(1);
    expect(c.poison).toBe(1);
    expect(c.shield).toBe(2); // expired, then the new wave's "Shield 2 each wave"
  });
  it('the preview matches what the Clash does on a static board', () => {
    const st = setup({ player: [{ name: 'Marrowhound', lane: 0, row: 0 }, { name: 'Tallow Imp', lane: 1, row: 2 }], enemy: [{ name: 'e_crab', lane: 0, row: 0 }] });
    const arrows = previewClash(st);
    expect(arrows).toHaveLength(3);
    expect(arrows.find((a) => a.attacker === unit(st, 'Tallow Imp').id)?.target).toBe('face');
    const r = clash(st);
    expect(r.events.filter((e) => e.type === 'attack')).toHaveLength(3);
  });
});
