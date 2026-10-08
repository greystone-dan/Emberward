import { FLAGS } from '../../config/flags';
import { content } from '../../content/cards';
import type { BattleSideConfig } from '../battle/battle';
import { fightSide, keyFor } from '../scenarios';
import type { EliteRule } from '../types';

/**
 * Enemy sides for the run. Fights come straight from content; elites and the boss are composed here
 * here: each elite's signature unit starts on the board (its rule is an engine hook keyed on its id).
 */

export function fightConfig(index: number): BattleSideConfig {
  return fightSide(index);
}

const ELITE_RULES: EliteRule['kind'][] = ['choirAbbot', 'tideCaller', 'brazierKnight'];

export function eliteRule(index: number): EliteRule {
  return { kind: ELITE_RULES[index % ELITE_RULES.length]! };
}

const ELITE_DECKS: string[][] = [
  // The Choir Abbot: bones and singers; the Abbot itself stands in the Back row.
  ['e_chorister', 'e_shambler', 'Gloomshot', 'e_chorister', 'Bone Gnawer', 'Choir of Bones', 'e_shambler'],
  // The Tide-Caller: hooks and binders.
  ['e_hook', 'Moray', 'e_hook', 'Kelp Wraith', 'Drowned Archer', 'e_sentry', 'Gloom Jelly'],
  // The Brazier Knight: wax and fire.
  ['Lampwick Squire', 'e_waxen', 'Ember Hound', 'e_thief', 'Wickmonger', 'e_waxen', 'Kiln Mortar'],
];
const ELITE_BOARD: { key: string; lane: 0 | 1 | 2 | 3; row: 0 | 1 | 2 }[] = [
  { key: 'e_abbot', lane: 1, row: 2 },
  { key: 'e_tideCaller', lane: 2, row: 2 },
  { key: 'e_brazierKnight', lane: 1, row: 0 },
];

export function eliteConfig(index: number): BattleSideConfig {
  const e = content.elites[index % content.elites.length]!;
  const deck = ELITE_DECKS[index % ELITE_DECKS.length]!;
  return {
    hp: e.hp || FLAGS.enemyHp.elite,
    embers: 4,
    cards: deck.map((n) => ({ key: keyFor(n), level: 1 as const })),
    wardenName: e.name,
    board: [ELITE_BOARD[index % ELITE_BOARD.length]!],
  };
}

export function bossConfig(): BattleSideConfig {
  const deck = ['e_waxen', 'e_thief', 'e_waxen', 'e_thief', 'Kiln Mortar', 'Lantern Sentry', 'The Sun Furnace', 'The Sun Furnace', 'The Sun Furnace'];
  return {
    hp: content.boss.hp || FLAGS.enemyHp.boss,
    embers: 5,
    cards: deck.map((n) => ({ key: keyFor(n), level: 1 as const })),
    wardenName: content.boss.name,
  };
}
