import { describe, expect, it } from 'vitest';
import { FLAGS } from '../../config/flags';
import { content } from '../../content/cards';
import { applyAction, newBattle, playOut, type BattleConfig } from '../battle/battle';
import { bossConfig, eliteConfig } from '../run/encounters';
import { makeRng } from '../rng';
import { scenarioFight } from '../scenarios';
import { setup } from '../test/kit';
import { enemyIntent, greedyIntent } from './greedy';
import { scriptedIntent, scriptedPolicy } from './scripted';

/** SPEC §12 AI ladder: scripted fights, greedy elites and boss; the AI only ever calls applyAction. */

describe('scripted AI', () => {
  it('plays all 8 fights from their data decks in order with no illegal actions', () => {
    for (let f = 0; f < content.fights.length; f++) {
      const st = newBattle(scenarioFight(`f${f}`, f % 4, f)).state;
      const r = playOut(st, scriptedPolicy, makeRng('s', 'ai'));
      expect(r.state.errors, content.fights[f]!.name).toEqual([]);
      expect(r.state.phase).toBe('over');
      // The enemy deck is played in order: every card before the last spent one is spent too.
      const cards = r.state.sides[1].cards;
      const lastSpent = cards.map((c) => c.spent).lastIndexOf(true);
      expect(cards.slice(0, lastSpent + 1).every((c) => c.spent), content.fights[f]!.name).toBe(true);
      expect(lastSpent).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('greedy AI', () => {
  it('is deterministic and only returns legal actions', () => {
    const cfg: BattleConfig = { seed: 'g', kind: 'elite', elite: { kind: 'tideCaller' }, player: { hp: FLAGS.playerHp, embers: 10, cards: [{ key: 'e_salthound', level: 1 }, { key: 'e_crab', level: 1 }] }, enemy: eliteConfig(1) };
    const st = newBattle(cfg).state;
    let s = applyAction(st, scriptedIntent(st, 0).action).state;
    const a = greedyIntent(s, 1);
    const b = greedyIntent(s, 1);
    expect(a).toEqual(b);
    expect(a.action.type).not.toBe('pass');
    s = applyAction(s, a.action).state;
    expect(s.errors).toEqual([]);
  });
  it('prefers a lethal attack over a quiet placement', () => {
    const st = setup({ kind: 'elite', enemyCards: ['e_salthound', 'e_sentry'], enemy: [], player: [] });
    st.sides[0].hp = 2;
    st.turn = 1;
    const it = greedyIntent(st, 1);
    expect(it.action.type).toBe('summon');
    expect(it.cardKey).toBe('e_salthound');
  });
  it('the ladder: scripted for fights, greedy for elites and the boss', () => {
    const fight = setup({ kind: 'fight', enemyCards: ['e_salthound'] });
    fight.turn = 1;
    expect(enemyIntent(fight, 1)).toEqual(scriptedIntent(fight, 1));
    const boss = newBattle({ seed: 'b', kind: 'boss', boss: true, player: { hp: FLAGS.playerHp, embers: 10, cards: [] }, enemy: bossConfig() }).state;
    boss.turn = 1;
    expect(enemyIntent(boss, 1)).toEqual(greedyIntent(boss, 1));
  });
});
