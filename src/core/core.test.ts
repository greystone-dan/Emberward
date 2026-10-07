import { describe, expect, it } from 'vitest';
import { nextFloat, makeRng } from './rng';
import { applyAction, newGame } from './state';

describe('rng', () => {
  it('is deterministic per seed and stream', () => {
    expect(nextFloat(makeRng('a', 'map'))[0]).toBe(nextFloat(makeRng('a', 'map'))[0]);
    expect(nextFloat(makeRng('a', 'map'))[0]).not.toBe(nextFloat(makeRng('a', 'ai'))[0]);
  });
});

describe('applyAction', () => {
  it('does not mutate and round-trips through JSON', () => {
    const s = newGame('seed');
    const { state } = applyAction(s, { type: 'gainEmbers', amount: 3 });
    expect(s.embers).toBe(0);
    expect(state.embers).toBe(3);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
