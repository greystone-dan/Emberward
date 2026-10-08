import { FLAGS } from '../../config/flags';
import { cards, cardsById } from '../../content/cards';
import type { Rarity, Trait } from '../../content/types';
import { nextFloat, nextInt, type RngState } from '../rng';
import type { DriftCard, DriftState, RunCard, RunState } from './types';

/**
 * SPEC §5: the Drift. A seeded line of cards; the front ones are free, the rest cost 1✦ more per place.
 * Echoes are marked copies of owned cards; Omens make three traits appear 1.5× as often.
 */

const RARITY_PRICE: Record<Rarity, number> = { C: FLAGS.marketPrices.common, U: FLAGS.marketPrices.uncommon, R: FLAGS.marketPrices.rare };

export function cardPriceByRarity(r: Rarity): number {
  return RARITY_PRICE[r];
}

export function rollRarity(rng0: RngState, pity: number, minUncommon = false): [Rarity, RngState] {
  const odds = FLAGS.rarityOdds;
  const rare = odds.rare + pity * FLAGS.rarePityPerDrift;
  const [f, rng] = nextFloat(rng0);
  const r = f * 100;
  if (r < rare) return ['R', rng];
  if (minUncommon || r < rare + odds.uncommon) return ['U', rng];
  return ['C', rng];
}

/** Picks a card of a rarity, weighting Omen traits 1.5× and (for Echoes) owned cards. */
export function rollCard(rng0: RngState, rarity: Rarity, omens: Trait[], exclude: number[] = []): [number, RngState] {
  const pool = cards.filter((c) => c.rarity === rarity && !exclude.includes(c.id));
  const weights = pool.map((c) => (c.traits.some((t) => omens.includes(t)) ? FLAGS.omenWeight : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const [f, rng] = nextFloat(rng0);
  let r = f * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return [pool[i]!.id, rng];
  }
  return [pool[pool.length - 1]!.id, rng];
}

/** An Echo: a card the player already owns, 3× weight toward ones owned exactly twice. */
export function rollEcho(rng0: RngState, deck: RunCard[]): [number | null, RngState] {
  const counts = new Map<number, number>();
  for (const c of deck) if (c.level === 1) counts.set(c.cardId, (counts.get(c.cardId) ?? 0) + 1);
  const ids = [...counts.keys()];
  if (ids.length === 0) return [null, rng0];
  const weights = ids.map((id) => (counts.get(id) === 2 ? FLAGS.echoWeightOwnedTwice : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const [f, rng] = nextFloat(rng0);
  let r = f * total;
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return [ids[i]!, rng];
  }
  return [ids[ids.length - 1]!, rng];
}

export function rollDriftCard(rng0: RngState, run: Pick<RunState, 'deck' | 'omens' | 'relics'>, pity: number, opts: { echo?: boolean; minUncommon?: boolean } = {}): [DriftCard, RngState] {
  let rng = rng0;
  if (opts.echo) {
    const [id, r] = rollEcho(rng, run.deck);
    rng = r;
    if (id !== null) return [{ cardId: id, rarity: cardsById.get(id)!.rarity, echo: true }, rng];
  }
  const [rarity, r2] = rollRarity(rng, pity, opts.minUncommon);
  const [id, r3] = rollCard(r2, rarity, run.omens);
  return [{ cardId: id, rarity, echo: false }, r3];
}

/** Builds a fresh line of `size` cards; about one Drift in three carries an Echo (always with Echo Shell). */
export function newLine(rng0: RngState, run: Pick<RunState, 'deck' | 'omens' | 'relics'>, size: number, pity: number, minUncommon = false): [DriftCard[], RngState] {
  let rng = rng0;
  const [echoRoll, r1] = nextFloat(rng);
  rng = r1;
  const wantEcho = run.relics.includes('Echo Shell') || echoRoll < FLAGS.echoChance;
  let echoSlot = -1;
  if (wantEcho) [echoSlot, rng] = nextInt(rng, size);
  const line: DriftCard[] = [];
  for (let i = 0; i < size; i++) {
    let c: DriftCard;
    [c, rng] = rollDriftCard(rng, run, pity, { echo: i === echoSlot, minUncommon });
    line.push(c);
  }
  void echoRoll;
  return [line, rng];
}

/** How many free slots at the front. */
export function freeSlots(run: Pick<RunState, 'relics' | 'deck'>, pilgrim4 = false): number {
  let free: number = FLAGS.driftFree;
  if (run.relics.includes('Long Wick')) free = Math.max(free, 3);
  if (pilgrim4) free = Math.max(free, 3);
  return free;
}

/** The price of the card at `slot` (0 = front). */
export function driftPrice(run: Pick<RunState, 'relics' | 'deck' | 'drift'>, slot: number, opts: { kindler3?: boolean; pilgrim4?: boolean } = {}): number {
  const free = freeSlots(run, opts.pilgrim4);
  if (slot < free) return 0;
  let price = (slot - free + 1) * FLAGS.driftStepCost;
  if (run.drift.doubled) price *= 2;
  if (run.relics.includes("Ferryman's Pole")) price -= 1;
  if (opts.kindler3) price -= 1;
  if (!run.drift.freeReachUsed && run.relics.includes('Coin for the Crossing')) return 0;
  return Math.max(0, price);
}

/** Advances the line by `n` places: the front n wash away, n incoming cards join the back. */
export function advanceLine(drift: DriftState, rng0: RngState, run: Pick<RunState, 'deck' | 'omens' | 'relics'>, n: number): [DriftState, RngState] {
  let rng = rng0;
  const line = drift.line.slice(n);
  const incoming = [...drift.incoming];
  while (line.length < FLAGS.driftSize) {
    let c = incoming.shift();
    if (!c) [c, rng] = rollDriftCard(rng, run, drift.pity);
    line.push(c);
  }
  while (incoming.length < n) {
    let c: DriftCard;
    [c, rng] = rollDriftCard(rng, run, drift.pity);
    incoming.push(c);
  }
  return [{ ...drift, line, incoming }, rng];
}

/** What the next node's Drift will look like (SPEC: the player sees it before choosing a path). */
export function previewNextLine(drift: DriftState): DriftCard[] {
  const n = FLAGS.driftAdvancePerNode;
  return [...drift.line.slice(n), ...drift.incoming].slice(0, FLAGS.driftSize);
}
