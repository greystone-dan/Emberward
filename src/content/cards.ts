import raw from '../../content/cards.json';
import {
  type BossDef,
  type CardDef,
  type CardLevelText,
  type Content,
  type EnemyUnitDef,
  type Shape,
  SHAPES,
  type StatLine,
  type Trait,
  type TraitDef,
  type WardenDef,
} from './types';

/**
 * Typed loader over content/cards.json (the source of truth for content).
 * It parses, it never reinterprets: a card's meaning stays exactly what the JSON says.
 */

type RawCard = {
  id: number;
  name: string;
  traits: string[];
  rar: string;
  atk: number;
  hp: number;
  shape: string;
  icon: string;
  text: string;
  sn: string;
  sc: number;
  st: string;
  flame: { stats: string; text: string; spell: string };
  fireLine?: string;
};

const SHAPE_WORDS: Record<string, Shape> = {
  strike: 'strike',
  shoot: 'shoot',
  pierce: 'pierce',
  cleave: 'cleave',
  lob: 'lob',
  none: 'none',
  support: 'none',
};

export function parseShape(word: string): Shape {
  const shape = SHAPE_WORDS[word.trim().toLowerCase()];
  if (!shape) throw new Error(`Unknown shape "${word}"`);
  return shape;
}

/** "5/6 Cleave" -> { atk: 5, hp: 6, shape: 'cleave' } */
export function parseStatLine(s: string): StatLine {
  const m = /^(\d+)\/(\d+)\s+(\w+)$/.exec(s.trim());
  if (!m) throw new Error(`Bad stat line "${s}"`);
  return { atk: Number(m[1]), hp: Number(m[2]), shape: parseShape(m[3]!) };
}

/** "Flare (0✦): Deal 5 to the front-most enemy in a lane." -> name, cost, text */
export function parseSpellLine(s: string): { name: string; cost: number; text: string } {
  const m = /^(.+?)\s*\((\d+)✦\):\s*(.+)$/.exec(s.trim());
  if (!m) throw new Error(`Bad spell line "${s}"`);
  return { name: m[1]!, cost: Number(m[2]), text: m[3]! };
}

function toCard(c: RawCard): CardDef {
  if (c.rar !== 'C' && c.rar !== 'U' && c.rar !== 'R') throw new Error(`Card ${c.id}: bad rarity ${c.rar}`);
  const flameStats = parseStatLine(c.flame.stats);
  const flameSpell = parseSpellLine(c.flame.spell);
  const spark: CardLevelText = {
    stats: { atk: c.atk, hp: c.hp, shape: parseShape(c.shape) },
    text: c.text,
    spellName: c.sn,
    spellCost: c.sc,
    spellText: c.st,
  };
  const flame: CardLevelText = {
    stats: flameStats,
    text: c.flame.text,
    spellName: flameSpell.name,
    spellCost: flameSpell.cost,
    spellText: flameSpell.text,
  };
  const card: CardDef = {
    id: c.id,
    name: c.name,
    rarity: c.rar,
    traits: c.traits as Trait[],
    icon: c.icon,
    spark,
    flame,
  };
  if (c.fireLine && c.fireLine !== 'None') card.fireLine = c.fireLine;
  return card;
}

type RawBoss = Omit<BossDef, 'phases'> & { phases: [string, string, string][] };
type RawWarden = Omit<WardenDef, 'locked'>;
type RawEnemy = EnemyUnitDef & { order?: string };

const r = raw as unknown as Omit<Content, 'cards' | 'boss' | 'wardens' | 'enemyUnits'> & {
  cards: RawCard[];
  boss: RawBoss;
  wardens: RawWarden[];
  enemyUnits: RawEnemy[];
};

export const content: Content = {
  version: r.version,
  cards: r.cards.map(toCard),
  traits: r.traits as Record<Trait, TraitDef>,
  positional: r.positional,
  combos: r.combos,
  comps: r.comps,
  sigils: r.sigils,
  wardens: r.wardens.map((w) => ({ ...w, locked: /\(unlock\)/.test(w.name) })),
  relics: r.relics,
  fireExamples: r.fireExamples,
  enemyUnits: r.enemyUnits.map((e) => {
    const shape = parseShape(e.shape);
    const { order: _order, ...rest } = e;
    return { ...rest, shape };
  }),
  fights: r.fights,
  elites: r.elites,
  boss: {
    ...r.boss,
    phases: r.boss.phases.map(([waves, name, text]) => ({ waves, name, text })),
  },
  events: r.events,
};

export const cards: CardDef[] = content.cards;
export const cardsById: ReadonlyMap<number, CardDef> = new Map(cards.map((c) => [c.id, c]));
export const cardsByName: ReadonlyMap<string, CardDef> = new Map(cards.map((c) => [c.name, c]));
export const enemyUnitsById: ReadonlyMap<string, EnemyUnitDef> = new Map(content.enemyUnits.map((e) => [e.id, e]));

export { SHAPES };
