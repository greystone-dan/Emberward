import { mkdirSync, writeFileSync } from 'node:fs';
import { cards, cardsById, cardsByName, content } from '../src/content/cards';
import type { Trait } from '../src/content/types';
import { scriptedPolicy } from '../src/core/ai/scripted';
import { newBattle, playOut, randomPolicy, type BattleSideConfig } from '../src/core/battle/battle';
import { cardKey } from '../src/core/battle/defs';
import { botRunAction } from '../src/core/run/bot';
import { applyRunAction, newRun } from '../src/core/run/run';
import type { RunAction, RunState } from '../src/core/run/types';
import { makeRng } from '../src/core/rng';
import { ANIM_MS } from '../src/ui/store';

/**
 * `npm run balance -- [--runs 300] [--seed 1] [--mirrors 40]`
 * The phase 6 balance harness (docs/PROMPT.md): per-card include win rate and pick rate, first-seat win rate,
 * ember-spend split, simulated run length, and whether every trait's 4-tier is reachable. Prints 10 lines;
 * the full report goes to reports/balance-latest.md and reports/balance-<seed>.json.
 */
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ''), process.argv[i + 1] ?? '');
const RUNS = Number(args.get('runs') ?? 300);
const SEED = args.get('seed') ?? '1';
const MIRRORS = Number(args.get('mirrors') ?? 40);

/** Seconds a person spends on each decision (an assumption, stated in the report), on top of the measured animation time. */
const THINK_S: Partial<Record<RunAction['type'], number>> & { battle: number; default: number } = {
  battle: 5,
  chooseWarden: 15,
  driftTake: 6,
  driftSkip: 3,
  driftDone: 2,
  mapChoose: 8,
  musterSet: 3,
  musterConfirm: 15,
  persistChoose: 4,
  continue: 3,
  marketBuy: 6,
  marketBuyRelic: 6,
  marketBuySigil: 6,
  marketReroll: 3,
  marketHold: 3,
  sell: 4,
  inscribe: 6,
  hearthHeal: 4,
  hearthSnuff: 6,
  hearthTemper: 6,
  shrineChoose: 10,
  shrinePick: 5,
  rekindle: 3,
  postponeRekindle: 2,
  leave: 2,
  default: 3,
};
/** Measured animation time per wave: three beats, Wave End and Wave Start, plus the enemy's think pause per enemy action. */
const WAVE_ANIM_S = (3 * ANIM_MS.beat + ANIM_MS.waveEnd + ANIM_MS.waveStart) / 1000;
const ENEMY_ACTION_S = (ANIM_MS.think + ANIM_MS.action) / 1000;

interface CardStat {
  battles: number;
  battleWins: number;
  runs: number;
  runWins: number;
  offered: number;
  taken: number;
}
const stat = new Map<number, CardStat>();
const cs = (id: number): CardStat => {
  let s = stat.get(id);
  if (!s) stat.set(id, (s = { battles: 0, battleWins: 0, runs: 0, runWins: 0, offered: 0, taken: 0 }));
  return s;
};
const spend: Record<string, number> = {};
const earn: Record<string, number> = {};
const runSeconds: number[] = [];
const bossRunSeconds: number[] = [];
const runActions: number[] = [];
const wins: Record<string, { runs: number; wins: number }> = {};
const traitMax = new Map<Trait, number>();
const traitReached = new Map<Trait, number>();
let errors = 0;

function bucket(a: RunAction): string {
  switch (a.type) {
    case 'driftTake':
      return 'Drift reach';
    case 'marketBuy':
    case 'marketBuyRelic':
    case 'marketBuySigil':
    case 'marketReroll':
      return 'Market';
    case 'battle':
      return a.action.type === 'cast' ? 'Spells' : a.action.type === 'move' ? 'Paid moves' : 'Battle other';
    case 'shrineChoose':
      return 'Shrines';
    default:
      return a.type;
  }
}

function simulateRun(i: number): void {
  const w = i % 3;
  let run: RunState = applyRunAction(newRun(`${SEED}-${i}`), { type: 'chooseWarden', warden: w }).state;
  let rng = run.rng.bot;
  let seconds = THINK_S.chooseWarden!;
  let steps = 0;
  let mustered: number[] = [];
  let enemyActions = 0;
  let lastWave = 0;
  const bw = (wins[run.wardenName] ??= { runs: 0, wins: 0 });
  while (run.phase !== 'over' && steps++ < 6000) {
    const [a, r] = botRunAction(run, rng);
    rng = r;
    if (!a) break;
    // Offers: when a Drift closes or a market is left, everything still in the line was offered and not taken.
    if (a.type === 'driftDone') for (const c of run.drift.line) cs(c.cardId).offered++;
    if (a.type === 'leave' && run.market) for (const c of run.market.cards) if (c) cs(c.cardId).offered++;
    const beforeEmbers = a.type === 'battle' ? run.battle!.sides[0].embers : run.embers;
    const beforeBattleWave = run.battle?.wave ?? 0;
    const res = applyRunAction(run, a);
    const after = res.state;
    // Time: a person's decision, plus measured animation for the Clash and the enemy's actions.
    if (a.type === 'battle') {
      if (run.battle!.turn === 0) seconds += THINK_S.battle;
      else {
        enemyActions++;
        seconds += ENEMY_ACTION_S;
      }
      const wave = after.battle?.wave ?? beforeBattleWave + 1;
      if (wave !== lastWave) {
        seconds += WAVE_ANIM_S;
        lastWave = wave;
      }
    } else seconds += THINK_S[a.type] ?? THINK_S.default;
    // Embers in and out, by what they were spent on.
    const afterEmbers = a.type === 'battle' ? (after.battle ?? run.battle)!.sides[0].embers : after.embers;
    const d = afterEmbers - beforeEmbers;
    if (a.type === 'battle' && after.battle && after.battle.wave !== run.battle!.wave) {
      /* wave rollover gains are income, not this action's spend */
    } else if (d < 0 && (a.type !== 'battle' || run.battle!.turn === 0)) spend[bucket(a)] = (spend[bucket(a)] ?? 0) - d;
    if (a.type === 'battle' && after.embers > run.embers) earn['Pay and interest'] = (earn['Pay and interest'] ?? 0) + after.embers - run.embers;
    if (a.type !== 'battle' && d > 0) earn[a.type === 'sell' ? 'Selling' : a.type === 'driftSkip' ? 'Skipped Drifts' : a.type === 'shrineChoose' ? 'Shrines' : a.type] = (earn[a.type === 'sell' ? 'Selling' : a.type === 'driftSkip' ? 'Skipped Drifts' : a.type === 'shrineChoose' ? 'Shrines' : a.type] ?? 0) + d;
    for (const e of res.events) {
      if (e.type === 'draft' || e.type === 'buy') {
        cs(e.cardId).taken++;
        cs(e.cardId).offered++;
      }
      if (e.type === 'battleStart') {
        mustered = [...new Set(run.muster.map((uid) => run.deck.find((c) => c.uid === uid)?.cardId).filter((x): x is number => x !== undefined))];
        for (const id of mustered) cs(id).battles++;
        lastWave = 0;
      }
      if (e.type === 'battleEnd' && e.result.won) for (const id of mustered) cs(id).battleWins++;
    }
    run = after;
  }
  void enemyActions;
  if (run.phase !== 'over' || run.errors.length) errors++;
  bw.runs++;
  if (run.won) bw.wins++;
  runSeconds.push(seconds);
  if (run.map[run.at]?.type === 'boss') bossRunSeconds.push(seconds);
  runActions.push(steps);
  for (const id of new Set(run.deck.map((c) => c.cardId))) {
    cs(id).runs++;
    if (run.won) cs(id).runWins++;
  }
  // Trait counts in the final deck: a 4-tier needs four units on the board, so four cards with the trait.
  const counts = new Map<Trait, number>();
  for (const c of run.deck) for (const t of cardsById.get(c.cardId)!.traits) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const [t, n] of counts) {
    traitMax.set(t, Math.max(traitMax.get(t) ?? 0, n));
    if (n >= 4) traitReached.set(t, (traitReached.get(t) ?? 0) + 1);
  }
}

/**
 * First-seat win rate. Side 0 acts first in wave 1 (initiative alternates after). Two measures:
 * scripted AI on both sides over every ordered pair of designed comps (each pairing played both ways, so deck
 * strength cancels), and random play on mirrored comps. Draws are excluded.
 */
function firstSeat(): { scripted: number; random: number; decisive: number } {
  const side = (comp: (typeof content.comps)[number]): BattleSideConfig => ({ hp: 30, embers: 8, cards: comp.board.map((b) => ({ key: cardKey(cardsByName.get(b.card)!.id), level: 1 as const })) });
  let s0 = 0,
    sN = 0,
    r0 = 0,
    rN = 0;
  const comps = content.comps;
  for (let i = 0; i < comps.length; i++) {
    for (let j = 0; j < comps.length; j++) {
      if (i === j) continue;
      for (let k = 0; k < Math.max(1, Math.round(MIRRORS / comps.length)); k++) {
        const st = newBattle({ seed: `m${SEED}-${i}-${j}-${k}`, player: side(comps[i]!), enemy: side(comps[j]!) }).state;
        const a = playOut(st, scriptedPolicy, makeRng(`${SEED}-${k}`, 'a'));
        if (a.state.winner !== null) {
          sN++;
          if (a.state.winner === 0) s0++;
        }
      }
    }
    for (let k = 0; k < MIRRORS; k++) {
      const st = newBattle({ seed: `r${SEED}-${i}-${k}`, player: side(comps[i]!), enemy: side(comps[i]!) }).state;
      const b = playOut(st, randomPolicy, makeRng(`${SEED}-${i}-${k}`, 'b'));
      if (b.state.winner !== null) {
        rN++;
        if (b.state.winner === 0) r0++;
      }
    }
  }
  return { scripted: s0 / Math.max(1, sN), random: r0 / Math.max(1, rN), decisive: sN + rN };
}

const t0 = Date.now();
for (let i = 0; i < RUNS; i++) simulateRun(i);
const mirror = firstSeat();
const secs = ((Date.now() - t0) / 1000).toFixed(1);

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : '-');
const sorted = [...runSeconds].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
const medianMin = median / 60;
const bossSorted = [...bossRunSeconds].sort((a, b) => a - b);
const bossMedianMin = (bossSorted[Math.floor(bossSorted.length / 2)] ?? 0) / 60;
const totalSpend = Object.values(spend).reduce((a, b) => a + b, 0);
const rows = cards
  .map((c) => ({ c, s: cs(c.id) }))
  .map(({ c, s }) => ({ name: c.name, rarity: c.rarity, traits: c.traits.join('/'), battles: s.battles, incWin: s.battles ? s.battleWins / s.battles : null, runs: s.runs, runWin: s.runs ? s.runWins / s.runs : null, offered: s.offered, pick: s.offered ? s.taken / s.offered : null }));
const overBand = rows.filter((r) => r.runs >= 20 && (r.runWin ?? 0) > 0.6);
const traitRows = [...new Set(cards.flatMap((c) => c.traits))].sort().map((t) => ({ trait: t, pool: cards.filter((c) => c.traits.includes(t)).length, max: traitMax.get(t) ?? 0, reached: traitReached.get(t) ?? 0 }));
const unreachable = traitRows.filter((t) => t.reached === 0);
const bands = {
  includeWin: { pass: overBand.length === 0, detail: overBand.map((r) => `${r.name} ${pct(r.runWin! * 100, 100)}`) },
  firstSeat: { pass: mirror.scripted >= 0.45 && mirror.scripted <= 0.55, scripted: mirror.scripted, random: mirror.random },
  runLength: { pass: bossMedianMin >= 15 && bossMedianMin <= 25, medianMin, bossMedianMin },
  tiers: { pass: unreachable.length === 0, unreachable: unreachable.map((t) => t.trait) },
};

const md: string[] = [];
md.push(`# Balance report — ${RUNS} runs (seed ${SEED}), ${content.comps.length}×${MIRRORS} mirror battles — ${new Date().toISOString().slice(0, 10)}`, '');
md.push('## Bands (docs/PROMPT.md phase 6)', '');
md.push(`- Include win rate ≤ 60% for every card (runs won with the card in the final deck, ≥ 20 runs): **${bands.includeWin.pass ? 'PASS' : 'FAIL'}** ${bands.includeWin.detail.join(', ')}`);
md.push(`- First seat 45–55%: **${bands.firstSeat.pass ? 'PASS' : 'FAIL'}** scripted AI over seat-swapped comp pairings ${pct(mirror.scripted * 100, 100)}, random play on mirrored comps ${pct(mirror.random * 100, 100)} (${mirror.decisive} decisive battles; draws excluded)`);
md.push(`- Median run 15–25 min (runs that reach the boss; a run that dies early is short by design): **${bands.runLength.pass ? 'PASS' : 'FAIL'}** ${bossMedianMin.toFixed(1)} min; all runs ${medianMin.toFixed(1)} min (see the time model below)`);
md.push(`- Every trait's 4-tier reachable from a normal draft: **${bands.tiers.pass ? 'PASS' : 'FAIL'}** ${unreachable.length ? 'unreached: ' + unreachable.map((t) => t.trait).join(', ') : ''}`, '');
md.push('## Win rate by Warden', '');
for (const [n, b] of Object.entries(wins)) md.push(`- ${n}: ${pct(b.wins, b.runs)} of ${b.runs}`);
md.push('', `Errors: ${errors}. Sim time ${secs}s.`, '');
md.push('## Run length', '', `Runs that reached the boss (${bossRunSeconds.length}): median ${bossMedianMin.toFixed(1)} min. All runs: median ${medianMin.toFixed(1)} min, mean ${(runSeconds.reduce((a, b) => a + b, 0) / runSeconds.length / 60).toFixed(1)} min, median ${[...runActions].sort((a, b) => a - b)[Math.floor(runActions.length / 2)]} actions per run (battle actions by both sides included).`);
md.push(`Time model: measured animation per wave ${WAVE_ANIM_S.toFixed(2)}s (3 beats, Wave End, Wave Start from src/ui/store.ts ANIM_MS), ${ENEMY_ACTION_S.toFixed(2)}s per enemy action, plus assumed human decision times: ${THINK_S.battle}s per battle action, ${THINK_S.mapChoose}s per map choice, ${THINK_S.musterConfirm}s per Muster, ${THINK_S.driftTake}s per Drift take, ${THINK_S.marketBuy}s per market buy. Bot runs are shorter than human runs because the bot loses early; a full run to the boss is longer.`, '');
md.push('## Ember spend split', '');
for (const [k, v] of Object.entries(spend).sort((a, b) => b[1] - a[1])) md.push(`- ${k}: ${pct(v, totalSpend)} (${v}✦)`);
md.push('', 'Income by source (out of battle): ' + Object.entries(earn).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}✦`).join(', '), '');
md.push('## Trait 4-tiers', '', '| Trait | cards in pool | most in one deck | decks with ≥4 |', '|---|---|---|---|');
for (const t of traitRows) md.push(`| ${t.trait} | ${t.pool} | ${t.max} | ${t.reached} |`);
md.push('', '## Cards', '', 'Include win rate = battles won when the card was mustered ÷ battles with it mustered. Run win = runs won with it in the final deck. Pick = taken ÷ offered (Drift and market).', '', '| Card | rarity | traits | battles | include win | runs | run win | offered | pick |', '|---|---|---|---|---|---|---|---|---|');
for (const r of rows.sort((a, b) => (b.incWin ?? -1) - (a.incWin ?? -1))) md.push(`| ${r.name} | ${r.rarity} | ${r.traits} | ${r.battles} | ${r.incWin === null ? '-' : pct(r.incWin * 100, 100)} | ${r.runs} | ${r.runWin === null ? '-' : pct(r.runWin * 100, 100)} | ${r.offered} | ${r.pick === null ? '-' : pct(r.pick * 100, 100)} |`);
mkdirSync('reports', { recursive: true });
writeFileSync('reports/balance-latest.md', md.join('\n') + '\n');
writeFileSync(`reports/balance-${SEED}.json`, JSON.stringify({ runs: RUNS, seed: SEED, bands, wins, spend, earn, medianMin, bossMedianMin, rows, traitRows }, null, 2));

console.log(`balance: ${RUNS} runs, ${content.comps.length * MIRRORS} mirrors, seed=${SEED}, ${secs}s, errors ${errors}`);
console.log(`  include win ≤60%: ${bands.includeWin.pass ? 'PASS' : 'FAIL ' + bands.includeWin.detail.slice(0, 3).join(', ')}`);
console.log(`  first seat 45-55%: ${bands.firstSeat.pass ? 'PASS' : 'FAIL'} scripted ${pct(mirror.scripted * 100, 100)} random ${pct(mirror.random * 100, 100)}`);
console.log(`  median run 15-25 min: ${bands.runLength.pass ? 'PASS' : 'FAIL'} ${bossMedianMin.toFixed(1)} min to the boss (all runs ${medianMin.toFixed(1)} min)`);
console.log(`  4-tiers reachable: ${bands.tiers.pass ? 'PASS' : 'FAIL ' + unreachable.map((t) => t.trait).join(', ')}`);
console.log(`  wins: ${Object.entries(wins).map(([n, b]) => `${n} ${pct(b.wins, b.runs)}`).join(', ')}`);
console.log(`  spend: ${Object.entries(spend).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${pct(v, totalSpend)}`).join(', ')}`);
console.log('  report: reports/balance-latest.md');
process.exit(errors ? 1 : 0);
