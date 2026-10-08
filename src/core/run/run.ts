import { FLAGS } from '../../config/flags';
import { cards, cardsById, content } from '../../content/cards';
import { ORIGINS, TRAITS, type Rarity, type Trait } from '../../content/types';
import { applyAction, newBattle, type BattleConfig, type BattleSideConfig } from '../battle/battle';
import { cardKey } from '../battle/defs';
import { makeRng, nextInt } from '../rng';
import type { Level } from '../types';
import { advanceLine, cardPriceByRarity, driftPrice, newLine, rollDriftCard } from './drift';
import { bossConfig, eliteConfig, eliteRule, fightConfig } from './encounters';
import { generateMap, reachable } from './map';
import type { BattleResult, DriftCard, MapNode, MarketState, RekindleOffer, RunAction, RunCard, RunEvent, RunResult, RunState } from './types';

/**
 * The run loop (SPEC §11, §5, §4.0, §10). `applyRunAction` clones, mutates the clone and returns it with
 * events. Battle actions are forwarded to `applyAction`; the battle's final state settles the run.
 */

export function newRun(seed: string): RunState {
  return {
    seed,
    rng: { map: makeRng(seed, 'map'), drift: makeRng(seed, 'drift'), market: makeRng(seed, 'market'), shrine: makeRng(seed, 'shrine'), omens: makeRng(seed, 'omens'), bot: makeRng(seed, 'bot') },
    phase: 'wardenSelect',
    warden: -1,
    wardenName: '',
    hp: FLAGS.playerHp,
    maxHp: FLAGS.playerHp,
    embers: FLAGS.startEmbers,
    deck: [],
    nextUid: 1,
    relics: [],
    sigils: 0,
    omens: [],
    map: [],
    at: -1,
    visited: [],
    scouted: [],
    drift: { line: [], incoming: [], takes: 0, open: false, doubled: false, freeReachUsed: false, pity: 0 },
    market: null,
    muster: [],
    battleConfig: null,
    battle: null,
    result: null,
    rekindle: [],
    rekindlePostponed: false,
    persist: [],
    nextEnemyStunned: false,
    nextFightSkipped: false,
    shrine: null,
    hearthUsed: false,
    won: null,
    battlesWon: 0,
    turnsTaken: 0,
    log: [],
    errors: [],
  };
}

export interface RunOptions {
  /** The Sexton is playable (unlocked after a first win). */
  sextonUnlocked?: boolean;
}

// ---------- helpers ----------

function note(ev: RunEvent[], run: RunState, text: string): void {
  run.log.push(text);
  if (run.log.length > 300) run.log.splice(0, run.log.length - 300);
  void ev;
}

function fail(run: RunState, events: RunEvent[], reason: string): RunResult {
  run.errors.push(`ILLEGAL_RUN_ACTION ${reason}`);
  events.push({ type: 'error', message: reason });
  return { state: run, events };
}

function addCard(run: RunState, cardId: number, level: Level = 1): RunCard {
  const c: RunCard = { uid: run.nextUid++, cardId, level };
  run.deck.push(c);
  return c;
}

export function cardName(cardId: number): string {
  return cardsById.get(cardId)?.name ?? `#${cardId}`;
}

/** Distinct cards in the deck carrying a trait (Sigils count). */
export function deckTraitCount(deck: RunCard[], trait: Trait): number {
  const ids = new Set<number>();
  for (const c of deck) {
    const def = cardsById.get(c.cardId);
    if (!def) continue;
    if (def.traits.includes(trait) || c.sigil === trait) ids.add(c.cardId);
  }
  return ids.size;
}

function deckHasTier(deck: RunCard[], trait: Trait, n: number): boolean {
  return deckTraitCount(deck, trait) >= n;
}

export function priceAt(run: RunState, slot: number): number {
  return driftPrice(run, slot, { kindler3: deckHasTier(run.deck, 'Kindler', 3), pilgrim4: deckHasTier(run.deck, 'Pilgrim', 4) });
}

function interestFor(run: RunState): number {
  let cap: number = FLAGS.interestCap;
  if (run.relics.includes('Coin for the Crossing')) cap += 1;
  if (run.relics.includes("Miser's Wick")) cap += 3;
  return Math.min(cap, Math.floor(run.embers / FLAGS.interestPer));
}

/** Rekindle offers: groups of copies large enough to merge. */
export function rekindleOffers(run: RunState): RekindleOffer[] {
  const groups = new Map<string, RekindleOffer>();
  for (const c of run.deck) {
    if (c.level >= 3 || (c.level === 2 && !FLAGS.fireExists)) continue;
    const k = `${c.cardId}@${c.level}`;
    const g = groups.get(k) ?? { cardId: c.cardId, level: c.level, copies: 0 };
    g.copies++;
    groups.set(k, g);
  }
  const out: RekindleOffer[] = [];
  for (const g of groups.values()) {
    const def = cardsById.get(g.cardId);
    const need = run.relics.includes('Twin Lantern') && def?.rarity === 'C' && g.level === 1 ? 2 : FLAGS.rekindleCopies;
    if (g.copies >= need) out.push(g);
  }
  return out.sort((a, b) => a.cardId - b.cardId || a.level - b.level);
}

function refreshRekindle(run: RunState): void {
  run.rekindle = rekindleOffers(run);
  if (run.rekindle.length === 0) run.rekindlePostponed = false;
}

function doRekindle(run: RunState, events: RunEvent[], cardId: number, level: Level): boolean {
  const def = cardsById.get(cardId);
  const need = run.relics.includes('Twin Lantern') && def?.rarity === 'C' && level === 1 ? 2 : FLAGS.rekindleCopies;
  const copies = run.deck.filter((c) => c.cardId === cardId && c.level === level);
  if (copies.length < need) return false;
  // Merge the plainest copies first so a Sigil or Temper survives on the result.
  const sorted = [...copies].sort((a, b) => (a.sigil ? 1 : 0) + (a.temper ?? 0) - ((b.sigil ? 1 : 0) + (b.temper ?? 0)));
  const used = sorted.slice(0, need);
  const keep = used[used.length - 1]!;
  run.deck = run.deck.filter((c) => !used.includes(c));
  run.deck.push({ uid: run.nextUid++, cardId, level: (level + 1) as Level, sigil: used.find((c) => c.sigil)?.sigil, temper: keep.temper });
  events.push({ type: 'rekindle', cardId, level: (level + 1) as Level });
  note(events, run, `${cardName(cardId)} rekindles into a ${level + 1 === 2 ? 'Flame' : 'Fire'}.`);
  return true;
}

function openDrift(run: RunState, size: number, takes: number, minUncommon = false): void {
  const [line, rng] = newLine(run.rng.drift, run, size, run.drift.pity, minUncommon);
  run.rng.drift = rng;
  run.drift = { ...run.drift, line, takes, open: true, freeReachUsed: false, doubled: run.drift.doubled };
  if (run.drift.incoming.length === 0) {
    const incoming: DriftCard[] = [];
    let r = run.rng.drift;
    for (let i = 0; i < FLAGS.driftAdvancePerNode; i++) {
      let c: DriftCard;
      [c, r] = rollDriftCard(r, run, run.drift.pity);
      incoming.push(c);
    }
    run.rng.drift = r;
    run.drift.incoming = incoming;
  }
}

function closeDrift(run: RunState): void {
  if (!run.drift.open) return;
  const sawRare = run.drift.line.some((c) => c.rarity === 'R');
  run.drift.pity = sawRare ? 0 : run.drift.pity + 1;
  run.drift.open = false;
  run.drift.takes = 0;
  run.drift.doubled = false;
}

function advanceDrift(run: RunState): void {
  const [d, rng] = advanceLine(run.drift, run.rng.drift, run, FLAGS.driftAdvancePerNode);
  run.rng.drift = rng;
  d.line = d.line.slice(0, FLAGS.driftSize);
  run.drift = d;
}

function randomRelic(run: RunState, stream: 'market' | 'shrine' | 'drift'): string | null {
  const pool = content.relics.filter((r) => !run.relics.includes(r.name));
  if (pool.length === 0) return null;
  const [i, rng] = nextInt(run.rng[stream], pool.length);
  run.rng[stream] = rng;
  return pool[i]!.name;
}

function buildMarket(run: RunState): MarketState {
  let rng = run.rng.market;
  const cardsOut: (DriftCard | null)[] = [];
  const prices: number[] = [];
  const [echoSlot, r0] = nextInt(rng, 4);
  rng = r0;
  for (let i = 0; i < 4; i++) {
    if (i === 0 && run.market?.held) {
      cardsOut.push(run.market.held);
      prices.push(cardPriceByRarity(run.market.held.rarity));
      continue;
    }
    let c: DriftCard;
    [c, rng] = rollDriftCard(rng, run, 0, { echo: i === echoSlot });
    cardsOut.push(c);
    prices.push(cardPriceByRarity(c.rarity));
  }
  run.rng.market = rng;
  const relic = randomRelic(run, 'market');
  const relicPrice = relic ? ({ Common: 6, Uncommon: 9, Rare: 12 } as Record<string, number>)[content.relics.find((r) => r.name === relic)!.rarity]! : 0;
  return { cards: cardsOut, cardPrices: prices, relic, relicPrice, sigil: true, rerolls: 0, held: null };
}

function playerSide(run: RunState): BattleSideConfig {
  const chosen = run.deck.filter((c) => run.muster.includes(c.uid));
  return {
    hp: run.hp,
    embers: run.embers,
    cards: chosen.map((c) => ({ key: cardKey(c.cardId), level: c.level, sigil: c.sigil, temper: c.temper })),
    relics: [...run.relics],
    wardenName: run.wardenName,
    board: run.persist.map((p) => ({ key: p.key, level: p.level, lane: p.lane as 0 | 1 | 2 | 3, row: p.row as 0 | 1 | 2 })),
  };
}

function enemyFor(run: RunState, node: MapNode): { cfg: BattleConfig; name: string } {
  const seed = `${run.seed}:battle:${run.visited.length}:${node.id}`;
  const player = playerSide(run);
  if (node.type === 'boss') return { cfg: { seed, kind: 'boss', player, enemy: bossConfig(), boss: true }, name: content.boss.name };
  if (node.type === 'elite') {
    const enemy = eliteConfig(node.encounter);
    return { cfg: { seed, kind: 'elite', player, enemy, elite: eliteRule(node.encounter) }, name: enemy.wardenName ?? 'Elite' };
  }
  const enemy = fightConfig(node.encounter);
  if (run.nextEnemyStunned) enemy.startStunned = true;
  return { cfg: { seed, kind: 'fight', player, enemy }, name: enemy.wardenName ?? 'Fight' };
}

function defaultMuster(run: RunState): number[] {
  // Levelled cards first, then by rarity, so the default is a sensible pick a player can edit.
  const rank: Record<Rarity, number> = { R: 0, U: 1, C: 2 };
  return [...run.deck]
    .sort((a, b) => b.level - a.level || rank[cardsById.get(a.cardId)!.rarity] - rank[cardsById.get(b.cardId)!.rarity] || a.uid - b.uid)
    .slice(0, FLAGS.musterLimit)
    .map((c) => c.uid);
}

function enterNode(run: RunState, events: RunEvent[], node: MapNode): void {
  run.at = node.id;
  run.visited.push(node.id);
  events.push({ type: 'node', node });
  run.hearthUsed = false;
  switch (node.type) {
    case 'fight':
      if (run.nextFightSkipped) {
        run.nextFightSkipped = false;
        const interest = interestFor(run);
        run.embers += interest + FLAGS.battlePay.fight;
        note(events, run, `The boatman's toll: the fight at ${nodeName(node)} is skipped. +${interest + FLAGS.battlePay.fight}✦.`);
        events.push({ type: 'embers', delta: interest + FLAGS.battlePay.fight, reason: 'ferry toll' });
        openDrift(run, FLAGS.driftSize, FLAGS.driftTakes);
        run.phase = 'drift';
        return;
      }
      run.muster = defaultMuster(run);
      run.phase = 'muster';
      return;
    case 'elite':
    case 'boss':
      run.muster = defaultMuster(run);
      run.phase = 'muster';
      return;
    case 'market':
      run.market = buildMarket(run);
      run.rekindlePostponed = false;
      run.phase = 'market';
      return;
    case 'hearth':
      run.rekindlePostponed = false;
      run.phase = 'hearth';
      return;
    case 'shrine':
      run.shrine = { event: node.encounter, chosen: null };
      run.phase = 'shrine';
      return;
    case 'scout': {
      // Reveal the next three fights ahead on any path.
      const names: string[] = [];
      let frontier = [...node.next];
      const seen = new Set<number>();
      while (frontier.length && names.length < 3) {
        const nextFrontier: number[] = [];
        for (const id of frontier) {
          if (seen.has(id)) continue;
          seen.add(id);
          const n = run.map[id]!;
          if ((n.type === 'fight' || n.type === 'elite' || n.type === 'boss') && !run.scouted.includes(id) && names.length < 3) {
            run.scouted.push(id);
            names.push(encounterName(n));
          }
          nextFrontier.push(...n.next);
        }
        frontier = nextFrontier;
      }
      events.push({ type: 'scout', names });
      note(events, run, names.length ? `Scouted: ${names.join(', ')}.` : 'Nothing ahead to scout.');
      run.phase = 'scout';
      return;
    }
  }
}

export function encounterName(n: MapNode): string {
  if (n.type === 'fight') return content.fights[n.encounter]?.name ?? 'Fight';
  if (n.type === 'elite') return content.elites[n.encounter]?.name ?? 'Elite';
  if (n.type === 'boss') return content.boss.name;
  return n.type;
}

export function nodeName(n: MapNode): string {
  return `row ${n.y + 1}`;
}

function resolveBattle(run: RunState, events: RunEvent[]): void {
  const b = run.battle!;
  const cfg = run.battleConfig!;
  const kind = cfg.kind ?? 'fight';
  const me = b.sides[0];
  const won = b.winner === 0;
  let hp = me.hp;
  const embers = Math.max(0, me.embers - Math.min(me.pouchEmbers, me.embers));
  if (b.outcome === 'waveLimit' && !won) {
    // SPEC §9: the player takes the face-damage difference and gets half embers.
    const diff = Math.max(0, b.sides[1].faceDamageDealt - me.faceDamageDealt);
    hp -= diff;
  }
  const hpLost = run.hp - hp;
  run.hp = hp;
  run.embers = embers;
  let interest = 0;
  let pay = 0;
  if (won) {
    interest = interestFor(run);
    pay = FLAGS.battlePay[kind];
  } else if (b.outcome === 'waveLimit') {
    pay = Math.floor(FLAGS.battlePay[kind] / 2);
  }
  run.embers += interest + pay;
  const survivors = b.units.filter((u) => u.side === 0 && !u.token).map((u) => ({ key: u.key, level: u.level, lane: u.lane, row: u.row, cardUid: u.cardUid, name: u.name }));
  const result: BattleResult = { kind, won, outcome: b.outcome ?? 'kill', hpLost, pay, interest, survivors };
  if (won && kind === 'elite') {
    const relic = randomRelic(run, 'drift');
    if (relic) {
      run.relics.push(relic);
      result.relic = relic;
      events.push({ type: 'relic', name: relic });
    }
    run.sigils += 1;
    result.sigil = true;
  }
  if (won) run.battlesWon++;
  run.result = result;
  run.persist = [];
  run.nextEnemyStunned = false;
  events.push({ type: 'battleEnd', result });
  note(events, run, won ? `Victory against ${cfg.enemy.wardenName}. +${pay}✦ pay, +${interest}✦ interest.` : b.outcome === 'waveLimit' ? `The enemy retreats after six waves; you lose ${hpLost} health and take half pay.` : 'Your Warden falls.');
  run.battle = null;
  run.phase = 'reward';
  if (run.hp <= 0) {
    run.hp = 0;
    run.won = false;
    run.phase = 'over';
    events.push({ type: 'runOver', won: false });
    note(events, run, 'The light goes out.');
  } else if (won && kind === 'boss') {
    run.won = true;
    run.phase = 'over';
    events.push({ type: 'runOver', won: true });
    note(events, run, 'The Lamplighter Who Drowned is still. The light holds.');
  } else if (kind === 'boss') {
    // The boss does not retreat: surviving six waves without winning them still ends the run (DECISIONS.md).
    run.won = false;
    run.phase = 'over';
    events.push({ type: 'runOver', won: false });
    note(events, run, 'The dark closes over the stair. The light goes out.');
  }
}

function sellPrice(run: RunState, c: RunCard): number {
  const def = cardsById.get(c.cardId)!;
  const full = cardPriceByRarity(def.rarity) * c.level;
  return run.relics.includes('Snuffer') ? full : Math.floor(full / 2);
}

export function canInscribe(c: RunCard, trait: Trait): boolean {
  const def = cardsById.get(c.cardId);
  if (!def || c.sigil) return false;
  if (def.traits.includes(trait)) return false;
  if (def.traits.includes('Abyssal') && (ORIGINS as readonly string[]).includes(trait)) return false;
  return (TRAITS as readonly string[]).includes(trait);
}

// ---------- the mutator ----------

export function applyRunAction(input: RunState, action: RunAction, opts: RunOptions = {}): RunResult {
  const run = structuredClone(input);
  const events: RunEvent[] = [];
  run.turnsTaken++;
  if (run.phase === 'over') return fail(run, events, 'RUN_OVER');

  switch (action.type) {
    case 'chooseWarden': {
      if (run.phase !== 'wardenSelect') return fail(run, events, 'NOT_WARDEN_SELECT');
      const w = content.wardens[action.warden];
      if (!w) return fail(run, events, 'NO_SUCH_WARDEN');
      if (w.locked && !opts.sextonUnlocked) return fail(run, events, 'WARDEN_LOCKED');
      run.warden = action.warden;
      run.wardenName = w.name;
      for (const id of w.deck) addCard(run, id, 1);
      const relicName = w.relic.split(':')[0]!.trim();
      run.relics.push(relicName);
      // Omens: three traits wax this act.
      let r = run.rng.omens;
      const pool = [...TRAITS];
      while (run.omens.length < 3 && pool.length) {
        let i: number;
        [i, r] = nextInt(r, pool.length);
        run.omens.push(pool.splice(i, 1)[0]!);
      }
      run.rng.omens = r;
      const m = generateMap(run.rng.map);
      run.map = m.nodes;
      run.rng.map = m.rng;
      events.push({ type: 'warden', name: w.name });
      note(events, run, `${w.name} takes up the lantern. Omens: ${run.omens.join(', ')}.`);
      openDrift(run, FLAGS.openingDriftSize, FLAGS.openingDriftTakes);
      run.phase = 'drift';
      return { state: run, events };
    }
    case 'driftTake': {
      if (run.phase !== 'drift' || !run.drift.open) return fail(run, events, 'NO_DRIFT');
      if (run.drift.takes <= 0) return fail(run, events, 'NO_TAKES_LEFT');
      const card = run.drift.line[action.slot];
      if (!card) return fail(run, events, 'NO_SUCH_SLOT');
      const price = priceAt(run, action.slot);
      if (price > run.embers) return fail(run, events, 'NOT_ENOUGH_EMBERS');
      if (action.slot >= FLAGS.driftFree && price === 0 && run.relics.includes('Coin for the Crossing')) run.drift.freeReachUsed = true;
      run.embers -= price;
      run.drift.line.splice(action.slot, 1);
      run.drift.takes--;
      addCard(run, card.cardId, 1);
      events.push({ type: 'draft', cardId: card.cardId, price, echo: card.echo });
      if (price) events.push({ type: 'embers', delta: -price, reason: 'reach' });
      note(events, run, `Took ${cardName(card.cardId)}${card.echo ? ' (Echo)' : ''}${price ? ` for ${price}✦` : ''}.`);
      refreshRekindle(run);
      if (run.drift.takes === 0) {
        closeDrift(run);
        run.phase = 'map';
      }
      return { state: run, events };
    }
    case 'driftSkip': {
      if (run.phase !== 'drift' || !run.drift.open) return fail(run, events, 'NO_DRIFT');
      run.embers += FLAGS.driftSkipReward;
      events.push({ type: 'skipDrift', embers: FLAGS.driftSkipReward });
      note(events, run, `Let the Drift pass: +${FLAGS.driftSkipReward}✦.`);
      closeDrift(run);
      run.phase = 'map';
      return { state: run, events };
    }
    case 'driftDone': {
      if (run.phase !== 'drift') return fail(run, events, 'NO_DRIFT');
      closeDrift(run);
      run.phase = 'map';
      return { state: run, events };
    }
    case 'mapChoose': {
      if (run.phase !== 'map') return fail(run, events, 'NOT_ON_MAP');
      if (!reachable(run.map, run.at).includes(action.node)) return fail(run, events, 'NOT_REACHABLE');
      const node = run.map[action.node]!;
      if (run.at >= 0) advanceDrift(run);
      enterNode(run, events, node);
      return { state: run, events };
    }
    case 'musterSet': {
      if (run.phase !== 'muster') return fail(run, events, 'NOT_MUSTER');
      const uids = [...new Set(action.uids)].filter((u) => run.deck.some((c) => c.uid === u));
      if (uids.length > FLAGS.musterLimit) return fail(run, events, 'MUSTER_TOO_BIG');
      run.muster = uids;
      return { state: run, events };
    }
    case 'musterConfirm': {
      if (run.phase !== 'muster') return fail(run, events, 'NOT_MUSTER');
      if (run.muster.length === 0) return fail(run, events, 'MUSTER_EMPTY');
      const node = run.map[run.at]!;
      const { cfg, name } = enemyFor(run, node);
      run.battleConfig = cfg;
      run.battle = newBattle(cfg).state;
      run.phase = 'battle';
      events.push({ type: 'battleStart', kind: cfg.kind ?? 'fight', name });
      note(events, run, `Battle: ${name}.`);
      return { state: run, events };
    }
    case 'battle': {
      if (run.phase !== 'battle' || !run.battle) return fail(run, events, 'NOT_IN_BATTLE');
      const r = applyAction(run.battle, action.action);
      run.battle = r.state;
      if (r.state.phase === 'over') resolveBattle(run, events);
      return { state: run, events };
    }
    case 'persistChoose': {
      if (run.phase !== 'reward' || !run.result) return fail(run, events, 'NOT_REWARD');
      if (!run.relics.includes('Anchorstone')) return fail(run, events, 'NO_ANCHORSTONE');
      const s = run.result.survivors[action.index];
      if (!s) return fail(run, events, 'NO_SUCH_SURVIVOR');
      run.result.persisted = { key: s.key, level: s.level, lane: s.lane, row: s.row };
      run.persist = [run.result.persisted];
      note(events, run, `${s.name} persists into the next battle.`);
      return { state: run, events };
    }
    case 'continue': {
      if (run.phase !== 'reward' || !run.result) return fail(run, events, 'NOT_REWARD');
      const res = run.result;
      run.result = null;
      if (res.won) {
        const elite = res.kind === 'elite';
        openDrift(run, FLAGS.driftSize, elite ? FLAGS.driftTakesAfterElite : FLAGS.driftTakes, elite);
        run.phase = 'drift';
      } else {
        run.phase = 'map';
      }
      refreshRekindle(run);
      return { state: run, events };
    }
    case 'marketBuy': {
      if (run.phase !== 'market' || !run.market) return fail(run, events, 'NOT_MARKET');
      const c = run.market.cards[action.slot];
      const price = run.market.cardPrices[action.slot] ?? 0;
      if (!c) return fail(run, events, 'EMPTY_SLOT');
      if (price > run.embers) return fail(run, events, 'NOT_ENOUGH_EMBERS');
      run.embers -= price;
      run.market.cards[action.slot] = null;
      addCard(run, c.cardId, 1);
      events.push({ type: 'buy', cardId: c.cardId, price });
      note(events, run, `Bought ${cardName(c.cardId)} for ${price}✦.`);
      refreshRekindle(run);
      return { state: run, events };
    }
    case 'marketBuyRelic': {
      if (run.phase !== 'market' || !run.market || !run.market.relic) return fail(run, events, 'NO_RELIC');
      if (run.market.relicPrice > run.embers) return fail(run, events, 'NOT_ENOUGH_EMBERS');
      run.embers -= run.market.relicPrice;
      run.relics.push(run.market.relic);
      events.push({ type: 'relic', name: run.market.relic });
      note(events, run, `Bought the relic ${run.market.relic}.`);
      run.market.relic = null;
      refreshRekindle(run);
      return { state: run, events };
    }
    case 'marketBuySigil': {
      if (run.phase !== 'market' || !run.market || !run.market.sigil) return fail(run, events, 'NO_SIGIL');
      if (FLAGS.sigilPrice > run.embers) return fail(run, events, 'NOT_ENOUGH_EMBERS');
      run.embers -= FLAGS.sigilPrice;
      run.market.sigil = false;
      run.sigils++;
      note(events, run, 'Bought a Sigil.');
      return { state: run, events };
    }
    case 'marketReroll': {
      if (run.phase !== 'market' || !run.market) return fail(run, events, 'NOT_MARKET');
      const cost = FLAGS.rerollBase + run.market.rerolls;
      if (cost > run.embers) return fail(run, events, 'NOT_ENOUGH_EMBERS');
      run.embers -= cost;
      const held = run.market.held;
      const rerolls = run.market.rerolls + 1;
      run.market = { ...buildMarket({ ...run, market: null }), held, rerolls, sigil: run.market.sigil };
      note(events, run, `Rerolled the market for ${cost}✦.`);
      return { state: run, events };
    }
    case 'marketHold': {
      if (run.phase !== 'market' || !run.market) return fail(run, events, 'NOT_MARKET');
      const c = run.market.cards[action.slot];
      if (!c) return fail(run, events, 'EMPTY_SLOT');
      run.market.held = c;
      run.market.cards[action.slot] = null;
      note(events, run, `${cardName(c.cardId)} is held for the next market.`);
      return { state: run, events };
    }
    case 'sell': {
      if (run.phase !== 'market') return fail(run, events, 'NOT_MARKET');
      const c = run.deck.find((x) => x.uid === action.uid);
      if (!c) return fail(run, events, 'NO_SUCH_CARD');
      if (run.deck.length <= 1) return fail(run, events, 'LAST_CARD');
      const price = sellPrice(run, c);
      run.deck = run.deck.filter((x) => x.uid !== action.uid);
      run.embers += price;
      events.push({ type: 'sell', cardId: c.cardId, price });
      note(events, run, `Sold ${cardName(c.cardId)} for ${price}✦.`);
      refreshRekindle(run);
      return { state: run, events };
    }
    case 'inscribe': {
      if (run.phase === 'battle') return fail(run, events, 'IN_BATTLE');
      if (run.sigils <= 0) return fail(run, events, 'NO_SIGILS');
      const c = run.deck.find((x) => x.uid === action.uid);
      if (!c || !canInscribe(c, action.trait)) return fail(run, events, 'BAD_SIGIL');
      c.sigil = action.trait;
      run.sigils--;
      events.push({ type: 'sigil', cardId: c.cardId, trait: action.trait });
      note(events, run, `${cardName(c.cardId)} now carries the ${action.trait} Sigil.`);
      return { state: run, events };
    }
    case 'hearthHeal': {
      if (run.phase !== 'hearth' || run.hearthUsed) return fail(run, events, 'NOT_HEARTH');
      const heal = Math.min(run.maxHp - run.hp, Math.ceil(run.maxHp * FLAGS.hearthHealFraction));
      run.hp += heal;
      run.hearthUsed = true;
      events.push({ type: 'hp', delta: heal, reason: 'hearth' });
      note(events, run, `Rested at the Hearth: +${heal} health.`);
      return { state: run, events };
    }
    case 'hearthSnuff': {
      if (run.phase !== 'hearth' || run.hearthUsed) return fail(run, events, 'NOT_HEARTH');
      const c = run.deck.find((x) => x.uid === action.uid);
      if (!c || run.deck.length <= 1) return fail(run, events, 'NO_SUCH_CARD');
      run.deck = run.deck.filter((x) => x.uid !== action.uid);
      run.hearthUsed = true;
      events.push({ type: 'remove', cardId: c.cardId });
      note(events, run, `Snuffed ${cardName(c.cardId)}.`);
      refreshRekindle(run);
      return { state: run, events };
    }
    case 'hearthTemper': {
      if (run.phase !== 'hearth' || run.hearthUsed) return fail(run, events, 'NOT_HEARTH');
      const c = run.deck.find((x) => x.uid === action.uid);
      if (!c) return fail(run, events, 'NO_SUCH_CARD');
      c.temper = (c.temper ?? 0) + 1;
      run.hearthUsed = true;
      events.push({ type: 'temper', cardId: c.cardId });
      note(events, run, `Tempered ${cardName(c.cardId)}: +1/+1 for the run.`);
      return { state: run, events };
    }
    case 'shrineChoose': {
      if (run.phase !== 'shrine' || !run.shrine || run.shrine.chosen !== null) return fail(run, events, 'NOT_SHRINE');
      const ev = content.events[run.shrine.event]!;
      const opt = ev.options[action.option];
      if (!opt) return fail(run, events, 'NO_SUCH_OPTION');
      run.shrine.chosen = action.option;
      events.push({ type: 'shrine', event: ev.name, option: opt });
      note(events, run, `${ev.name}: ${opt}`);
      applyShrine(run, events, run.shrine.event, action.option);
      return { state: run, events };
    }
    case 'shrinePick': {
      if (run.phase !== 'shrine' || !run.shrine?.needsPick) return fail(run, events, 'NO_PICK');
      const c = run.deck.find((x) => x.uid === action.uid);
      if (!c) return fail(run, events, 'NO_SUCH_CARD');
      const kind = run.shrine.needsPick;
      run.shrine.needsPick = undefined;
      if (kind === 'remove') {
        if (run.deck.length <= 1) return fail(run, events, 'LAST_CARD');
        run.deck = run.deck.filter((x) => x.uid !== c.uid);
        events.push({ type: 'remove', cardId: c.cardId });
        note(events, run, `Silenced: ${cardName(c.cardId)} leaves the deck.`);
      } else if (kind === 'duplicate') {
        addCard(run, c.cardId, c.level);
        run.hp -= 12;
        events.push({ type: 'hp', delta: -12, reason: 'reflection' });
        note(events, run, `A second ${cardName(c.cardId)} climbs out of the pool. You lose 12 health.`);
      } else if (kind === 'rekindle') {
        // Choir of the Sunk: a card owned twice rekindles now.
        const copies = run.deck.filter((x) => x.cardId === c.cardId && x.level === c.level);
        if (copies.length < 2) return fail(run, events, 'NEED_TWO');
        const [a, b] = copies;
        run.deck = run.deck.filter((x) => x !== a && x !== b);
        run.deck.push({ uid: run.nextUid++, cardId: c.cardId, level: Math.min(3, c.level + 1) as Level, sigil: a!.sigil ?? b!.sigil, temper: a!.temper });
        events.push({ type: 'rekindle', cardId: c.cardId, level: Math.min(3, c.level + 1) as Level });
        note(events, run, `The choir sings ${cardName(c.cardId)} into a brighter flame.`);
      }
      refreshRekindle(run);
      checkDeath(run, events);
      return { state: run, events };
    }
    case 'rekindle': {
      if (run.phase === 'battle') return fail(run, events, 'IN_BATTLE');
      if (!doRekindle(run, events, action.cardId, action.level)) return fail(run, events, 'CANNOT_REKINDLE');
      refreshRekindle(run);
      return { state: run, events };
    }
    case 'postponeRekindle': {
      run.rekindlePostponed = true;
      return { state: run, events };
    }
    case 'leave': {
      if (run.phase === 'market' || run.phase === 'hearth' || run.phase === 'scout') {
        run.phase = 'map';
        return { state: run, events };
      }
      if (run.phase === 'shrine') {
        if (run.shrine?.needsPick) return fail(run, events, 'PICK_FIRST');
        if (run.shrine?.chosen === null) return fail(run, events, 'CHOOSE_FIRST');
        run.shrine = null;
        if (run.phase === 'shrine') run.phase = 'map';
        return { state: run, events };
      }
      return fail(run, events, 'NOTHING_TO_LEAVE');
    }
  }
}

function checkDeath(run: RunState, events: RunEvent[]): void {
  if (run.hp <= 0 && run.phase !== 'over') {
    run.hp = 0;
    run.won = false;
    run.phase = 'over';
    events.push({ type: 'runOver', won: false });
    note(events, run, 'The light goes out.');
  }
}

/** Shrine outcomes (content/cards.json → events). Options needing a card choice set `needsPick`. */
function applyShrine(run: RunState, events: RunEvent[], event: number, option: number): void {
  const name = content.events[event]!.name;
  switch (name) {
    case 'The Drowned Bell':
      if (option === 0) {
        const pool = cards.filter((c) => c.traits.includes('Bellforged'));
        const [i, rng] = nextInt(run.rng.shrine, pool.length);
        run.rng.shrine = rng;
        addCard(run, pool[i]!.id, 1);
        run.hp -= 6;
        events.push({ type: 'hp', delta: -6, reason: 'dive' });
        note(events, run, `You surface with ${pool[i]!.name}, and 6 health poorer.`);
      } else if (option === 1) run.nextEnemyStunned = true;
      break;
    case "A Lantern-Seller's Corpse":
      if (option === 0) {
        run.embers += 8;
        events.push({ type: 'embers', delta: 8, reason: 'oil' });
      } else if (option === 1) {
        if (!run.relics.includes('Long Wick')) run.relics.push('Long Wick');
        run.drift.doubled = true;
        events.push({ type: 'relic', name: 'Long Wick' });
      } else {
        const heal = Math.min(10, run.maxHp - run.hp);
        run.hp += heal;
        events.push({ type: 'hp', delta: heal, reason: 'burial' });
      }
      break;
    case 'Choir of the Sunk':
      if (option === 0) {
        const hasPair = run.deck.some((c) => run.deck.filter((x) => x.cardId === c.cardId && x.level === c.level).length >= 2);
        if (hasPair) run.shrine!.needsPick = 'rekindle';
        else note(events, run, 'You own no two of a kind; the song fades.');
      } else if (option === 1) run.shrine!.needsPick = 'remove';
      break;
    case 'The Ferry Toll':
      if (option === 0) {
        if (run.embers >= 5) {
          run.embers -= 5;
          run.nextFightSkipped = true;
          events.push({ type: 'embers', delta: -5, reason: 'toll' });
        } else note(events, run, 'You cannot pay; the boatman shrugs.');
      } else if (option === 1) {
        // An elite-strength fight right here, with an elite's reward.
        const [i, rng] = nextInt(run.rng.shrine, 3);
        run.rng.shrine = rng;
        const node = run.map[run.at]!;
        node.type = 'elite';
        node.encounter = i;
        run.shrine = null;
        run.muster = defaultMuster(run);
        run.phase = 'muster';
      }
      break;
    case 'Pool of Reflections':
      if (option === 0) {
        const front = run.deck[0];
        if (front) {
          addCard(run, front.cardId, 1);
          note(events, run, `An Echo of ${cardName(front.cardId)} rises from the pool.`);
        }
      } else if (option === 1) {
        run.embers += 3;
        events.push({ type: 'embers', delta: 3, reason: 'look away' });
      } else run.shrine!.needsPick = 'duplicate';
      break;
  }
  refreshRekindle(run);
  checkDeath(run, events);
}

/** Legal run actions in the current phase (for bots and tests). Battle actions are listed by the battle engine. */
export function legalRunActions(run: RunState, opts: RunOptions = {}): RunAction[] {
  const out: RunAction[] = [];
  switch (run.phase) {
    case 'wardenSelect':
      content.wardens.forEach((w, i) => {
        if (!w.locked || opts.sextonUnlocked) out.push({ type: 'chooseWarden', warden: i });
      });
      break;
    case 'drift':
      if (run.drift.open && run.drift.takes > 0) run.drift.line.forEach((_, i) => priceAt(run, i) <= run.embers && out.push({ type: 'driftTake', slot: i }));
      if (run.drift.open && run.drift.takes === FLAGS.driftTakes && run.drift.line.length === FLAGS.driftSize) out.push({ type: 'driftSkip' });
      out.push({ type: 'driftDone' });
      break;
    case 'map':
      for (const id of reachable(run.map, run.at)) out.push({ type: 'mapChoose', node: id });
      break;
    case 'muster':
      out.push({ type: 'musterConfirm' });
      break;
    case 'reward':
      if (run.relics.includes('Anchorstone') && run.result) run.result.survivors.forEach((_, i) => out.push({ type: 'persistChoose', index: i }));
      out.push({ type: 'continue' });
      break;
    case 'market':
      run.market?.cards.forEach((c, i) => c && (run.market!.cardPrices[i] ?? 0) <= run.embers && out.push({ type: 'marketBuy', slot: i }));
      if (run.market?.relic && run.market.relicPrice <= run.embers) out.push({ type: 'marketBuyRelic' });
      if (run.market?.sigil && FLAGS.sigilPrice <= run.embers) out.push({ type: 'marketBuySigil' });
      if (run.market && FLAGS.rerollBase + run.market.rerolls <= run.embers) out.push({ type: 'marketReroll' });
      out.push({ type: 'leave' });
      break;
    case 'hearth':
      if (!run.hearthUsed) {
        out.push({ type: 'hearthHeal' });
        for (const c of run.deck) out.push({ type: 'hearthTemper', uid: c.uid });
        if (run.deck.length > 1) for (const c of run.deck) out.push({ type: 'hearthSnuff', uid: c.uid });
      }
      out.push({ type: 'leave' });
      break;
    case 'shrine':
      if (run.shrine && run.shrine.chosen === null) content.events[run.shrine.event]!.options.forEach((_, i) => out.push({ type: 'shrineChoose', option: i }));
      else if (run.shrine?.needsPick) for (const c of run.deck) out.push({ type: 'shrinePick', uid: c.uid });
      else out.push({ type: 'leave' });
      break;
    case 'scout':
      out.push({ type: 'leave' });
      break;
    case 'battle':
    case 'over':
      break;
  }
  if (run.phase !== 'battle' && run.phase !== 'over') for (const r of run.rekindle) out.push({ type: 'rekindle', cardId: r.cardId, level: r.level });
  return out;
}
