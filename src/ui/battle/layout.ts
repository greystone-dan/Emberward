import type { Cell } from '../../core/types';

/** Pixel layout of the board (see theme.css .grid / .lanes / .divider). Arrows and pops use these. */
export const CELL_W = 112;
export const CELL_H = 70;
export const GAP = 4;
export const LANE_H = 20;
export const DIV_H = 14;
export const GRID_H = CELL_H * 3 + GAP * 2;
export const BOARD_W = CELL_W * 4 + GAP * 3;
export const BOARD_H = LANE_H + GRID_H * 2 + DIV_H;
export const PLAYER_TOP = LANE_H + GRID_H + DIV_H;
export const DIVIDER_Y = LANE_H + GRID_H + DIV_H / 2;

/** Centre of a cell on a side. Enemy rows are drawn Back to Front (top to bottom), player rows Front to Back. */
export function cellCentre(side: 0 | 1, cell: Cell): { x: number; y: number } {
  const x = cell.lane * (CELL_W + GAP) + CELL_W / 2;
  const y = side === 1 ? LANE_H + (2 - cell.row) * (CELL_H + GAP) + CELL_H / 2 : PLAYER_TOP + cell.row * (CELL_H + GAP) + CELL_H / 2;
  return { x, y };
}

/** Where a side's "face" sits for arrows and floating numbers: just beyond the divider, in the attacker's lane. */
export function facePoint(side: 0 | 1, lane: number): { x: number; y: number } {
  return { x: lane * (CELL_W + GAP) + CELL_W / 2, y: side === 1 ? DIVIDER_Y - 6 : DIVIDER_Y + 6 };
}
