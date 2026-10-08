import { describe, expect, it } from 'vitest';
import { cellAhead, cellBehind, cellsAround, cellsBeside, cellsDiagonal, emptyCells, orderUnits } from './grid';
import type { Unit } from './types';

const u = (side: 0 | 1, lane: number, row: number): Unit => ({ side, lane, row, id: lane * 10 + row + side * 100 }) as unknown as Unit;

describe('grid', () => {
  it('directions are relative to the enemy (row 0 is Front)', () => {
    expect(cellAhead({ lane: 1, row: 1 })).toEqual({ lane: 1, row: 0 });
    expect(cellAhead({ lane: 1, row: 0 })).toBeUndefined();
    expect(cellBehind({ lane: 1, row: 2 })).toBeUndefined();
    expect(cellsBeside({ lane: 0, row: 2 })).toEqual([{ lane: 1, row: 2 }]);
    expect(cellsBeside({ lane: 2, row: 0 })).toEqual([
      { lane: 1, row: 0 },
      { lane: 3, row: 0 },
    ]);
  });
  it('around is orthogonal only by default; diagonals are a separate set', () => {
    expect(cellsAround({ lane: 1, row: 1 })).toHaveLength(4);
    expect(cellsAround({ lane: 0, row: 0 })).toHaveLength(2);
    expect(cellsDiagonal({ lane: 1, row: 1 })).toHaveLength(4);
    expect(cellsDiagonal({ lane: 0, row: 0 })).toEqual([{ lane: 1, row: 1 }]);
  });
  it('orders units: initiative side first, then lane A-D, then Front-Back', () => {
    const list = [u(1, 0, 0), u(0, 3, 2), u(0, 0, 1), u(0, 0, 0)];
    expect(orderUnits(list, 0).map((x) => `${x.side}${x.lane}${x.row}`)).toEqual(['000', '001', '032', '100']);
    expect(orderUnits(list, 1).map((x) => `${x.side}${x.lane}${x.row}`)).toEqual(['100', '000', '001', '032']);
  });
  it('empty cells exclude occupied ones', () => {
    expect(emptyCells([u(0, 0, 0)], 0)).toHaveLength(11);
    expect(emptyCells([u(0, 0, 0)], 1)).toHaveLength(12);
  });
});
