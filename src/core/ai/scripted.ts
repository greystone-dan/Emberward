import { cellsBeside, emptyCells, laneEnemies, other, unitAt, unitsOf } from '../grid';
import type { Action, BattleState, Cell, Side, Unit } from '../types';
import { legalActions, spellCost, targetOptions } from '../battle/battle';
import { defFor } from '../battle/defs';
import { effectiveAtk, hpOf, tauntLanes } from '../battle/stats';
import type { RngState } from '../rng';

/**
 * T0 scripted AI (research/05 §1.4): plays its revealed deck in order, with lane preferences.
 * Shape decides the row (Strike/Cleave front, Shoot/Lob back, Support mid). Lane: cover the lane
 * facing the enemy's strongest attacker, else the emptiest lane. Casts a spell when it has spare embers.
 * It only ever calls legalActions, so it can't cheat; it also serves as the enemy's "intent".
 */

export interface Intent {
  action: Action;
  cardKey?: string;
  cell?: Cell;
}

export function rowFor(shape: string): number[] {
  switch (shape) {
    case 'strike':
    case 'cleave':
      return [0, 1, 2];
    case 'shoot':
    case 'pierce':
      return [2, 1, 0];
    case 'lob':
      return [2, 1];
    default:
      return [1, 2, 0];
  }
}

export function laneScore(st: BattleState, side: Side, lane: number, shape: string): number {
  const foe = other(side);
  const mine = unitsOf(st.units, side).filter((u) => u.lane === lane);
  const theirs = laneEnemies(st.units, side, lane);
  let score = 0;
  // Threat in this lane: enemy Power that would reach our face.
  const threat = theirs.reduce((a, u) => a + effectiveAtk(st, u), 0);
  if (mine.length === 0) score += threat * 2 + 1; // cover open lanes under fire
  if (shape === 'strike' || shape === 'cleave' || shape === 'pierce') score += theirs.length ? 2 : 1;
  if (shape === 'lob') score += theirs.length >= 2 ? 3 : theirs.length ? 1 : -5;
  if (shape === 'shoot') score += theirs.length ? 1 : 2; // open lanes mean face damage
  if (shape === 'none') score += mine.length > 0 ? 2 : -1; // supports want company
  // Prefer lanes where the enemy's front unit is weakest for melee.
  const front = theirs[0];
  if (front && (shape === 'strike' || shape === 'cleave')) score += Math.max(0, 6 - hpOf(st, front)) / 2;
  void foe;
  return score;
}

export function scriptedIntent(st: BattleState, side: Side = st.turn): Intent {
  const acts = legalActions(st, side);
  const pass: Action = { type: 'pass' };
  if (acts.length === 0) return { action: pass };
  const s = st.sides[side];
  const next = s.cards.find((c) => !c.spent);
  if (!next) return { action: pass };
  const def = defFor(next.key, next.level);
  // Spells: cast when the deck's next card is spell-shaped (no body) or embers are plentiful.
  if (def.spell && def.spell.target.kind !== 'deckCard' && spellCost(st, side, next) <= s.embers && (def.atk === 0 || s.embers >= spellCost(st, side, next) + 3)) {
    const options = targetOptions(st, side, def.spell.target);
    const cast = acts.find((a) => a.type === 'cast' && a.card === next.uid && options.length > 0);
    if (cast && def.shape === 'none') return { action: cast, cardKey: next.key };
  }
  const empties = emptyCells(st.units, side);
  let best: { cell: Cell; score: number } | undefined;
  for (const cell of empties) {
    const rows = rowFor(def.shape);
    const rowRank = rows.indexOf(cell.row);
    if (rowRank < 0) continue;
    let score = laneScore(st, side, cell.lane, def.shape) - rowRank * 3;
    // Kinship: neighbours sharing a trait.
    for (const b of [...cellsBeside(cell), { lane: cell.lane, row: cell.row + 1 }, { lane: cell.lane, row: cell.row - 1 }]) {
      const o = unitAt(st.units, side, b.lane, b.row);
      if (o && o.traits.some((t) => def.traits.includes(t))) score += 1;
    }
    // Taunt wants the lane the enemy's biggest melee faces.
    if (def.passives.some((p) => p.k === 'taunt') && cell.row === 0) score += 2;
    if (!best || score > best.score) best = { cell, score };
  }
  if (best) {
    const a = acts.find((x) => x.type === 'summon' && x.card === next.uid && x.lane === best!.cell.lane && x.row === best!.cell.row);
    if (a) return { action: a, cardKey: next.key, cell: best.cell };
  }
  return { action: pass };
}

export function scriptedPolicy(st: BattleState, rng: RngState): [Action, RngState] {
  return [scriptedIntent(st).action, rng];
}

/** The lane a scripted enemy prefers right now (for the intent display). */
export function preferredLane(st: BattleState, side: Side): number {
  let best = 0,
    bestScore = -Infinity;
  for (let lane = 0; lane < 4; lane++) {
    const sc = laneScore(st, side, lane, 'strike');
    if (sc > bestScore) {
      bestScore = sc;
      best = lane;
    }
  }
  return best;
}

export function tauntersOf(st: BattleState, side: Side): Unit[] {
  return unitsOf(st.units, side).filter((u) => tauntLanes(st, u).length > 0);
}
