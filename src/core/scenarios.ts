import { FLAGS } from '../config/flags';
import { cardsByName, content } from '../content/cards';
import type { Level } from './types';
import type { BattleConfig, BattleSideConfig } from './battle/battle';
import { cardKey } from './battle/defs';

/** Resolves a fight deck entry (card name or e_ id) to a definition key. */
export function keyFor(entry: string): string {
  if (entry.startsWith('e_')) return entry;
  const c = cardsByName.get(entry);
  if (!c) throw new Error(`Unknown card "${entry}"`);
  return cardKey(c.id);
}

export function wardenDeck(wardenIndex: number): { key: string; level: Level }[] {
  const w = content.wardens[wardenIndex]!;
  return w.deck.map((id) => ({ key: cardKey(id), level: 1 }));
}

export function fightSide(fightIndex: number): BattleSideConfig {
  const f = content.fights[fightIndex % content.fights.length]!;
  return { hp: FLAGS.enemyHp.fight, embers: f.embers, cards: f.deck.map((e) => ({ key: keyFor(e), level: 1 })), wardenName: f.name };
}

export function playerSide(wardenIndex: number, embers = FLAGS.startEmbers, extra: { key: string; level: Level }[] = []): BattleSideConfig {
  const w = content.wardens[wardenIndex]!;
  return { hp: FLAGS.playerHp, embers, cards: [...wardenDeck(wardenIndex), ...extra], wardenName: w.name };
}

/** A standard fight: a Warden's starting deck plus a few extra cards against one of the 8 fights. */
export function scenarioFight(seed: string, wardenIndex: number, fightIndex: number, extra: { key: string; level: Level }[] = []): BattleConfig {
  return { seed, kind: 'fight', player: playerSide(wardenIndex, FLAGS.startEmbers, extra), enemy: fightSide(fightIndex) };
}
