import { mkdirSync, writeFileSync } from 'node:fs';
import { ENDESGA32, hexToRgb } from '../src/content/sprites/palette';
import { SPRITES } from '../src/content/sprites/index';
import { rasterize, SPRITE_SIZE, validateSprite } from '../src/content/sprites/types';
import { Canvas } from './png';

// `npm run sprites`        -> public/sprites/atlas.png + atlas.json (×1, 16 per row)
// `npm run sprites:sheet`  -> reports/sprites-sheet.png (every sprite at ×1 and ×4 on the board colour)
const mode = process.argv[2] ?? 'atlas';
const errors = SPRITES.flatMap(validateSprite);
if (errors.length) {
  for (const e of errors.slice(0, 10)) console.log(`ERROR sprite ${e.id} ${e.message}`);
  process.exit(1);
}

const board = hexToRgb(ENDESGA32[15]!); // deep teal, the board background

if (mode === 'atlas') {
  const perRow = 16;
  const rows = Math.ceil(SPRITES.length / perRow);
  const canvas = new Canvas(perRow * SPRITE_SIZE, rows * SPRITE_SIZE, [0, 0, 0]);
  canvas.data.fill(0); // transparent atlas
  const index: Record<string, { x: number; y: number }> = {};
  SPRITES.forEach((s, i) => {
    const x = (i % perRow) * SPRITE_SIZE,
      y = Math.floor(i / perRow) * SPRITE_SIZE;
    canvas.blit(rasterize(s, 1, ENDESGA32), SPRITE_SIZE, SPRITE_SIZE, x, y);
    index[s.id] = { x, y };
  });
  mkdirSync('public/sprites', { recursive: true });
  writeFileSync('public/sprites/atlas.png', canvas.toPng());
  writeFileSync('public/sprites/atlas.json', JSON.stringify({ size: SPRITE_SIZE, perRow, sprites: index }, null, 2));
  console.log(`atlas: ${SPRITES.length} sprites -> public/sprites/atlas.png`);
} else {
  const perRow = 8;
  const cellW = SPRITE_SIZE * 5 + 8,
    cellH = SPRITE_SIZE * 4 + 8;
  const rows = Math.ceil(SPRITES.length / perRow);
  const canvas = new Canvas(perRow * cellW, rows * cellH, board);
  SPRITES.forEach((s, i) => {
    const x0 = (i % perRow) * cellW + 4,
      y0 = Math.floor(i / perRow) * cellH + 4;
    canvas.blit(rasterize(s, 1, ENDESGA32), SPRITE_SIZE, SPRITE_SIZE, x0, y0);
    canvas.blit(rasterize(s, 4, ENDESGA32), SPRITE_SIZE * 4, SPRITE_SIZE * 4, x0 + SPRITE_SIZE + 4, y0);
  });
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/sprites-sheet.png', canvas.toPng());
  console.log(`sheet: ${SPRITES.length} sprites -> reports/sprites-sheet.png`);
}
