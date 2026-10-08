import { useEffect, useRef } from 'react';
import { ENDESGA32 } from '../content/sprites/palette';
import { codeArt } from '../content/sprites/index';
import { rasterize, SPRITE_SIZE } from '../content/sprites/types';
import { cardIdOf, defFor } from '../core/battle/defs';
import { content } from '../content/cards';

/** Draws a code-authored sprite at an integer scale on a canvas. The ArtProvider decides what to draw. */
export function Sprite({ unitKey, level = 1, scale = 2 }: { unitKey: string; level?: 1 | 2 | 3; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const size = SPRITE_SIZE * scale;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const sprite = codeArt.getSprite(unitKey, level);
    const px = rasterize(sprite, scale, ENDESGA32);
    const img = ctx.createImageData(size, size);
    img.data.set(px);
    ctx.clearRect(0, 0, size, size);
    ctx.putImageData(img, 0, 0);
    // ART.md level effects: Flame gets a warm rim-light along the outline, Fire a gold one.
    if (level >= 2) rimLight(ctx, sprite, scale, level === 2 ? '#feae34' : '#fee761');
    // Until a card has its own sprite, tint the placeholder with the Origin colour of its first trait.
    // (The lantern itself, asked for by its own id, stays untinted.)
    if (sprite.id === 'placeholder' && unitKey !== 'placeholder') {
      const id = cardIdOf(unitKey);
      const def = defFor(unitKey, level);
      const trait = def.traits[0];
      const col = trait ? content.traits[trait].col : id === undefined ? '#8b9bb4' : '#feae34';
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [unitKey, level, scale]);
  return <canvas ref={ref} className="sprite" width={SPRITE_SIZE * scale} height={SPRITE_SIZE * scale} data-sprite={unitKey} />;
}

/** Paints every transparent pixel that touches the sprite in the rim colour: a 1px pixel-exact glow. */
function rimLight(ctx: CanvasRenderingContext2D, sprite: { rows: readonly string[] }, scale: number, colour: string) {
  const n = SPRITE_SIZE;
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && sprite.rows[y]?.[x] !== '.';
  ctx.fillStyle = colour;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (filled(x, y)) continue;
      // Light comes from the top-left: rim the top and left edges, and a lighter touch elsewhere.
      const lit = filled(x + 1, y) || filled(x, y + 1);
      const shade = filled(x - 1, y) || filled(x, y - 1);
      if (!lit && !shade) continue;
      ctx.globalAlpha = lit ? 0.9 : 0.35;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  ctx.globalAlpha = 1;
}
