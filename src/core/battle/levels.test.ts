import { describe, expect, it } from 'vitest';
import { cards } from '../../content/cards';
import { defFor, cardKey } from './defs';
import { renderToText } from './render';
import { setup } from '../test/kit';

describe('card levels (SPEC §10)', () => {
  it('Flame uses the Flame stats and spell; Fire is Flame x1.5 rounded up with a free spell', () => {
    for (const c of cards) {
      const spark = defFor(cardKey(c.id), 1);
      const flame = defFor(cardKey(c.id), 2);
      const fire = defFor(cardKey(c.id), 3);
      expect(spark.atk).toBe(c.spark.stats.atk);
      expect(flame.atk).toBe(c.flame.stats.atk);
      expect(flame.spellCost).toBe(c.flame.spellCost);
      expect(fire.atk).toBe(Math.ceil(c.flame.stats.atk * 1.5));
      expect(fire.hp).toBe(Math.ceil(c.flame.stats.hp * 1.5));
      expect(fire.spellCost).toBe(0);
      if (c.fireLine) expect(fire.text).toContain(c.fireLine);
    }
  });
  it('renderToText shows both grids, HP, embers, wave and tiers', () => {
    const st = setup({ player: [{ name: 'Bell Warden', lane: 0, row: 0 }, { name: 'Tower Archer', lane: 0, row: 2 }], enemy: [{ name: 'e_crab', lane: 3, row: 0 }] });
    const text = renderToText(st);
    expect(text).toContain('Wave 1/6');
    expect(text).toContain('ENEMY  HP 12/12');
    expect(text).toContain('PLAYER HP 50/50');
    expect(text).toContain('Bellforged2');
    expect(text).toContain('Belfry');
    expect(text.split('\n').length).toBeGreaterThan(10);
  });
});
