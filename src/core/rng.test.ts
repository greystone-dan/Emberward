import { describe, expect, it } from 'vitest';
import { makeRng, nextFloat, nextInt } from './rng';

describe('rng', () => {
  it('is deterministic per seed and stream', () => {
    expect(nextFloat(makeRng('a', 'map'))[0]).toBe(nextFloat(makeRng('a', 'map'))[0]);
    expect(nextFloat(makeRng('a', 'map'))[0]).not.toBe(nextFloat(makeRng('a', 'ai'))[0]);
  });
  it('nextInt stays in range', () => {
    let r = makeRng('x', 'test');
    for (let i = 0; i < 1000; i++) {
      const [v, next] = nextInt(r, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      r = next;
    }
  });
});
