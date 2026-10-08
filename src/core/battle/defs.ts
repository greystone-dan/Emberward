import { FLAGS } from '../../config/flags';
import { cardsById, enemyUnitsById } from '../../content/cards';
import { CARD_EFFECTS, ENEMY_EFFECTS, TOKENS } from '../../content/effects/cards';
import type { LevelEffects, Passive, SpellDef, Trigger } from '../../content/effects/dsl';
import type { Shape, Trait } from '../../content/types';
import type { Level } from '../types';

/** A resolved unit definition at a given level: what a card is when it hits the board. */
export interface UnitDef {
  key: string;
  name: string;
  atk: number;
  hp: number;
  shape: Shape;
  traits: Trait[];
  token: boolean;
  rarity?: 'C' | 'U' | 'R';
  passives: Passive[];
  triggers: Trigger[];
  spell?: SpellDef;
  spellCost: number;
  spellName: string;
  text: string;
  spellText: string;
}

export function cardKey(id: number): string {
  return `c${id}`;
}
export function cardIdOf(key: string): number | undefined {
  return key.startsWith('c') ? Number(key.slice(1)) : undefined;
}

function merge(a: LevelEffects, b?: LevelEffects): LevelEffects {
  if (!b) return a;
  return {
    passives: [...(a.passives ?? []), ...(b.passives ?? [])],
    triggers: [...(a.triggers ?? []), ...(b.triggers ?? [])],
    spell: b.spell ?? a.spell,
  };
}

const cache = new Map<string, UnitDef>();

/** Looks up a definition by key ('c12', 'e_sentry', 't_wisp') and level. Deterministic and cached. */
export function defFor(key: string, level: Level = 1): UnitDef {
  const ck = `${key}@${level}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  let def: UnitDef;
  const id = cardIdOf(key);
  if (id !== undefined) {
    const card = cardsById.get(id);
    if (!card) throw new Error(`No card ${key}`);
    const fx = CARD_EFFECTS[id];
    if (!fx) throw new Error(`No effects for card ${key}`);
    const base = level === 1 ? card.spark : card.flame;
    let effects = level === 1 ? fx.spark : fx.flame;
    let atk = base.stats.atk,
      hp = base.stats.hp,
      spellCost = base.spellCost;
    let text = base.text;
    if (level === 3) {
      if (!FLAGS.fireExists) throw new Error('Fire is disabled by flag');
      atk = Math.ceil(atk * FLAGS.fireStatMultiplier);
      hp = Math.ceil(hp * FLAGS.fireStatMultiplier);
      spellCost = 0;
      effects = merge(effects, fx.fire);
      if (card.fireLine) text = `${text} ${card.fireLine}`;
    }
    def = {
      key,
      name: card.name,
      atk,
      hp,
      shape: base.stats.shape,
      traits: [...card.traits],
      token: false,
      rarity: card.rarity,
      passives: effects.passives ?? [],
      triggers: effects.triggers ?? [],
      spell: effects.spell,
      spellCost,
      spellName: base.spellName,
      text,
      spellText: base.spellText,
    };
  } else if (key.startsWith('e_')) {
    const e = enemyUnitsById.get(key);
    if (!e) throw new Error(`No enemy unit ${key}`);
    const fx = ENEMY_EFFECTS[key] ?? {};
    def = {
      key,
      name: e.name,
      atk: e.atk,
      hp: e.hp,
      shape: e.shape,
      traits: [],
      token: false,
      passives: fx.passives ?? [],
      triggers: fx.triggers ?? [],
      spellCost: 0,
      spellName: '',
      text: e.text,
      spellText: '',
    };
  } else if (key.startsWith('t_')) {
    const t = Object.values(TOKENS).find((x) => x.id === key);
    if (!t) throw new Error(`No token ${key}`);
    def = {
      key,
      name: t.name,
      atk: t.atk,
      hp: t.hp,
      shape: t.shape,
      traits: [],
      token: true,
      passives: t.effects.passives ?? [],
      triggers: t.effects.triggers ?? [],
      spellCost: 0,
      spellName: '',
      text: '',
      spellText: '',
    };
  } else {
    throw new Error(`Unknown unit key ${key}`);
  }
  cache.set(ck, def);
  return def;
}

/** Market price by rarity (SPEC §11). */
export function cardPrice(key: string): number {
  const id = cardIdOf(key);
  const card = id === undefined ? undefined : cardsById.get(id);
  if (!card) return 0;
  return card.rarity === 'C' ? FLAGS.marketPrices.common : card.rarity === 'U' ? FLAGS.marketPrices.uncommon : FLAGS.marketPrices.rare;
}
