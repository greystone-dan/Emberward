import { describe, expect, it } from 'vitest';
import { cards, cardsById, cardsByName, content, enemyUnitsById, parseSpellLine, parseStatLine } from './cards';
import { CLASSES, ORIGINS, SHAPES, TRAITS } from './types';

describe('content schema', () => {
  it('loads 60 cards with unique ids and names', () => {
    expect(cards.length).toBe(60);
    expect(new Set(cards.map((c) => c.id)).size).toBe(60);
    expect(new Set(cards.map((c) => c.name)).size).toBe(60);
    for (let i = 1; i <= 60; i++) expect(cardsById.has(i)).toBe(true);
  });

  it('every card has valid traits, stats, shape, spell and flame form', () => {
    for (const c of cards) {
      expect(c.traits.length, c.name).toBeGreaterThanOrEqual(2);
      expect(c.traits.length, c.name).toBeLessThanOrEqual(4);
      for (const t of c.traits) expect(TRAITS, `${c.name}: ${t}`).toContain(t);
      expect(c.traits.some((t) => (ORIGINS as readonly string[]).includes(t)), `${c.name} needs an Origin`).toBe(true);
      expect(['C', 'U', 'R']).toContain(c.rarity);
      expect(c.icon.length).toBeGreaterThan(0);
      for (const lvl of [c.spark, c.flame]) {
        expect(SHAPES).toContain(lvl.stats.shape);
        expect(Number.isInteger(lvl.stats.atk) && lvl.stats.atk >= 0, c.name).toBe(true);
        expect(Number.isInteger(lvl.stats.hp) && lvl.stats.hp >= 1, c.name).toBe(true);
        expect(lvl.text.length, c.name).toBeGreaterThan(0);
        expect(lvl.spellName.length, c.name).toBeGreaterThan(0);
        expect(lvl.spellText.length, c.name).toBeGreaterThan(0);
        expect(Number.isInteger(lvl.spellCost) && lvl.spellCost >= 0, c.name).toBe(true);
      }
      // Support units have no attack shape and no Power; attackers have a shape.
      expect(c.spark.stats.shape === 'none' ? true : c.spark.stats.atk >= 0).toBe(true);
      // The Flame spell costs 1 less than the Spark spell, never below 0 (SPEC §10).
      expect(c.flame.spellCost, `${c.name} flame cost`).toBe(Math.max(0, c.spark.spellCost - 1));
      expect(c.flame.spellName, `${c.name} flame spell name`).toBe(c.spark.spellName);
      // Flame stats are at least the Spark stats.
      expect(c.flame.stats.atk).toBeGreaterThanOrEqual(c.spark.stats.atk);
      expect(c.flame.stats.hp).toBeGreaterThanOrEqual(c.spark.stats.hp);
    }
  });

  it('parses stat and spell lines', () => {
    expect(parseStatLine('5/6 Cleave')).toEqual({ atk: 5, hp: 6, shape: 'cleave' });
    expect(parseStatLine('0/8 Support')).toEqual({ atk: 0, hp: 8, shape: 'none' });
    expect(parseSpellLine('Flare (0✦): Deal 5 to the front-most enemy in a lane.')).toEqual({
      name: 'Flare',
      cost: 0,
      text: 'Deal 5 to the front-most enemy in a lane.',
    });
    expect(() => parseStatLine('5-6 Cleave')).toThrow();
  });

  it('has all 17 traits with tiers, colours and icons', () => {
    const names = Object.keys(content.traits);
    expect(names.sort()).toEqual([...TRAITS].sort());
    for (const o of ORIGINS) expect(content.traits[o].kind).toBe('Origin');
    for (const k of CLASSES) expect(content.traits[k].kind).toBe('Class');
    for (const t of TRAITS) {
      const def = content.traits[t];
      expect(def.col).toMatch(/^#[0-9a-f]{6}$/);
      expect(def.tiers.length).toBeGreaterThanOrEqual(2);
      let last = 0;
      for (const tier of def.tiers) {
        expect(tier.n).toBeGreaterThan(last);
        last = tier.n;
        expect(tier.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('fire examples match the cards that carry fireLines', () => {
    for (const [name, line] of Object.entries(content.fireExamples)) {
      const c = cardsByName.get(name);
      expect(c, name).toBeDefined();
      expect(c!.fireLine).toBe(line);
    }
    expect(cards.filter((c) => c.fireLine).length).toBe(Object.keys(content.fireExamples).length);
  });

  it('wardens have 6-card starting decks of real cards and a relic', () => {
    expect(content.wardens.length).toBe(4);
    expect(content.wardens.filter((w) => !w.locked).length).toBe(3);
    for (const w of content.wardens) {
      expect(ORIGINS).toContain(w.origin);
      expect(w.deck.length).toBe(6);
      for (const id of w.deck) expect(cardsById.has(id), `${w.name} card ${id}`).toBe(true);
      expect(w.relic).toMatch(/:/);
    }
  });

  it('enemy units, fights, elites and the boss reference real content', () => {
    expect(content.enemyUnits.length).toBe(9);
    for (const e of content.enemyUnits) {
      expect(e.id).toMatch(/^e_/);
      expect(SHAPES).toContain(e.shape);
    }
    expect(content.fights.length).toBe(8);
    for (const f of content.fights) {
      expect(f.deck.length).toBeGreaterThan(0);
      for (const entry of f.deck) {
        expect(cardsByName.has(entry) || enemyUnitsById.has(entry), `${f.name}: ${entry}`).toBe(true);
      }
      expect(f.embers).toBeGreaterThanOrEqual(0);
    }
    expect(content.elites.length).toBe(3);
    for (const e of content.elites) expect(e.hp).toBe(22);
    expect(content.boss.hp).toBe(40);
    expect(content.boss.phases.length).toBe(3);
    expect(content.events.length).toBe(5);
    for (const ev of content.events) expect(ev.options.length).toBeGreaterThanOrEqual(2);
  });

  it('relics, combos and comps are consistent', () => {
    expect(content.relics.length).toBe(12);
    for (const combo of content.combos) {
      for (const t of combo.traits) expect(TRAITS).toContain(t);
      for (const name of combo.cards) expect(cardsByName.has(name), `${combo.name}: ${name}`).toBe(true);
    }
    for (const comp of content.comps) {
      const cells = new Set<string>();
      for (const cell of comp.board) {
        expect(cell.row).toBeGreaterThanOrEqual(0);
        expect(cell.row).toBeLessThanOrEqual(2);
        expect(cell.lane).toBeGreaterThanOrEqual(0);
        expect(cell.lane).toBeLessThanOrEqual(3);
        expect(cardsByName.has(cell.card), `${comp.name}: ${cell.card}`).toBe(true);
        const key = `${cell.row},${cell.lane}`;
        expect(cells.has(key), `${comp.name} double-books ${key}`).toBe(false);
        cells.add(key);
      }
    }
  });
});
