import type { SpriteDef } from './types';
import { placeholders } from './placeholders';

/**
 * The sprite registry. Phase 3 fills it with one sprite per card, token and enemy unit;
 * until then a card without a sprite falls back to a silhouette by its first trait.
 */
export const SPRITES: readonly SpriteDef[] = [...placeholders];

export const spritesById: ReadonlyMap<string, SpriteDef> = new Map(SPRITES.map((s) => [s.id, s]));

/** ART.md: hide the pipeline behind an ArtProvider so sprites can be swapped without code changes. */
export interface ArtProvider {
  getSprite(id: string, level: 1 | 2 | 3): SpriteDef;
}

export const codeArt: ArtProvider = {
  getSprite(id) {
    return spritesById.get(id) ?? spritesById.get('placeholder')!;
  },
};
