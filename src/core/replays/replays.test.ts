import { describe, expect, it } from 'vitest';
import golden from './golden.json';
import { runReplay, type Replay } from './replay';
import { renderToText } from '../battle/render';

describe('golden replays', () => {
  const replays = golden as Replay[];
  it('has replays for every Warden and fight, plus the regressions', () => {
    expect(replays.length).toBe(25); // 24 Warden-fight games + the Martyr 2 regression
  });
  for (const r of replays) {
    it(`${r.name} replays to the same state`, () => {
      const { state, hash } = runReplay(r);
      expect(state.errors, renderToText(state)).toEqual([]);
      expect(hash, `${r.note ?? ''}\n${renderToText(state)}`).toBe(r.hash);
    });
  }
});
