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

import { cards } from '../cards';
import { ENEMY_EFFECTS, TOKENS } from '../effects/cards';
import { spritesById as byId } from './index';
import { validateSprite as validate } from './types';
import { it as test, expect as check } from 'vitest';

test('every card, token and enemy unit has its own valid sprite', () => {
  const missing: string[] = [];
  for (const c of cards) if (!byId.has(`c${c.id}`)) missing.push(`c${c.id}`);
  for (const k of Object.keys(ENEMY_EFFECTS)) if (!byId.has(k)) missing.push(k);
  for (const t of Object.values(TOKENS)) if (!byId.has(t.id)) missing.push(t.id);
  check(missing).toEqual([]);
  const errors = [...byId.values()].flatMap(validate);
  check(errors).toEqual([]);
  const ids = [...byId.keys()];
  check(new Set(ids).size).toBe(ids.length);
});
