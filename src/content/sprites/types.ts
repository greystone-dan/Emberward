import { paletteIndex, PALETTE_CHARS, TRANSPARENT } from './palette';

export const SPRITE_SIZE = 32;

/** A sprite is 32 rows of 32 palette characters ('.' = transparent). */
export interface SpriteDef {
  id: string;
  rows: readonly string[];
}

export interface SpriteError {
  id: string;
  message: string;
}

/** Validates a sprite against ART.md: 32×32, palette-only, 1px outline colour present, padding ≥ 2px. */
export function validateSprite(s: SpriteDef): SpriteError[] {
  const errors: SpriteError[] = [];
  if (s.rows.length !== SPRITE_SIZE) errors.push({ id: s.id, message: `has ${s.rows.length} rows, want ${SPRITE_SIZE}` });
  let filled = 0;
  let outline = 0;
  let minX = SPRITE_SIZE,
    maxX = -1,
    minY = SPRITE_SIZE,
    maxY = -1;
  s.rows.forEach((row, y) => {
    if (row.length !== SPRITE_SIZE) errors.push({ id: s.id, message: `row ${y} has ${row.length} chars, want ${SPRITE_SIZE}` });
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === TRANSPARENT) continue;
      if (!PALETTE_CHARS.includes(ch)) {
        errors.push({ id: s.id, message: `row ${y} col ${x}: "${ch}" is not a palette character` });
        continue;
      }
      filled++;
      if (paletteIndex(ch) === 25) outline++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  });
  if (filled === 0) errors.push({ id: s.id, message: 'is empty' });
  else {
    if (outline === 0) errors.push({ id: s.id, message: 'has no outline pixels (#181425)' });
    if (minX < 2 || minY < 2 || maxX > SPRITE_SIZE - 3 || maxY > SPRITE_SIZE - 3)
      errors.push({ id: s.id, message: `breaks the 2px padding (bbox ${minX},${minY}-${maxX},${maxY})` });
  }
  return errors;
}

/** Row-major RGBA pixels for one sprite, scaled by an integer factor. */
export function rasterize(s: SpriteDef, scale: number, palette: readonly string[]): Uint8Array {
  const size = SPRITE_SIZE * scale;
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < SPRITE_SIZE; y++) {
    const row = s.rows[y] ?? '';
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const ch = row[x] ?? TRANSPARENT;
      if (ch === TRANSPARENT) continue;
      const hex = palette[paletteIndex(ch)]!;
      const r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((y * scale + dy) * size + x * scale + dx) * 4;
          out[i] = r;
          out[i + 1] = g;
          out[i + 2] = b;
          out[i + 3] = 255;
        }
      }
    }
  }
  return out;
}
