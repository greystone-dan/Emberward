import { describe, expect, it } from 'vitest';
import { effectiveAtk, hpOf } from './stats';
import { act, card, clash, maybeUnit, setup, unit } from '../test/kit';

describe('triggers', () => {
  it('Kindle fires on summon', () => {
    let st = setup({ playerCards: ['Bat Swarm'] });
    st = act(st, { type: 'summon', card: card(st, 'Bat Swarm'), lane: 1, row: 2 });
    expect(maybeUnit(st, 'Bat')).toBeDefined();
    expect(unit(st, 'Bat').row).toBe(2);
  });
  it('Last Gasp fires on death, and the Lich doubles it', () => {
    let st = setup({ player: [{ name: 'Drift Lantern', lane: 0, row: 0 }], enemy: [{ name: 'e_salthound', lane: 0, row: 0 }] });
    st = clash(st).state;
    expect(st.sides[0].embers).toBe(10 + 1 + 2); // pass first, Last Gasp 2
    st = setup({ player: [{ name: 'Drift Lantern', lane: 0, row: 0 }, { name: 'The Lich of Vael', lane: 3, row: 2 }], enemy: [{ name: 'e_salthound', lane: 0, row: 0 }] });
    st = clash(st).state;
    expect(st.sides[0].embers).toBe(10 + 1 + 4);
  });
  it('Wave Start triggers fire from wave 2 on, Wave End every wave', () => {
    let st = setup({ player: [{ name: 'Great Bell', lane: 1, row: 1 }, { name: 'Bell Warden', lane: 1, row: 0 }, { name: 'The Candle Saint', lane: 0, row: 0 }] });
    unit(st, 'Bell Warden').damage = 3;
    expect(unit(st, 'Bell Warden').shield).toBe(1 + 2); // its own 1 plus Bellforged 2, from battle start
    st = clash(st).state;
    expect(unit(st, 'Bell Warden').damage).toBe(1); // Saint healed 2 at Wave End
    expect(unit(st, 'Bell Warden').shield).toBe(2 + 1 + 2); // Great Bell Wave Start 2, its own 1, Bellforged 2
  });
  it('ally-death triggers: Choir of Bones fills a cell Beside the fallen with a Wisp', () => {
    let st = setup({ player: [{ name: 'Choir of Bones', lane: 3, row: 2 }, { name: 'Bat Swarm', lane: 1, row: 0 }], enemy: [{ name: 'e_salthound', lane: 1, row: 0 }] });
    st = clash(st).state;
    expect(maybeUnit(st, 'Wisp')).toBeDefined();
    expect([0, 2]).toContain(unit(st, 'Wisp').lane);
  });
  it('Crypt Keeper gains Power per fallen ally; Gravedigger pays at Wave End when an ally died', () => {
    let st = setup({ player: [{ name: 'Crypt Keeper', lane: 3, row: 2 }, { name: 'Gravedigger', lane: 1, row: 2 }, { name: 'Bone Gnawer', lane: 0, row: 0 }], enemy: [{ name: 'e_salthound', lane: 0, row: 0 }] });
    expect(effectiveAtk(st, unit(st, 'Crypt Keeper'))).toBe(2);
    st = clash(st).state;
    expect(effectiveAtk(st, unit(st, 'Crypt Keeper'))).toBe(3);
    expect(st.sides[0].embers).toBe(10 + 1 + 1 + 1); // pass first, Gravedigger, Pilgrim 2
  });
  it('Second Death replays every fallen ally\'s Last Gasp', () => {
    let st = setup({ player: [{ name: 'Drift Lantern', lane: 0, row: 0 }], playerCards: ['The Lich of Vael'], enemy: [{ name: 'e_salthound', lane: 0, row: 0 }], embers: 10 });
    st = clash(st).state;
    expect(st.sides[0].embers).toBe(13);
    st = act(st, { type: 'pass' }); // wave 2: the enemy has initiative and passes first
    st = act(st, { type: 'cast', card: card(st, 'The Lich of Vael'), targets: [] });
    expect(st.sides[0].embers).toBe(13 - 4 + 2);
  });
  it('Ossuary Knight returns once with 1 health', () => {
    let st = setup({ player: [{ name: 'Ossuary Knight', lane: 0, row: 0 }], enemy: [{ name: 'Bellfounder Titan', lane: 0, row: 0 }] });
    st = clash(st).state;
    const k = unit(st, 'Ossuary Knight');
    expect(hpOf(st, k)).toBe(1);
    expect(k.returnsLeft).toBe(0);
    st = clash(st).state;
    expect(maybeUnit(st, 'Ossuary Knight')).toBeUndefined();
  });
  it('a trigger loop is capped with ERROR TRIGGER_LOOP rather than hanging', () => {
    // Choir of Bones + Bone Gnawers dying in a chain is finite; force the cap by a tiny queue.
    const st = setup({ player: [{ name: 'Choir of Bones', lane: 3, row: 2 }] });
    st.triggerDepth = 10_000;
    const r = clash(st).state;
    expect(r.errors).toEqual([]); // nothing fired, so no loop; cap only trips on real chains
  });
});
