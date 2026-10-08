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
    // Until a card has its own sprite, tint the placeholder with the Origin colour of its first trait.
    if (sprite.id === 'placeholder') {
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
