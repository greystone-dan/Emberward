import { LANE_NAMES, unitAt } from '../grid';
import type { BattleState, Side } from '../types';
import { defFor } from './defs';
import { activeTiers, effectiveAtk, hpOf } from './stats';

/** ASCII board for tests, sims and window.__game.renderToText. Enemy grid on top, Back row first. */
export function renderToText(st: BattleState): string {
  const lines: string[] = [];
  const side = (s: Side) => st.sides[s];
  lines.push(`Wave ${st.wave}/6  turn:${st.turn === 0 ? 'player' : 'enemy'}  init:${st.initiative === 0 ? 'P' : 'E'}  actions P${st.actionsLeft[0]} E${st.actionsLeft[1]}  ${st.phase === 'over' ? `OVER winner=${st.winner === null ? 'draw' : st.winner === 0 ? 'player' : 'enemy'}` : ''}`);
  lines.push(`ENEMY  HP ${side(1).hp}/${side(1).maxHp}  ✦${side(1).embers}  cards: ${cardList(st, 1)}`);
  lines.push(`  tiers: ${activeTiers(st, 1).map((t) => `${t.trait}${t.n}`).join(' ') || '-'}`);
  for (const row of [2, 1, 0]) lines.push(`  ${rowLabel(row)} ${cells(st, 1, row)}`);
  lines.push(`  ---- ${LANE_NAMES.map((l) => `   ${l}       `).join('')}`);
  for (const row of [0, 1, 2]) lines.push(`  ${rowLabel(row)} ${cells(st, 0, row)}`);
  lines.push(`  tiers: ${activeTiers(st, 0).map((t) => `${t.trait}${t.n}`).join(' ') || '-'}`);
  lines.push(`PLAYER HP ${side(0).hp}/${side(0).maxHp}  ✦${side(0).embers}  cards: ${cardList(st, 0)}`);
  if (st.boss) lines.push(`  dark lanes: ${st.boss.darkLanes.map((l) => LANE_NAMES[l]).join(',') || '-'}  next: ${st.boss.nextDarkLanes.map((l) => LANE_NAMES[l]).join(',')}`);
  if (st.errors.length) lines.push(`ERRORS: ${st.errors.join('; ')}`);
  return lines.join('\n');
}

function rowLabel(row: number): string {
  return ['F', 'M', 'B'][row]!;
}

function cells(st: BattleState, side: Side, row: number): string {
  return [0, 1, 2, 3]
    .map((lane) => {
      const u = unitAt(st.units, side, lane, row);
      if (!u) return '[    .     ]';
      const name = u.name.replace(/^The /, '').slice(0, 6).padEnd(6);
      const flags = `${u.shield + u.shieldPersist ? 's' : ''}${u.burn ? 'b' : ''}${u.poison ? 'p' : ''}${u.stunned ? 'z' : ''}`.padEnd(3);
      return `[${name}${String(effectiveAtk(st, u)).padStart(2)}/${String(hpOf(st, u)).padEnd(2)}${flags}]`;
    })
    .join('');
}

function cardList(st: BattleState, side: Side): string {
  return st.sides[side].cards.map((c) => `${c.spent ? '(' : ''}${defFor(c.key, c.level).name.slice(0, 10)}${c.level > 1 ? `L${c.level}` : ''}${c.spent ? ')' : ''}`).join(', ');
}
