import { cardsById } from '../../content/cards';
import { scriptedIntent } from '../ai/scripted';
import { nextInt, type RngState } from '../rng';
import type { RunAction, RunState } from './types';
import { applyRunAction, legalRunActions, newRun, priceAt, type RunOptions } from './run';

/**
 * A simple run bot: plays the whole run headless. Drafts cards sharing traits with its deck, prefers Hearths
 * when hurt and Markets when rich, musters by level and rarity, and uses the scripted battle policy.
 * It only ever calls applyRunAction, so it can't cheat. Used by the run simulator and the e2e test.
 */
export function botRunAction(run: RunState, rng: RngState, opts: RunOptions = {}): [RunAction | null, RngState] {
  if (run.phase === 'battle' && run.battle) {
    if (run.battle.turn !== 0) return [{ type: 'battle', action: scriptedIntent(run.battle, 1).action }, rng];
    return [{ type: 'battle', action: scriptedIntent(run.battle, 0).action }, rng];
  }
  const legal = legalRunActions(run, opts);
  if (legal.length === 0) return [null, rng];
  // Rekindle whenever offered.
  const rek = legal.find((a) => a.type === 'rekindle');
  if (rek) return [rek, rng];
  switch (run.phase) {
    case 'wardenSelect': {
      const [i, r] = nextInt(rng, legal.length);
      return [legal[i]!, r];
    }
    case 'drift': {
      const takes = legal.filter((a): a is Extract<RunAction, { type: 'driftTake' }> => a.type === 'driftTake');
      if (takes.length === 0) return [legal.find((a) => a.type === 'driftDone')!, rng];
      let best = takes[0]!;
      let bestScore = -Infinity;
      for (const t of takes) {
        const c = run.drift.line[t.slot]!;
        const score = cardScore(run, c.cardId) - priceAt(run, t.slot) * 1.5 + (c.echo ? 1 : 0);
        if (score > bestScore) {
          best = t;
          bestScore = score;
        }
      }
      return [best, rng];
    }
    case 'map': {
      const choices = legal.filter((a): a is Extract<RunAction, { type: 'mapChoose' }> => a.type === 'mapChoose');
      const score = (id: number) => {
        const n = run.map[id]!;
        const hurt = run.hp < run.maxHp * 0.5;
        switch (n.type) {
          case 'hearth':
            return hurt ? 5 : 1;
          case 'market':
            return run.embers >= 8 ? 4 : 1;
          case 'elite':
            return run.hp > run.maxHp * 0.6 && run.deck.length >= 9 ? 3 : 0;
          case 'shrine':
            return 2;
          case 'scout':
            return 1;
          default:
            return 2;
        }
      };
      let best = choices[0]!;
      for (const c of choices) if (score(c.node) > score(best.node)) best = c;
      return [best, rng];
    }
    case 'market': {
      const buys = legal.filter((a): a is Extract<RunAction, { type: 'marketBuy' }> => a.type === 'marketBuy');
      const affordableGood = buys.filter((b) => run.embers - (run.market!.cardPrices[b.slot] ?? 0) >= 5);
      if (affordableGood.length) {
        let best = affordableGood[0]!;
        for (const b of affordableGood) if (cardScore(run, run.market!.cards[b.slot]!.cardId) > cardScore(run, run.market!.cards[best.slot]!.cardId)) best = b;
        return [best, rng];
      }
      const relic = legal.find((a) => a.type === 'marketBuyRelic');
      if (relic && run.embers >= run.market!.relicPrice + 4) return [relic, rng];
      return [legal.find((a) => a.type === 'leave')!, rng];
    }
    case 'hearth': {
      if (run.hearthUsed) return [legal.find((a) => a.type === 'leave')!, rng];
      if (run.hp < run.maxHp * 0.7) return [{ type: 'hearthHeal' }, rng];
      // Temper the best card.
      const best = [...run.deck].sort((a, b) => cardScore(run, b.cardId) + b.level * 3 - (cardScore(run, a.cardId) + a.level * 3))[0]!;
      return [{ type: 'hearthTemper', uid: best.uid }, rng];
    }
    case 'shrine': {
      const choose = legal.filter((a): a is Extract<RunAction, { type: 'shrineChoose' }> => a.type === 'shrineChoose');
      if (choose.length) {
        // Prefer safe options: embers, heals, stuns. Avoid HP costs when hurt.
        const safe = choose.filter((c) => c.option === 1) ;
        return [safe[0] ?? choose[choose.length - 1]!, rng];
      }
      const picks = legal.filter((a): a is Extract<RunAction, { type: 'shrinePick' }> => a.type === 'shrinePick');
      if (picks.length) {
        const worst = [...run.deck].sort((a, b) => cardScore(run, a.cardId) - cardScore(run, b.cardId))[0]!;
        const pick = picks.find((p) => p.uid === worst.uid) ?? picks[0]!;
        return [pick, rng];
      }
      return [legal.find((a) => a.type === 'leave')!, rng];
    }
    case 'reward':
      return [legal.find((a) => a.type === 'continue')!, rng];
    default:
      return [legal[0]!, rng];
  }
}

/** How well a card fits the deck: shared traits with owned cards, plus a nudge toward copies (Rekindling). */
export function cardScore(run: RunState, cardId: number): number {
  const def = cardsById.get(cardId);
  if (!def) return 0;
  let score = def.rarity === 'R' ? 3 : def.rarity === 'U' ? 2 : 1;
  const owned = new Map<string, number>();
  for (const c of run.deck) for (const t of cardsById.get(c.cardId)?.traits ?? []) owned.set(t, (owned.get(t) ?? 0) + 1);
  for (const t of def.traits) score += Math.min(3, owned.get(t) ?? 0) * 0.8;
  const copies = run.deck.filter((c) => c.cardId === cardId && c.level === 1).length;
  if (copies === 2) score += 3;
  else if (copies === 1) score += 1;
  return score;
}

/** Plays a run to the end. Returns the final state and the actions taken. */
export function playRun(seed: string, maxSteps = 5000, opts: RunOptions = {}): { state: RunState; steps: number; actions: RunAction[] } {
  const run: RunState = applyRunAction(newRun(seed), { type: 'chooseWarden', warden: 0 }).state;
  return continueRun(run, maxSteps, opts);
}

export function continueRun(start: RunState, maxSteps = 5000, opts: RunOptions = {}): { state: RunState; steps: number; actions: RunAction[] } {
  let run = start;
  let rng = run.rng.bot;
  const actions: RunAction[] = [];
  let steps = 0;
  while (run.phase !== 'over' && steps < maxSteps) {
    const [a, r] = botRunAction(run, rng, opts);
    rng = r;
    if (!a) break;
    run = applyRunAction(run, a, opts).state;
    actions.push(a);
    steps++;
  }
  return { state: run, steps, actions };
}
