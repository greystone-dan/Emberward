import { describe, expect, it } from 'vitest';
import { ENDESGA32, PALETTE_CHARS } from './palette';
import { SPRITES } from './index';
import { rasterize, validateSprite } from './types';

describe('sprites', () => {
  it('palette is Endesga 32 with one char per index', () => {
    expect(ENDESGA32.length).toBe(32);
    expect(PALETTE_CHARS.length).toBe(32);
    expect(new Set(ENDESGA32).size).toBe(32);
    expect(ENDESGA32[25]).toBe('#181425');
  });

  it('every registered sprite follows ART.md', () => {
    const ids = new Set<string>();
    for (const s of SPRITES) {
      expect(ids.has(s.id), `duplicate ${s.id}`).toBe(false);
      ids.add(s.id);
      expect(validateSprite(s), s.id).toEqual([]);
    }
  });

  it('rasterizes with integer scaling', () => {
    const px = rasterize(SPRITES[0]!, 2, ENDESGA32);
    expect(px.length).toBe(64 * 64 * 4);
  });
});
