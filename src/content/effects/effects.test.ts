import { describe, expect, it } from 'vitest';
import { cards, content } from '../cards';
import { CARD_EFFECTS, ENEMY_EFFECTS, TOKENS } from './cards';
import type { LevelEffects } from './dsl';

/**
 * Validates every card's rules text against its DSL: keywords imply the right passives and triggers,
 * and every number in the text appears somewhere in the data for that level.
 */

function numbersIn(x: unknown, out = new Set<number>()): Set<number> {
  if (typeof x === 'number') out.add(Math.abs(x));
  else if (Array.isArray(x)) for (const v of x) numbersIn(v, out);
  else if (x && typeof x === 'object') for (const v of Object.values(x)) numbersIn(v, out);
  return out;
}

/** Numbers that are rules text but not DSL data (e.g. "returns with 1 health", "+1/+1" of a trait description). */
function textNumbers(text: string): number[] {
  const cleaned = text
    .replace(/\d+✦/g, (m) => m) // ember amounts stay
    .replace(/with 1 health/g, '')
    .replace(/one row/g, '')
    .replace(/0\/(\d+)/g, '$1') // "0/3 Rubble": the 0 Power is implied by the token
    .replace(/at most twice|at most three times/g, '')
    .replace(/two adjacent lanes/g, '')
    .replace(/first time|first two times/g, '')
    .replace(/every two/g, '')
    .replace(/instead of 1/g, '');
  return [...cleaned.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => n !== 0);
}

function checkLevel(name: string, text: string, spellText: string, fx: LevelEffects, allowSpellMissing = false) {
  const passives = fx.passives ?? [];
  const triggers = fx.triggers ?? [];
  const has = (k: string) => passives.some((p) => p.k === k);
  const trig = (on: string) => triggers.some((t) => t.on === on);
  if (/\bTaunt\b/.test(text)) expect(has('taunt'), `${name}: Taunt`).toBe(true);
  if (/\bRooted\b/.test(text) && !/even if Rooted|becomes Rooted/.test(text)) expect(has('rooted'), `${name}: Rooted`).toBe(true);
  if (/\bPersist\b/.test(text)) expect(has('persist'), `${name}: Persist`).toBe(true);
  const swift = /Swift (\d)/.exec(text);
  if (swift) expect(passives.find((p) => p.k === 'swift' && p.n === Number(swift[1])), `${name}: Swift ${swift[1]}`).toBeDefined();
  if (/Kindle:/.test(text)) expect(trig('kindle'), `${name}: Kindle`).toBe(true);
  if (/Last Gasp:/.test(text)) expect(trig('lastGasp'), `${name}: Last Gasp`).toBe(true);
  if (/Wave Start:/.test(text)) expect(trig('waveStart'), `${name}: Wave Start`).toBe(true);
  if (/Wave End:/.test(text)) expect(trig('waveEnd'), `${name}: Wave End`).toBe(true);
  if (/Aura \(/.test(text)) expect(has('aura'), `${name}: Aura`).toBe(true);
  if (/Hits apply Burn/.test(text)) expect(passives.some((p) => p.k === 'hitsApply' && p.status === 'burn'), `${name}: hits apply Burn`).toBe(true);
  if (/Hits apply Poison/.test(text)) expect(passives.some((p) => p.k === 'hitsApply' && p.status === 'poison'), `${name}: hits apply Poison`).toBe(true);
  if (/Immune to Burn/.test(text)) expect(passives.some((p) => p.k === 'immune' && p.status === 'burn'), `${name}: immune`).toBe(true);
  const dataNumbers = numbersIn({ passives, triggers });
  for (const n of textNumbers(text)) expect(dataNumbers.has(n), `${name}: Kindled text number ${n} in "${text}"`).toBe(true);
  if (!allowSpellMissing) {
    expect(fx.spell, `${name}: spell`).toBeDefined();
    const spellNumbers = numbersIn(fx.spell);
    for (const n of textNumbers(spellText)) expect(spellNumbers.has(n), `${name}: spell number ${n} in "${spellText}"`).toBe(true);
  }
}

describe('card effects', () => {
  it('every card has Spark and Flame effects with a spell', () => {
    for (const c of cards) {
      const fx = CARD_EFFECTS[c.id];
      expect(fx, c.name).toBeDefined();
      expect(fx!.spark.spell, `${c.name} spark spell`).toBeDefined();
      expect(fx!.flame.spell, `${c.name} flame spell`).toBeDefined();
    }
  });
  it('rules text matches the DSL at Spark', () => {
    for (const c of cards) checkLevel(`${c.name} (Spark)`, c.spark.text, c.spark.spellText, CARD_EFFECTS[c.id]!.spark);
  });
  it('rules text matches the DSL at Flame', () => {
    for (const c of cards) checkLevel(`${c.name} (Flame)`, c.flame.text, c.flame.spellText, CARD_EFFECTS[c.id]!.flame);
  });
  it('hand-written Fire lines have Fire effects', () => {
    for (const c of cards) {
      if (!c.fireLine) continue;
      const fx = CARD_EFFECTS[c.id]!.fire;
      expect(fx, `${c.name} fire`).toBeDefined();
      checkLevel(`${c.name} (Fire)`, c.fireLine, '', fx!, true);
    }
  });
  it('enemy units and tokens are data too', () => {
    for (const e of content.enemyUnits) {
      const fx = ENEMY_EFFECTS[e.id];
      expect(fx, e.id).toBeDefined();
      checkLevel(e.name, e.text, '', fx!, true);
    }
    expect(Object.keys(TOKENS).sort()).toEqual(['bat', 'boneWall', 'chorister', 'rubble', 'wisp']);
    expect(TOKENS.wisp).toMatchObject({ atk: 1, hp: 1, shape: 'strike' });
  });
});
