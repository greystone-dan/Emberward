import { cellsBeside, emptyCells, other, unitAt, unitsOf } from '../grid';
import type { Action, BattleState, Cell, Side } from '../types';
import { applyAction, legalActions } from '../battle/battle';
import { defFor } from '../battle/defs';
import { effectiveAtk, hpOf } from '../battle/stats';
import { laneScore, rowFor, scriptedIntent, type Intent } from './scripted';

/**
 * T1 greedy AI (SPEC §12, research/05 §1.5): for elites and the boss.
 * Tries each candidate action (pruned summons, every cast and move, pass), then lets both sides pass so the
 * Clash resolves, and keeps the action whose post-Clash state scores best for its side. Ties go to the
 * earliest candidate, so it is deterministic; it only ever calls applyAction and legalActions, so it can't cheat.
 */

const CELLS_PER_CARD = 3;
const MAX_CANDIDATES = 24;

/** Plays the Clash out from `st` by passing on both sides. */
function clashLookahead(st: BattleState): BattleState {
  let s = st;
  let guard = 0;
  while (s.phase === 'action' && s.wave === st.wave && guard++ < 6) s = applyAction(s, { type: 'pass' }).state;
  return s;
}

function boardValue(st: BattleState, side: Side): number {
  let v = 0;
  for (const u of unitsOf(st.units, side)) {
    const w = u.token ? 0.5 : 1;
    v += w * (effectiveAtk(st, u) * 1.5 + hpOf(st, u) + u.shield * 0.5 - u.burn - u.poison);
  }
  return v;
}

/** How good `st` is for `side`. */
export function evaluate(st: BattleState, side: Side): number {
  const foe = other(side);
  if (st.phase === 'over') {
    if (st.winner === side) return 1000 + st.sides[side].hp;
    if (st.winner === foe) return -1000 - st.sides[foe].hp;
  }
  return (st.sides[side].hp - st.sides[foe].hp) * 3 + boardValue(st, side) - boardValue(st, foe) + st.sides[side].embers * 0.5;
}

function candidates(st: BattleState, side: Side, acts: Action[]): Action[] {
  const s = st.sides[side];
  const out: Action[] = [];
  const empties = emptyCells(st.units, side);
  const seen = new Set<string>();
  for (const a of acts) {
    if (a.type !== 'summon') continue;
    const card = s.cards.find((c) => c.uid === a.card);
    if (!card || seen.has(card.key)) continue;
    seen.add(card.key);
    const def = defFor(card.key, card.level);
    const rows = rowFor(def.shape);
    const scored = empties
      .map((cell) => {
        const rowRank = rows.indexOf(cell.row);
        let score = rowRank < 0 ? -10 : laneScore(st, side, cell.lane, def.shape) - rowRank * 3;
        for (const b of [...cellsBeside(cell), { lane: cell.lane, row: cell.row + 1 }, { lane: cell.lane, row: cell.row - 1 }]) {
          const o = unitAt(st.units, side, b.lane, b.row);
          if (o && o.traits.some((t) => def.traits.includes(t))) score += 1;
        }
        return { cell, score };
      })
      .sort((x, y) => y.score - x.score || x.cell.lane - y.cell.lane || x.cell.row - y.cell.row)
      .slice(0, CELLS_PER_CARD);
    for (const { cell } of scored) {
      const act = acts.find((x) => x.type === 'summon' && x.card === a.card && x.lane === cell.lane && x.row === cell.row);
      if (act) out.push(act);
    }
  }
  for (const a of acts) if (a.type === 'cast' || a.type === 'move') out.push(a);
  out.push({ type: 'pass' });
  return out.length > MAX_CANDIDATES ? [...out.slice(0, MAX_CANDIDATES - 1), { type: 'pass' }] : out;
}

export function greedyIntent(st: BattleState, side: Side = st.turn): Intent {
  const acts = legalActions(st, side);
  if (acts.length === 0) return { action: { type: 'pass' } };
  let best: Action = { type: 'pass' };
  let bestScore = -Infinity;
  for (const a of candidates(st, side, acts)) {
    const after = applyAction(st, a);
    if (after.events.some((e) => e.type === 'error')) continue;
    const score = evaluate(clashLookahead(after.state), side);
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  if (best.type === 'summon') {
    const card = st.sides[side].cards.find((c) => c.uid === best.card);
    const cell: Cell = { lane: best.lane, row: best.row };
    return { action: best, cardKey: card?.key, cell };
  }
  if (best.type === 'cast') return { action: best, cardKey: st.sides[side].cards.find((c) => c.uid === best.card)?.key };
  return { action: best };
}

/** The AI ladder: scripted for fights, greedy with Clash lookahead for elites and the boss. */
export function enemyIntent(st: BattleState, side: Side = 1): Intent {
  return st.kind === 'fight' ? scriptedIntent(st, side) : greedyIntent(st, side);
}
