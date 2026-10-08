import { mkdirSync, writeFileSync } from 'node:fs';
import { cards } from '../src/content/cards';
import { applyAction, legalActions, newBattle, renderToText } from '../src/core';
import { makeRng, nextInt, type RngState } from '../src/core/rng';
import { cardKey } from '../src/core/battle/defs';
import { scenarioFight } from '../src/core/scenarios';
import { scriptedPolicy } from '../src/core/ai/scripted';
import type { BattleState, Level } from '../src/core/types';

// `npm run sim -- --battles 1000 --bot random --seed 1 [--pool all]`
// Prints a 10-line summary; details go to reports/sim-<seed>.json.
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ''), process.argv[i + 1] ?? '');
const battles = Number(args.get('battles') ?? 200);
const seed = args.get('seed') ?? '1';
const pool = args.get('pool') ?? 'all';
const bot = args.get('bot') ?? 'random'; // the enemy's policy: random | scripted

function randomPolicy(s: BattleState, rng: RngState): [ReturnType<typeof legalActions>[number], RngState] {
  const actions = legalActions(s);
  // Bias away from passing immediately so boards get built.
  const nonPass = actions.filter((a) => a.type !== 'pass');
  const list = nonPass.length > 0 && s.actionsLeft[s.turn] > 0 ? nonPass : actions;
  const [i, r] = nextInt(rng, list.length);
  return [list[i]!, r];
}

let rng = makeRng(seed, 'sim');
let errors = 0;
let playerWins = 0,
  enemyWins = 0,
  draws = 0;
let steps = 0;
const errorSamples: string[] = [];
const outcomes: Record<string, number> = {};
const waves: number[] = [];
for (let b = 0; b < battles; b++) {
  const [w, r1] = nextInt(rng, 3);
  const [f, r2] = nextInt(r1, 8);
  rng = r2;
  const extra: { key: string; level: Level }[] = [];
  if (pool === 'all') {
    for (let i = 0; i < 4; i++) {
      const [ci, r3] = nextInt(rng, cards.length);
      const [lv, r4] = nextInt(r3, 10);
      rng = r4;
      extra.push({ key: cardKey(cards[ci]!.id), level: lv === 0 ? 2 : 1 });
    }
  }
  let { state } = newBattle(scenarioFight(`${seed}-${b}`, w, f, extra));
  let n = 0;
  try {
    while (state.phase === 'action' && n < 400) {
      const [a, r] = bot === 'scripted' && state.turn === 1 ? scriptedPolicy(state, rng) : randomPolicy(state, rng);
      rng = r;
      state = applyAction(state, a).state;
      n++;
    }
  } catch (e) {
    errors++;
    if (errorSamples.length < 5) errorSamples.push(`ERROR EXCEPTION seed=${seed}-${b} ${(e as Error).message}\n${(e as Error).stack?.split('\n').slice(1, 4).join('\n')}`);
    continue;
  }
  steps += n;
  if (state.phase === 'action') {
    errors++;
    if (errorSamples.length < 5) errorSamples.push(`ERROR MAX_STEPS seed=${seed}-${b}\n${renderToText(state)}`);
  }
  if (state.errors.length) {
    errors++;
    if (errorSamples.length < 5) errorSamples.push(`ERROR ${state.errors[0]} seed=${seed}-${b}`);
  }
  waves.push(state.wave);
  outcomes[state.outcome ?? 'none'] = (outcomes[state.outcome ?? 'none'] ?? 0) + 1;
  if (state.winner === 0) playerWins++;
  else if (state.winner === 1) enemyWins++;
  else draws++;
}
mkdirSync('reports', { recursive: true });
writeFileSync(`reports/sim-${seed}.json`, JSON.stringify({ battles, errors, playerWins, enemyWins, draws, outcomes, errorSamples }, null, 2));
console.log(`sim: ${battles} battles, bot=${bot}, seed=${seed}`);
console.log(`  player wins ${playerWins}  enemy wins ${enemyWins}  draws ${draws}  avg steps ${(steps / Math.max(1, battles - errors)).toFixed(1)}  avg wave ${(waves.reduce((a, b) => a + b, 0) / Math.max(1, waves.length)).toFixed(1)}`);
console.log(`  outcomes ${JSON.stringify(outcomes)}`);
console.log(`  errors ${errors}`);
for (const e of errorSamples.slice(0, 3)) console.log(e.split('\n').slice(0, 4).join('\n'));
process.exit(errors ? 1 : 0);
