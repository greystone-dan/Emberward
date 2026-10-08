import { FLAGS } from '../../config/flags';
import type { TargetSpec } from '../../content/effects/dsl';
import { makeRng, nextInt, type RngState } from '../rng';
import { cellsAround, emptyCells, other, unitAt, unitsOf } from '../grid';
import type { Action, ApplyResult, BattleCard, BattleEvent, BattleState, Cell, EliteRule, Lane, Level, Row, Side, SideState, Target, Unit } from '../types';
import { resolveClash, startWave } from './clash';
import { defFor } from './defs';
import { cond, type Ctx, err, gainEmbers, makeUnit, moveUnitTo, placeUnit, runOps, runTriggers, type Scope } from './engine';
import { hasRelic, hasTier, isRooted, swiftOf, unitTraits } from './stats';

/**
 * Battle setup and the single mutator. applyAction clones the state, mutates the clone and returns it
 * with the events that happened. Nothing here touches the input.
 */

export interface BattleSideConfig {
  hp: number;
  embers: number;
  /** Cards brought to the battle (after Muster). */
  cards: { key: string; level: Level; sigil?: import('../../content/types').Trait; temper?: number }[];
  relics?: string[];
  wardenName?: string;
  /** Units already on the board (Persist, elite signature units). */
  board?: { key: string; level?: Level; lane: Lane; row: Row }[];
}

export interface BattleConfig {
  seed: string;
  kind?: 'fight' | 'elite' | 'boss';
  player: BattleSideConfig;
  enemy: BattleSideConfig;
  elite?: EliteRule;
  boss?: boolean;
}

function sideState(cfg: BattleSideConfig, uidBase: number): SideState {
  const cards: BattleCard[] = cfg.cards.map((c, i) => ({ uid: uidBase + i, key: c.key, level: c.level, spent: false, sigil: c.sigil, temper: c.temper }));
  return {
    hp: cfg.hp,
    maxHp: cfg.hp,
    embers: cfg.embers,
    cards,
    relics: cfg.relics ?? [],
    wardenName: cfg.wardenName ?? '',
    discountNext: 0,
    discountWave: 0,
    firstSpellCastThisWave: false,
    abyssalFreeUsed: false,
    firstBurnThisWave: false,
    paidStepsThisWave: 0,
    noFaceDamageUntilWave: 0,
    noSpellsUntilWave: 0,
    shieldsPersistUntilWave: 0,
    burnSpreadsFullUntilWave: 0,
    halfDamageLanes: [],
    deathsThisBattle: 0,
    deathsThisWave: 0,
    bonebound2Used: false,
    faceDamageDealt: 0,
    pouchEmbers: 0,
  };
}

export function newBattle(cfg: BattleConfig): { state: BattleState; events: BattleEvent[] } {
  const st: BattleState = {
    seed: cfg.seed,
    rng: makeRng(cfg.seed, 'battle'),
    wave: 0,
    phase: 'action',
    initiative: 0,
    turn: 0,
    actionsLeft: [0, 0],
    passed: [false, false],
    firstPass: null,
    sides: [sideState(cfg.player, 1000), sideState(cfg.enemy, 2000)],
    units: [],
    nextId: 1,
    fallen: [],
    winner: null,
    kind: cfg.kind ?? 'fight',
    elite: cfg.elite,
    boss: cfg.boss ? { darkLanes: [], nextDarkLanes: [0], ownLaneDark: false } : undefined,
    errors: [],
    triggerDepth: 0,
  };
  const ctx: Ctx = { st, events: [] };
  for (const side of [0, 1] as Side[]) {
    const c = side === 0 ? cfg.player : cfg.enemy;
    for (const b of c.board ?? []) placeUnit(ctx, makeUnit(ctx, side, b.key, b.level ?? 1, { lane: b.lane, row: b.row }), true);
    if (hasRelic(st, side, 'Tinder Pouch')) {
      st.sides[side].embers += 2;
      st.sides[side].pouchEmbers = 2;
    }
  }
  startWave(ctx, 1);
  // Cracked Bell: Front row starts with Shield 3. Bronze Abbess Flame: start with Shield 2.
  for (const side of [0, 1] as Side[]) {
    if (hasRelic(st, side, 'Cracked Bell')) for (const u of unitsOf(st.units, side)) if (u.row === 0) u.shield += 3;
  }
  return { state: st, events: ctx.events };
}

// ---------- costs ----------

export function spellCost(st: BattleState, side: Side, card: BattleCard): number {
  const def = defFor(card.key, card.level);
  let cost = def.spellCost;
  const s = st.sides[side];
  cost -= s.discountNext + s.discountWave;
  if (hasTier(st, side, 'Kindler', 3)) cost -= 1;
  else if (hasTier(st, side, 'Kindler', 2) && !s.firstSpellCastThisWave) cost -= 1;
  for (const u of unitsOf(st.units, side)) {
    for (const p of u.grants) if (p.passive.k === 'shieldsNeverExpire') void 0;
  }
  // Abbess Flame start shield is handled at summon; Bronze Abbess has no cost effect.
  for (const u of unitsOf(st.units, other(side))) for (const p of defFor(u.key, u.level).passives) if (p.k === 'enemySpellCost') cost += p.n;
  if (hasRelic(st, side, "Miser's Wick")) cost += 1;
  return Math.max(0, cost);
}

export function stepCost(st: BattleState, u: Unit): number {
  if (u.stepsUsed < swiftOf(st, u)) return 0;
  if (hasRelic(st, u.side, 'Bellows') && st.sides[u.side].paidStepsThisWave === 0) return 0;
  return FLAGS.extraStepCost;
}

// ---------- targeting ----------

/** All legal target tuples for a spell. Each entry is one `targets` array. */
export function targetOptions(st: BattleState, side: Side, spec: TargetSpec): Target[][] {
  const ctx: Ctx = { st, events: [] };
  const scope: Scope = { side, targets: [], targetUnits: [], kills: 0 };
  const foe = other(side);
  const where = (u: Unit) => (spec.where ?? []).every((c) => cond(ctx, c, u, scope));
  const unitsFor = (): Unit[] => {
    if (spec.kind === 'enemy') return unitsOf(st.units, foe).filter(where);
    if (spec.kind === 'ally') return unitsOf(st.units, side).filter(where);
    if (spec.kind === 'unit') return st.units.filter(where);
    return [];
  };
  switch (spec.kind) {
    case 'none':
      return [[]];
    case 'enemy':
    case 'ally':
    case 'unit': {
      const list = unitsFor().sort((a, b) => a.side - b.side || a.lane - b.lane || a.row - b.row);
      if (spec.count === 2) {
        const out: Target[][] = [];
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([{ unit: list[i]!.id }, { unit: list[j]!.id }]);
        return out;
      }
      return list.map((u) => [{ unit: u.id }]);
    }
    case 'lane': {
      if (spec.lanes === 2) return [0, 1, 2].map((l) => [{ lane: l as Lane }, { lane: (l + 1) as Lane }]);
      return [0, 1, 2, 3].map((l) => [{ lane: l as Lane }]);
    }
    case 'row':
      return [0, 1, 2].map((r) => [{ row: r as Row }]);
    case 'emptyCell': {
      const cells = emptyCells(st.units, side);
      if (spec.count === 2) {
        const out: Target[][] = [];
        for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) out.push([{ cell: cells[i]! }, { cell: cells[j]! }]);
        return out;
      }
      return cells.map((c) => [{ cell: c }]);
    }
    case 'spentCard': {
      const spent = st.sides[side].cards.filter((c) => c.spent);
      if (spec.count === 2) {
        const out: Target[][] = [];
        for (let i = 0; i < spent.length; i++) for (let j = i + 1; j < spent.length; j++) out.push([{ card: spent[i]!.uid }, { card: spent[j]!.uid }]);
        return out;
      }
      return spent.map((c) => [{ card: c.uid }]);
    }
    case 'deckCard':
      return st.sides[side].cards.filter((c) => !c.spent).map((c) => [{ card: c.uid }]);
    case 'fallen':
      return st.fallen.map((_, i) => [{ fallen: i }]);
  }
}

/** Move targets for a 'move' spell (Scent the Gap): the unit plus a destination cell. */
function moveSpellOptions(st: BattleState, side: Side, cells: number): Target[][] {
  const out: Target[][] = [];
  for (const u of unitsOf(st.units, side)) {
    for (const c of reachable(st, u, cells)) out.push([{ unit: u.id }, { cell: c }]);
  }
  return out;
}
function reachable(st: BattleState, u: Unit, steps: number): Cell[] {
  const seen = new Set<string>([`${u.lane},${u.row}`]);
  let frontier: Cell[] = [{ lane: u.lane, row: u.row }];
  const out: Cell[] = [];
  for (let i = 0; i < steps; i++) {
    const next: Cell[] = [];
    for (const c of frontier) {
      for (const n of cellsAround(c, false)) {
        const k = `${n.lane},${n.row}`;
        if (seen.has(k) || unitAt(st.units, u.side, n.lane, n.row)) continue;
        seen.add(k);
        next.push(n);
        out.push(n);
      }
    }
    frontier = next;
  }
  return out;
}

// ---------- legal actions ----------

export function legalActions(st: BattleState, side: Side = st.turn): Action[] {
  if (st.phase !== 'action' || st.turn !== side || st.passed[side] || st.actionsLeft[side] <= 0) return [];
  const out: Action[] = [];
  const s = st.sides[side];
  const empties = emptyCells(st.units, side);
  for (const card of s.cards) {
    if (card.spent) continue;
    const def = defFor(card.key, card.level);
    for (const c of empties) out.push({ type: 'summon', card: card.uid, lane: c.lane, row: c.row });
    if (def.spell && st.wave > s.noSpellsUntilWave && spellCost(st, side, card) <= s.embers) {
      const spec = def.spell.target;
      const moveOp = def.spell.do.find((o) => o.op === 'move');
      const options = moveOp && moveOp.op === 'move' ? moveSpellOptions(st, side, moveOp.cells) : targetOptions(st, side, spec);
      for (const targets of options) out.push({ type: 'cast', card: card.uid, targets });
    }
  }
  for (const u of unitsOf(st.units, side)) {
    if (isRooted(st, u)) continue;
    const cost = stepCost(st, u);
    if (cost > s.embers) continue;
    for (const c of cellsAround(u, false)) {
      if (!unitAt(st.units, side, c.lane, c.row)) out.push({ type: 'move', unit: u.id, lane: c.lane, row: c.row });
    }
  }
  out.push({ type: 'pass' });
  return out;
}

// ---------- applyAction ----------

export function cloneState(st: BattleState): BattleState {
  return structuredClone(st);
}

export function applyAction(input: BattleState, action: Action): ApplyResult {
  const st = cloneState(input);
  const ctx: Ctx = { st, events: [] };
  st.triggerDepth = 0;
  if (st.phase !== 'action') {
    err(ctx, 'ACTION_AFTER_END');
    return { state: st, events: ctx.events };
  }
  const side = st.turn;
  const s = st.sides[side];
  let consumed = true;
  switch (action.type) {
    case 'summon': {
      const card = s.cards.find((c) => c.uid === action.card);
      if (!card || card.spent) return fail(ctx, 'NO_SUCH_CARD');
      if (unitAt(st.units, side, action.lane, action.row)) return fail(ctx, 'CELL_OCCUPIED');
      const u = makeUnit(ctx, side, card.key, card.level, { lane: action.lane as Lane, row: action.row as Row }, card.uid);
      if (card.sigil && !u.traits.includes(card.sigil)) u.extraTraits.push(card.sigil);
      if (card.temper) {
        u.buffAtk += card.temper;
        u.buffHp += card.temper;
      }
      card.spent = true;
      placeUnit(ctx, u);
      for (const a of unitsOf(st.units, side)) for (const p of defFor(a.key, a.level).passives) if (p.k === 'shieldsNeverExpire' && p.startShield && a.id !== u.id) u.shield += p.startShield;
      if (unitTraits(u).includes('Abyssal') && hasTier(st, side, 'Abyssal', 1) && !s.abyssalFreeUsed) {
        s.abyssalFreeUsed = true;
        consumed = false;
      }
      runTriggers(ctx, u, 'kindle', { side, source: u, targets: [], targetUnits: [], kills: 0 });
      break;
    }
    case 'cast': {
      const card = s.cards.find((c) => c.uid === action.card);
      if (!card || card.spent) return fail(ctx, 'NO_SUCH_CARD');
      const def = defFor(card.key, card.level);
      if (!def.spell) return fail(ctx, 'NO_SPELL');
      if (st.wave <= s.noSpellsUntilWave) return fail(ctx, 'SPELLS_HUSHED');
      const cost = spellCost(st, side, card);
      if (cost > s.embers) return fail(ctx, 'NOT_ENOUGH_EMBERS');
      if (!validTargets(st, side, def.spell.target, action.targets, def.spell.do.some((o) => o.op === 'move'))) return fail(ctx, 'BAD_TARGET');
      s.embers -= cost;
      if (cost > 0) ctx.events.push({ type: 'embers', side, delta: -cost, reason: def.spellName });
      s.discountNext = 0;
      s.firstSpellCastThisWave = true;
      card.spent = true;
      ctx.events.push({ type: 'cast', side, key: card.key, name: def.spellName, targets: action.targets });
      const targetUnits = action.targets.flatMap((t) => ('unit' in t ? st.units.filter((u) => u.id === t.unit) : []));
      runOps(ctx, def.spell.do, { side, targets: action.targets, targetUnits, kills: 0, spellKey: card.key });
      s.lastSpell = { key: card.key, level: card.level, targets: action.targets };
      break;
    }
    case 'move': {
      const u = st.units.find((x) => x.id === action.unit && x.side === side);
      if (!u) return fail(ctx, 'NO_SUCH_UNIT');
      if (isRooted(st, u)) return fail(ctx, 'ROOTED');
      if (!cellsAround(u, false).some((c) => c.lane === action.lane && c.row === action.row)) return fail(ctx, 'NOT_ADJACENT');
      if (unitAt(st.units, side, action.lane, action.row)) return fail(ctx, 'CELL_OCCUPIED');
      const cost = stepCost(st, u);
      if (cost > s.embers) return fail(ctx, 'NOT_ENOUGH_EMBERS');
      if (cost > 0) {
        s.embers -= cost;
        ctx.events.push({ type: 'embers', side, delta: -cost, reason: 'step' });
      } else if (u.stepsUsed >= swiftOf(st, u)) s.paidStepsThisWave += 1;
      u.stepsUsed += 1;
      moveUnitTo(ctx, u, { lane: action.lane, row: action.row }, cost > 0);
      consumed = false;
      break;
    }
    case 'pass': {
      st.passed[side] = true;
      const first = st.firstPass === null;
      if (first) {
        st.firstPass = side;
        let n: number = FLAGS.passFirstEmbers;
        for (const u of unitsOf(st.units, side)) for (const p of defFor(u.key, u.level).passives) if (p.k === 'passFirstEmbers') n = Math.max(n, p.n);
        gainEmbers(ctx, side, n, 'pass first');
        for (const u of unitsOf(st.units, side)) runTriggers(ctx, u, 'passFirst', { side, source: u, targets: [], targetUnits: [], kills: 0 });
      }
      ctx.events.push({ type: 'pass', side, first });
      consumed = false;
      break;
    }
  }
  if ((st.phase as string) === 'over') return { state: st, events: ctx.events };
  if (consumed) st.actionsLeft[side] -= 1;
  if (action.type === 'move') return { state: st, events: ctx.events }; // moving keeps the turn
  advanceTurn(ctx);
  return { state: st, events: ctx.events };
}

function fail(ctx: Ctx, reason: string): ApplyResult {
  err(ctx, `ILLEGAL_ACTION ${reason}`);
  return { state: ctx.st, events: ctx.events };
}

function validTargets(st: BattleState, side: Side, spec: TargetSpec, targets: Target[], isMove: boolean): boolean {
  const key = JSON.stringify(targets);
  const options = isMove ? moveSpellOptions(st, side, 2) : targetOptions(st, side, spec);
  return options.some((o) => JSON.stringify(o) === key);
}

/** Hands the turn over, skipping sides that passed or are out of actions; resolves the Clash when both are done. */
function advanceTurn(ctx: Ctx): void {
  const st = ctx.st;
  const done = (s: Side) => st.passed[s] || st.actionsLeft[s] <= 0;
  const cur = st.turn;
  const nxt = other(cur);
  if (!done(nxt)) st.turn = nxt;
  else if (!done(cur)) st.turn = cur;
  else {
    resolveClash(ctx);
  }
}

/** Drives a battle with a policy until it ends. Used by sims and tests. */
export function playOut(st: BattleState, policy: (s: BattleState, rng: RngState) => [Action, RngState], rng: RngState, maxSteps = 500): { state: BattleState; steps: number; rng: RngState } {
  let s = st;
  let r = rng;
  let steps = 0;
  while (s.phase === 'action' && steps < maxSteps) {
    const [a, r2] = policy(s, r);
    r = r2;
    s = applyAction(s, a).state;
    steps++;
  }
  if (s.phase === 'action') s.errors.push('MAX_STEPS');
  return { state: s, steps, rng: r };
}

export function randomPolicy(s: BattleState, rng: RngState): [Action, RngState] {
  const actions = legalActions(s);
  const [i, r] = nextInt(rng, actions.length);
  return [actions[i]!, r];
}
