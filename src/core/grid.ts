import { FLAGS } from '../config/flags';
import type { Cell, Lane, Row, Side, Unit } from './types';

export const LANES: readonly Lane[] = [0, 1, 2, 3];
export const ROWS: readonly Row[] = [0, 1, 2];
export const LANE_NAMES = ['A', 'B', 'C', 'D'] as const;
export const ROW_NAMES = ['Front', 'Mid', 'Back'] as const;

export function other(side: Side): Side {
  return side === 0 ? 1 : 0;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.lane === b.lane && a.row === b.row;
}

export function unitAt(units: readonly Unit[], side: Side, lane: number, row: number): Unit | undefined {
  return units.find((u) => u.side === side && u.lane === lane && u.row === row);
}

export function unitsOf(units: readonly Unit[], side: Side): Unit[] {
  return units.filter((u) => u.side === side);
}

/** Row order Front→Back, lanes A→D: the SPEC §6.3 ordering within a side. */
export function orderUnits(units: readonly Unit[], first: Side): Unit[] {
  return [...units].sort((a, b) => {
    if (a.side !== b.side) return a.side === first ? -1 : 1;
    if (a.lane !== b.lane) return a.lane - b.lane;
    return a.row - b.row;
  });
}

export function cellAhead(c: Cell): Cell | undefined {
  return c.row > 0 ? { lane: c.lane, row: (c.row - 1) as Row } : undefined;
}
export function cellBehind(c: Cell): Cell | undefined {
  return c.row < 2 ? { lane: c.lane, row: (c.row + 1) as Row } : undefined;
}
export function cellsBeside(c: Cell): Cell[] {
  const out: Cell[] = [];
  if (c.lane > 0) out.push({ lane: (c.lane - 1) as Lane, row: c.row });
  if (c.lane < 3) out.push({ lane: (c.lane + 1) as Lane, row: c.row });
  return out;
}
export function cellsAround(c: Cell, diagonals = FLAGS.diagonalAdjacency): Cell[] {
  const out: Cell[] = [];
  const a = cellAhead(c),
    b = cellBehind(c);
  if (a) out.push(a);
  if (b) out.push(b);
  out.push(...cellsBeside(c));
  if (diagonals) out.push(...cellsDiagonal(c));
  return out;
}
export function cellsDiagonal(c: Cell): Cell[] {
  const out: Cell[] = [];
  for (const dl of [-1, 1]) {
    for (const dr of [-1, 1]) {
      const lane = c.lane + dl,
        row = c.row + dr;
      if (lane >= 0 && lane < 4 && row >= 0 && row < 3) out.push({ lane: lane as Lane, row: row as Row });
    }
  }
  return out;
}

export function allCells(): Cell[] {
  const out: Cell[] = [];
  for (const lane of LANES) for (const row of ROWS) out.push({ lane, row });
  return out;
}

export function emptyCells(units: readonly Unit[], side: Side): Cell[] {
  return allCells().filter((c) => !unitAt(units, side, c.lane, c.row));
}

export function laneEnemies(units: readonly Unit[], side: Side, lane: number): Unit[] {
  return units.filter((u) => u.side === other(side) && u.lane === lane).sort((a, b) => a.row - b.row);
}

export function cellName(c: Cell): string {
  return `${LANE_NAMES[c.lane]}${c.row}`;
}
