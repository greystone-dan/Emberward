import { mkdirSync, writeFileSync } from 'node:fs';
import { legalActions, newBattle, applyAction } from '../src/core';
import { makeRng, nextInt } from '../src/core/rng';
import { scenarioFight } from '../src/core/scenarios';
import { recordReplay, type Replay } from '../src/core/replays/replay';
import { scriptedPolicy } from '../src/core/ai/scripted';
import type { Action, BattleState } from '../src/core/types';

// Records golden replays: random-vs-scripted games on fixed seeds across Wardens and fights.
// `npx tsx tools/record-replays.ts` rewrites src/core/replays/golden.json. Only run it on purpose,
// after a rules change that is logged in DECISIONS.md.
const replays: Replay[] = [];
for (let w = 0; w < 3; w++) {
  for (const f of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const cfg = scenarioFight(`golden-${w}-${f}`, w, f);
    let st: BattleState = newBattle(cfg).state;
    let rng = makeRng(`golden-${w}-${f}`, 'policy');
    const actions: Action[] = [];
    let n = 0;
    while (st.phase === 'action' && n < 300) {
      let a: Action;
      if (st.turn === 1) [a, rng] = scriptedPolicy(st, rng);
      else {
        const list = legalActions(st);
        const nonPass = list.filter((x) => x.type !== 'pass');
        const pool = nonPass.length ? nonPass : list;
        const [i, r] = nextInt(rng, pool.length);
        rng = r;
        a = pool[i]!;
      }
      actions.push(a);
      st = applyAction(st, a).state;
      n++;
    }
    replays.push(recordReplay(`warden${w}-fight${f}`, cfg, actions, `Warden ${w} vs fight ${f}: random player, scripted enemy`));
  }
}
mkdirSync('src/core/replays', { recursive: true });
writeFileSync('src/core/replays/golden.json', JSON.stringify(replays));
console.log(`recorded ${replays.length} replays, ${replays.reduce((a, r) => a + r.actions.length, 0)} actions`);
