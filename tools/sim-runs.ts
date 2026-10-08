import { mkdirSync, writeFileSync } from 'node:fs';
import { content } from '../src/content/cards';
import { continueRun } from '../src/core/run/bot';
import { applyRunAction, newRun } from '../src/core/run/run';

// `npm run sim:runs -- --runs 100 --seed 1 [--warden 0|1|2|all]`
// Whole runs with the run bot; prints win rate by Warden and where runs end. Details in reports/runs-<seed>.json.
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ''), process.argv[i + 1] ?? '');
const runs = Number(args.get('runs') ?? 50);
const seed = args.get('seed') ?? '1';
const wardenArg = args.get('warden') ?? 'all';
const wardens = wardenArg === 'all' ? [0, 1, 2] : [Number(wardenArg)];

const t0 = Date.now();
let errors = 0;
const byWarden: Record<string, { runs: number; wins: number; nodes: number[] }> = {};
const deathNodes: Record<string, number> = {};
const samples: string[] = [];
for (let i = 0; i < runs; i++) {
  const w = wardens[i % wardens.length]!;
  const name = content.wardens[w]!.name;
  const bw = (byWarden[name] ??= { runs: 0, wins: 0, nodes: [] });
  let st = applyRunAction(newRun(`${seed}-${i}`), { type: 'chooseWarden', warden: w }).state;
  let res;
  try {
    res = continueRun(st, 6000);
  } catch (e) {
    errors++;
    if (samples.length < 5) samples.push(`ERROR EXCEPTION seed=${seed}-${i} ${(e as Error).message}`);
    continue;
  }
  st = res.state;
  bw.runs++;
  if (st.won) bw.wins++;
  bw.nodes.push(st.visited.length);
  if (st.phase !== 'over' || st.errors.length) {
    errors++;
    if (samples.length < 5) samples.push(`ERROR ${st.errors[0] ?? 'NOT_OVER phase=' + st.phase} seed=${seed}-${i}`);
  }
  if (!st.won) {
    const node = st.map[st.at];
    const k = node ? `${node.type}@row${node.y + 1}` : 'start';
    deathNodes[k] = (deathNodes[k] ?? 0) + 1;
  }
}
mkdirSync('reports', { recursive: true });
writeFileSync(`reports/runs-${seed}.json`, JSON.stringify({ runs, errors, byWarden, deathNodes, samples }, null, 2));
console.log(`sim:runs ${runs} runs, seed=${seed}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const [n, b] of Object.entries(byWarden)) console.log(`  ${n.padEnd(16)} win ${((100 * b.wins) / Math.max(1, b.runs)).toFixed(0)}%  avg nodes ${(b.nodes.reduce((a, c) => a + c, 0) / Math.max(1, b.nodes.length)).toFixed(1)}`);
const top = Object.entries(deathNodes).sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(`  runs end at: ${top.map(([k, v]) => `${k}×${v}`).join('  ')}`);
console.log(`  errors ${errors}`);
for (const s of samples.slice(0, 3)) console.log(s);
process.exit(errors ? 1 : 0);
